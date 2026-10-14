window.__ModuleLoader__.load({
  id: 'free-mobile-ai',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useSyncExternalStore, useEffect, useState: useStateRaw, useCallback, useRef } = React;

    const API = (typeof window !== 'undefined' && window.location)
      ? window.location.origin + '/free-mobile-ai' : '/free-mobile-ai';

    // 轻量外部 store：状态 + manifest 各自一份，组件按引用订阅。
    let state = { installed: null, running: null, version: null, consoleUrl: null, platform: null };
    let manifest = null;
    const stateSubs = new Set();
    const manifestSubs = new Set();
    const pubState = () => stateSubs.forEach((f) => f());
    const pubManifest = () => manifestSubs.forEach((f) => f());
    function subscribeState(f) { stateSubs.add(f); return () => stateSubs.delete(f); }
    function subscribeManifest(f) { manifestSubs.add(f); return () => manifestSubs.delete(f); }

    async function refresh() {
      try {
        const r = await fetch(API + '/status.json', { cache: 'no-store' });
        if (!r.ok) throw new Error('http ' + r.status);
        const j = await r.json();
        state = { installed: !!j.installed, running: !!j.running, version: j.version || null, consoleUrl: j.consoleUrl || null, platform: j.platform || null };
        pubState();
      } catch { /* 保持上次状态；宿主未装本插件时不显示 */ }
    }

    function useMaiState() { return useSyncExternalStore(subscribeState, () => state); }
    function useManifest() { return useSyncExternalStore(subscribeManifest, () => manifest); }

    // 主题令牌（跟随宿主明暗），字面颜色仅用于徽章图标
    const T = {
      bg: 'var(--dsw-alias-bg-secondary, var(--dsw-alias-bg, transparent))',
      fg: 'var(--dsw-alias-fg-primary, var(--dsw-alias-fg, currentColor))',
      fgDim: 'var(--dsw-alias-fg-secondary, var(--dsw-alias-fg, currentColor))',
      border: 'var(--dsw-alias-border, rgba(128,128,128,.35))',
      accent: '#8b5cf6',
      code: 'var(--dsw-alias-bg-tertiary, var(--dsw-alias-bg-secondary, rgba(128,128,128,.1)))',
      ok: 'var(--dsw-alias-fg-positive, #34d399)',
      warn: 'var(--dsw-alias-fg-warning, #fbbf24)',
    };

    // 插件卡片文案（随包分发，注册到宿主 locale 服务，跟随明暗/语言切换）
    const ZH = { badge: '移动AI', free: '免费 · 无需注册', installed: '已安装', notInstalled: '未安装', install: '一键安装', installing: '安装中…', uninstall: '卸载', uninstalling: '卸载中…', openConsole: '打开控制台', copy: '复制', copied: '已复制', command: '本机一键安装命令', commands: '各操作系统命令', statusOk: '运行中', statusStopped: '已停止', statusMissing: '未安装', learn: '了解更多' };
    const EN = { badge: 'Mobile AI', free: 'Free · no signup', installed: 'Installed', notInstalled: 'Not installed', install: 'One-click install', installing: 'Installing…', uninstall: 'Uninstall', uninstalling: 'Uninstalling…', openConsole: 'Open console', copy: 'Copy', copied: 'Copied', command: 'One-click install command for this machine', commands: 'Commands by OS', statusOk: 'Running', statusStopped: 'Stopped', statusMissing: 'Not installed', learn: 'Learn more' };
    const NS = 'free-mobile-ai.card';

    function useLocaleDict(ctx2) {
      const [dict, setDict] = useStateRaw(null);
      useEffect(() => {
        const svc = (ctx2 && ctx2.get) ? ctx2.get('locale') : (ctx2 && ctx2.locale);
        if (!svc || typeof svc.register !== 'function') { setDict(ZH); return; }
        let disposers = [];
        try {
          disposers.push(svc.register(NS, 'zh', ZH));
          disposers.push(svc.register(NS, 'en', EN));
        } catch { /* 重复注册（HMR 重载）→ 忽略 */ }
        const update = () => { try { const t = svc.bind(NS); setDict(Object.fromEntries(Object.keys(ZH).map((k) => [k, t(k)]))); } catch { setDict(ZH); } };
        update();
        return svc.subscribe ? svc.subscribe(update) : (() => { disposers.forEach((d) => { try { d(); } catch { } }); });
      }, []);
      return { dict };
    }

    function L({ dict, k, fallback }) { return dict && dict[k] ? dict[k] : fallback; }

    function Icon() {
      return h('svg', { viewBox: '0 0 512 512', width: 22, height: 22, 'aria-hidden': true, style: { flex: '0 0 auto' } },
        h('defs', null, h('linearGradient', { id: 'fma-grad', x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
          h('stop', { offset: '0%', style: { stopColor: '#6366f1' } }),
          h('stop', { offset: '100%', style: { stopColor: '#8b5cf6' } }))),
        h('rect', { x: 118, y: 60, width: 276, height: 392, rx: 44, fill: 'url(#fma-grad)' }),
        h('rect', { x: 150, y: 104, width: 212, height: 288, rx: 18, fill: 'rgba(255,255,255,.92)' }),
        h('rect', { x: 236, y: 416, width: 40, height: 8, rx: 4, fill: 'rgba(255,255,255,.9)' }),
        h('path', { d: 'M206 208 L268 260 L206 312 Z', fill: '#8b5cf6' }),
        h('rect', { x: 268, y: 240, width: 64, height: 8, rx: 4, fill: 'rgba(139,92,246,.4)' }),
        h('rect', { x: 268, y: 260, width: 48, height: 8, rx: 4, fill: 'rgba(139,92,246,.4)' }),
      );
    }

    function Card(ctx2) {
      const { dict } = useLocaleDict(ctx2);
      const s = useMaiState();
      const manifest = useManifest();
      const [busy, setBusy] = useStateRaw(null); // 'install' | 'uninstall' | null
      const [copied, setCopied] = useStateRaw(false);
      const [showAll, setShowAll] = useStateRaw(false);
      const [log, setLog] = useStateRaw(null);
      const timerRef = useRef(0);

      // 文案兜底（中文优先，插件 locale 未挂载时仍可用）
      const txt = {
        badge: L(dict, 'badge', '移动AI'),
        free: L(dict, 'free', '免费 · 无需注册'),
        installed: L(dict, 'installed', '已安装'),
        notInstalled: L(dict, 'notInstalled', '未安装'),
        install: L(dict, 'install', '一键安装'),
        installing: L(dict, 'installing', '安装中…'),
        uninstall: L(dict, 'uninstall', '卸载'),
        uninstalling: L(dict, 'uninstalling', '卸载中…'),
        openConsole: L(dict, 'openConsole', '打开控制台'),
        command: L(dict, 'command', '本机一键安装命令'),
        commands: L(dict, 'commands', '各操作系统命令'),
        copy: L(dict, 'copy', '复制'),
        copied: L(dict, 'copied', '已复制'),
        statusOk: L(dict, 'statusOk', '运行中'),
        statusStopped: L(dict, 'statusStopped', '已停止'),
        statusMissing: L(dict, 'statusMissing', '未安装'),
        learn: L(dict, 'learn', '了解更多'),
      };

      useEffect(() => {
        refresh();
        timerRef.current = setInterval(refresh, 15000);
        fetch(API + '/manifest.json', { cache: 'no-store' })
          .then((r) => r.ok ? r.json() : null)
          .then((m) => { if (m) { manifest = m; pubManifest(); } })
          .catch(() => { });
        return () => { clearInterval(timerRef.current); };
      }, []);

      const doAction = useCallback(async (action) => {
        setBusy(action);
        setLog(null);
        try {
          const r = await fetch(API + '/' + action, { method: 'POST' });
          const j = await r.json().catch(() => ({}));
          setLog((j.output || j.notes || (j.error ? j.error : (r.ok ? 'ok' : 'failed'))).slice(-1500));
        } catch (e) { setLog(String(e)); }
        setBusy(null);
        refresh();
      }, []);

      const thisCmd = manifest ? (manifest.commands || {})[manifest.platform] || '' : '';
      const allCmds = manifest ? Object.entries(manifest.commands || {}) : Object.entries({ macos: txt.command, linux: txt.command, windows: txt.command });

      const copy = (text) => {
        try { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { }
      };

      const statusText = s.installed === null ? '…'
        : s.installed ? (s.running ? txt.statusOk : txt.statusStopped)
          : txt.statusMissing;
      const statusColor = s.installed === null ? T.fgDim
        : s.running ? T.ok
          : s.installed ? T.warn : T.fgDim;

      const codeRow = (os, cmd) => h('div', { key: os, style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 } },
        h('span', { style: { flex: '0 0 64px', fontSize: 11, color: T.fgDim, textTransform: 'uppercase' } }, os),
        h('code', { style: { flex: 1, fontSize: 11, overflowX: 'auto', whiteSpace: 'nowrap', background: T.code, borderRadius: 6, padding: '3px 8px', color: T.fg } }, cmd),
        h('button', {
          onClick: () => copy(cmd),
          style: { flex: '0 0 auto', fontSize: 11, padding: '2px 8px', borderRadius: 6, border: `1px solid ${T.border}`, background: 'transparent', color: T.fgDim, cursor: 'pointer' },
        }, copied ? txt.copied : txt.copy));

      return h('div', {
        style: {
          display: 'flex', flexDirection: 'column', gap: 8,
          maxWidth: 560, padding: '10px 12px', borderRadius: 12,
          background: T.bg, border: `1px solid ${T.border}`,
          color: T.fg, fontSize: 13, lineHeight: 1.5,
        },
      },
      // 标题行
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          h(Icon),
          h('span', { style: { fontWeight: 600 } }, 'free mobile ai'),
          h('span', { style: { fontSize: 11, fontWeight: 600, color: '#fff', background: T.accent, borderRadius: 999, padding: '1px 8px' } }, txt.free),
          h('span', { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 } },
            h('span', { width: 8, height: 8, borderRadius: 999, background: statusColor, display: 'inline-block' }),
            h('span', { color: statusColor }, statusText)),
          s.version ? h('span', { fontSize: 11, color: T.fgDim }, 'v' + s.version) : null,
        ),
        // 按钮行
        h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } },
          s.installed
            ? h('a', {
              href: s.consoleUrl || 'http://127.0.0.1:5380', target: '_blank', rel: 'noreferrer',
              style: { fontSize: 12, padding: '4px 12px', borderRadius: 8, background: T.accent, color: '#fff', textDecoration: 'none' },
            }, txt.openConsole)
            : h('button', {
              onClick: () => doAction('install'), disabled: !!busy,
              style: { fontSize: 12, padding: '4px 12px', borderRadius: 8, border: 'none', background: busy === 'install' ? T.fgDim : T.accent, color: '#fff', cursor: busy ? 'wait' : 'pointer', opacity: busy && busy !== 'install' ? .5 : 1 },
            }, busy === 'install' ? txt.installing : txt.install),
          s.installed ? h('button', {
            onClick: () => doAction('uninstall'), disabled: !!busy,
            style: { fontSize: 12, padding: '4px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.fgDim, cursor: 'pointer' },
          }, busy === 'uninstall' ? txt.uninstalling : txt.uninstall) : null,
          h('a', {
            href: manifest ? manifest.home : 'https://github.com/ricky8848/free-mobile-ai', target: '_blank', rel: 'noreferrer',
            style: { marginLeft: 'auto', fontSize: 12, color: T.fgDim, textDecoration: 'underline' },
          }, txt.learn),
        ),
        // 本机命令
        thisCmd ? h('div', null,
          h('div', { style: { fontSize: 11, color: T.fgDim, marginTop: 4 } }, txt.command),
          codeRow((manifest && manifest.platform || 'os').slice(0, 8), thisCmd)) : null,
        // 展开其他 OS
        (manifest && Object.keys(manifest.commands || {}).length > 1)
          ? h('div', null,
            h('button', { onClick: () => setShowAll(!showAll), style: { fontSize: 11, background: 'none', border: 'none', color: T.fgDim, cursor: 'pointer', padding: 0, textDecoration: 'underline' } },
              showAll ? '▾ ' + txt.commands : '▸ ' + txt.commands),
            showAll ? h('div', null, ...allCmds.map(([os, cmd]) => codeRow(os, cmd))) : null)
          : null,
        // 安装输出
        log ? h('pre', {
          style: { margin: 0, maxHeight: 120, overflow: 'auto', fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: T.code, borderRadius: 6, padding: 8, color: T.fgDim },
        }, log) : null,
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register(
          { name: 'conversation.composer.dock', id: 'free-mobile-ai-card', order: 10 },
          function Wrapper() { return Card(ctx); },
        ));
      },
    };
  },
});
