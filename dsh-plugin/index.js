/**
 * free mobile ai — DeepSeek Harness plugin (host half)
 *
 * 免费插件：任何电脑装一次 mobile ai 客户端，手机浏览器即可远程使用家里电脑。
 * 本半边在 dsh web 上注册三条 /free-mobile-ai/* 路由，供浏览器卡片调用：
 *   GET  /free-mobile-ai/manifest.json   命令/文案/版本/控制台地址（客户端读取）
 *   GET  /free-mobile-ai/status.json     本机安装/运行状态（客户端轮询）
 *   POST /free-mobile-ai/install         在宿主（=本机）执行一键安装
 *   POST /free-mobile-ai/uninstall       停止并卸载本机客户端
 * 免费、无需注册/验证：不读任何凭据，不校验 token。
 *
 * 零运行时依赖：只用 node: 内置模块 + 已注入的 webServer 服务。
 */
import { spawn, execFile } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const VERSION = '0.1.0';
const CONSOLE_PORT = 5380;
const MAI_DIR = path.join(homedir(), '.mobileai');
const STATE_FILE = path.join(MAI_DIR, 'state.json');
const LAUNCHD_LABEL = 'ai.mobileai.client';
const SYSTEMD_UNIT = 'mobileai.service';
const PKG_DIR = path.dirname(fileURLToPath(import.meta.url));

/** 各操作系统的一键安装命令（卡片直接展示，可复制）。 */
const COMMANDS = {
  macos: "curl -fsSL https://dsh.newapi.email/mai/i.sh | bash",
  linux: "curl -fsSL https://dsh.newapi.email/mai/i.sh | bash",
  windows: "irm https://dsh.newapi.email/mai/i.ps1 | iex",
};

function currentPlatform() {
  switch (process.platform) {
    case 'darwin': return 'macos';
    case 'linux': return 'linux';
    case 'win32': return 'windows';
    default: return process.platform;
  }
}

function readStateFile() {
  try {
    if (!existsSync(STATE_FILE)) return null;
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch { return null; }
}

function isPortOpen(port, host = '127.0.0.1', timeoutMs = 1200) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => { if (!done) { done = true; try { s.destroy(); } catch { } resolve(ok); } };
    const s = new net.Socket();
    s.setTimeout(timeoutMs);
    s.once('connect', () => finish(true));
    s.once('timeout', () => finish(false));
    s.once('error', () => finish(false));
    s.connect(port, host);
  });
}

/** 检测本机 mobile ai 客户端状态（只读，从不修改）。 */
async function detectStatus() {
  const installed = existsSync(path.join(MAI_DIR, 'mobileai.mjs'));
  let consolePort = null;
  let running = false;
  let version = null;
  const state = readStateFile();
  if (state) {
    version = state.version || state.clientVersion || null;
    if (typeof state.consolePort === 'number') consolePort = state.consolePort;
  }
  if (!consolePort) consolePort = CONSOLE_PORT;
  running = await isPortOpen(consolePort);
  return {
    installed,
    running,
    version: version || (installed ? 'unknown' : null),
    consoleUrl: running || installed ? `http://127.0.0.1:${consolePort}` : null,
    dir: installed ? MAI_DIR : null,
  };
}

/** 在宿主上执行一键安装。幂等：i.sh 会临时下载+原子替换后启动控制台。 */
function runInstaller(platform) {
  return new Promise((resolve) => {
    let cmd, args;
    if (platform === 'windows') {
      cmd = 'powershell';
      args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
        `$ProgressPreference='SilentlyContinue'; iex ((irm 'https://dsh.newapi.email/mai/i.ps1') -join \"\`n\")`];
    } else {
      cmd = 'bash';
      args = ['-c', 'curl -fsSL https://dsh.newapi.email/mai/i.sh | bash'];
    }
    let child;
    try {
      child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, cwd: MAI_DIR });
    } catch (err) {
      resolve({ ok: false, error: `spawn failed: ${err.message}` });
      return;
    }
    const chunks = [];
    const onData = (d) => { if (chunks.length < 64) chunks.push(String(d)); };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    const timer = setTimeout(() => { try { child.kill('SIGTERM'); } catch { } }, 120_000);
    child.on('error', (err) => { clearTimeout(timer); resolve({ ok: false, error: err.message, output: chunks.join('').slice(-2000) }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ ok: code === 0, code, output: chunks.join('').slice(-4000) }); });
  });
}

