# free mobile ai — DeepSeek Harness 插件（免费版）

<p align="center">
  <img src="icon.svg" width="120" height="120" alt="free mobile ai"/>
</p>

**免费插件 · 人人可用 · 无需注册/验证。**

在 DeepSeek Harness 的 Web GUI 里装一次本插件，对话输入框下方会出现一张「移动AI」卡片：
一键安装 / 更新 / 卸载 mobile ai 客户端，展示各操作系统的一键安装命令，并实时显示本机运行状态。
装好后，你的手机浏览器打开本地控制台 URL，就能远程使用这台电脑——不装 App、不转发端口、不要公网 IP。

> 这是 **免费** 版本：任何人安装本插件即可使用，不做账号验证。
> mobile ai 客户端本体（`client/mobileai.mjs`，MIT）随插件一起分发，也可从
> <https://github.com/ricky8848/free-mobile-ai> 单独获取。

---

## 这个插件做什么

| 半边 | 作用 |
|------|------|
| 宿主（Node） | 在 dsh web 上注册 `/free-mobile-ai/*` 路由：`manifest.json`（命令/版本）、`status.json`（检测本机是否已装/运行）、`install` / `uninstall`（在本机执行一键安装/卸载）、`client/*`（随包分发的安装脚本）。 |
| 客户端（Web） | 在对话输入框下方渲染一张卡片：状态点、一键安装/卸载按钮、控制台链接、可复制的各 OS 命令、安装输出。跟随宿主明暗主题与语言。 |

免费保证：**不读取任何凭据、不校验 token**。卡片与路由都是纯旁路增量，坏了只影响这张卡片，绝不影响你的对话、审批或 GUI。

---

## 一键安装 / 插件加载命令（按操作系统）

### 1) 安装本插件（让「移动AI」卡片出现在你的 DeepSeek Harness）

插件以 npm 包 `free-mobile-ai` 形式分发。在**运行 DeepSeek Harness 的那台电脑**上：

```bash
# 任何操作系统（macOS / Linux / Windows，需要 dsh 在 PATH 上）
dsh plugin --profile <你的profile> add free-mobile-ai
```

- `<你的profile>`：你的 dsh profile 名（Web GUI 对应 `web`）。
- 安装后 Web GUI 会热加载（`patchReload: live`），刷新页面即可在输入框下方看到卡片。
- 卸载插件：`dsh plugin --profile web remove free-mobile-ai`（或在本 profile 的 `package.json` 移除依赖后重启）。

> 尚未发布到 npm 时，可先用本地目录安装（开发/内部用）：
> `dsh plugin --profile web add /path/to/free-mobile-ai-plugin`

### 2) 通过插件卡片一键安装 mobile ai 客户端（在这台电脑上）

装好插件后，点击卡片上的「一键安装」即可，它会在本机执行下面对应系统的命令：

**macOS / Linux**
```bash
curl -fsSL https://dsh.newapi.email/mai/i.sh | bash
```

**Windows（PowerShell）**
```powershell
irm https://dsh.newapi.email/mai/i.ps1 | iex
```

这些命令会：检查 Node ≥18 → 下载客户端文件到 `~/.mobileai/` → 启动本地控制台（浏览器打开）→ 首次启动时下载并校验 cloudflared → 注册开机自启。幂等，可重复执行。

### 3) 手机上使用（无需安装任何东西）

在你电脑的控制台里拿到本地 URL 后，手机浏览器打开它即可远程使用这台电脑。

---

## 插件加载命令（开发者 / 高级）

若你维护自己的 dsh 部署，也可用 patch 方式手动挂载（等价于 `dsh plugin add`）：

```yaml
# 在 profile 的 cordis.patch.yml 中：
- insert:
    - id: free-mobile-ai
      name: 'free-mobile-ai'
```

并在 `package.json` 的 `dependencies` 中加入 `"free-mobile-ai": "*"`（或 `file:./free-mobile-ai-plugin`），然后 `pnpm install`。

---

## 包结构

```
free-mobile-ai-plugin/
├── package.json        # dsh.bundle / dsh.host / dsh.client 声明
├── cordis.patch.yml    # 插入 free-mobile-ai 插件行
├── index.js            # 宿主半边：/free-mobile-ai/* 路由（manifest/status/install/uninstall/client/*）
├── client.js           # 客户端半边：输入框下方卡片
├── locale/zh.json      # 中文文案（meta + card）
├── locale/en.json      # 英文文案
├── icon.svg            # 插件图标
└── client/             # 随包分发的 mobile ai 客户端
    ├── mobileai.mjs    # 单文件客户端（零依赖，Node ≥18）
    ├── i.sh            # macOS/Linux 一键安装
    └── i.ps1           # Windows 一键安装
```

## 许可证

MIT。客户端 `client/mobileai.mjs` 版权归 ricky8848，完整许可证见 `LICENSE`。