/** 停止并卸载本机客户端（尽力而为，单项失败不中断）。 */
function runUninstall(platform) {
  return new Promise((resolve) => {
    const jobs = [];
    if (platform === 'macos') {
      jobs.push(['launchctl', ['unload', path.join(homedir(), 'Library', 'LaunchAgents', `${LAUNCHD_LABEL}.plist`), path.join(MAI_DIR, `${LAUNCHD_LABEL}.plist`)]]);
    } else if (platform === 'linux') {
      jobs.push(['systemctl', ['--user', 'disable', '--now', SYSTEMD_UNIT]]);
    } else if (platform === 'windows') {
      jobs.push(['schtasks', ['/delete', '/tn', 'mobileai', '/f']]);
    }
    // 杀掉正在运行的控制台进程
    const pkillArgs = platform === 'windows'
      ? ['taskkill', '/f', '/im', 'node.exe'] // 兜底：仅提示（避免误杀其它 node 进程，实际交给用户）
      : ['pkill', ['-f', path.join(MAI_DIR, 'mobileai.mjs')]];
    jobs.push([pkillArgs[0], pkillArgs.slice(1)]);
    let remaining = jobs.length;
    const notes = [];
    const finishOne = (ok, label) => {
      notes.push(`${ok ? '✓' : '✗'} ${label}`);
      if (--remaining === 0) resolve({ ok: true, notes: notes.join(' | ') });
    };
    for (const [cmd, args] of jobs) {
      // 跳过 taskkill 全杀（危险）：Windows 卸载仅移除计划任务，控制台由用户关闭
      if (cmd === 'taskkill') { notes.push('· 请手动关闭 mobile ai 控制台窗口（Windows）'); if (--remaining === 0) resolve({ ok: true, notes: notes.join(' | ') }); continue; }
      execFile(cmd, args, { timeout: 15_000 }, (err) => finishOne(!err, `${cmd} ${args.join(' ')}`));
    }
    if (jobs.length === 0) resolve({ ok: true, notes: 'nothing to do' });
  });
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(body);
}

export function apply(ctx) {
  const webServer = ctx.get('webServer');
  if (!webServer || typeof webServer.register !== 'function') return;

  const manifest = {
    name: 'free-mobile-ai',
    version: VERSION,
    consolePort: CONSOLE_PORT,
    home: 'https://github.com/ricky8848/free-mobile-ai',
    commands: COMMANDS,
    platform: currentPlatform(),
  };

  const dispose = webServer.register({
    kind: 'prefix',
    path: '/free-mobile-ai',
    async handler(req, res) {
      const url = new URL(req.url, 'http://localhost');
      const p = url.pathname.replace(/^\/free-mobile-ai/, '') || '/';
      try {
        if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }); res.end(); return; }
        if (p === '/manifest.json' && req.method === 'GET') return sendJson(res, 200, manifest);
        if (p === '/status.json' && req.method === 'GET') return sendJson(res, 200, { platform: currentPlatform(), ...await detectStatus() });
        if (p === '/install' && req.method === 'POST') return sendJson(res, 200, { platform: currentPlatform(), ...(await runInstaller(currentPlatform())) });
        if (p === '/uninstall' && req.method === 'POST') return sendJson(res, 200, { platform: currentPlatform(), ...(await runUninstall(currentPlatform())) });
        if (p.startsWith('/client/')) {
          const fname = path.basename(p.slice('/client/'.length));
          const allowed = ['mobileai.mjs', 'i.sh', 'i.ps1'];
          const file = path.join(PKG_DIR, 'client', allowed.includes(fname) ? fname : '__none__');
          if (allowed.includes(fname) && existsSync(file) && statSync(file).isFile()) {
            const data = readFileSync(file);
            const ct = fname.endsWith('.mjs') ? 'text/javascript' : fname.endsWith('.sh') ? 'text/x-shellscript' : 'text/plain';
            res.writeHead(200, { 'content-type': `${ct}; charset=utf-8`, 'cache-control': 'no-store' });
            res.end(data);
            return;
          }
          return sendJson(res, 404, { error: 'not found' });
        }
        sendJson(res, 404, { error: 'not found' });
      } catch (err) {
        sendJson(res, 500, { error: String(err && err.message || err) });
      }
    },
  });

  return () => { try { dispose(); } catch { } };
}
