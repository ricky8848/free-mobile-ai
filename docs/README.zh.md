# free mobile ai（移动AI）

![free-mobile-ai](../logo/wordmark.svg)

**人在路上任意飘，家里电脑爆缸开工。**
一条终端命令 + 一个浏览器页面，把家中电脑的任意本地工具/服务同步到你的手机和任何设备。
无需端口转发、无需公网 IP，手机上不装任何 App——浏览器打开一个 URL 即可。

---

## 这是什么？

**free mobile ai** 是一个零安装的隧道即服务（tunnel-as-a-service）。你在家中电脑上执行**一条命令**，它就能通过 Cloudflare 隧道从任何手机/浏览器访问。无需端口转发、无需路由器配置、手机上不需要安装任何客户端 App。

默认用例是 **DeepSeek Harness（DSH）Web GUI**：一个专属 URL，手机上直接操作家里电脑的全部 AI 工具链（DeepSeek Harness / Codex / OpenClaw）。但它可以暴露**任何本地 HTTP 服务**——你的家庭服务器、自托管应用、开发环境。

### 设计属性（v1.0）

| # | 属性 | 含义 |
|---|------|------|
| (a) | **零安装**（用户侧） | 一条 `curl \| bash`。就这一步。 |
| (b) | **零应用**（消费端） | 手机只需用浏览器打开一个 URL。无 App Store。 |
| (c) | **零流量留存**（平台侧） | 控制面从不查看、解密或存储你的业务数据。 |
| (d) | **可撤销凭证** | 你的 URL = 钥匙。轮换 URL = 立即撤销访问。 |
| (e) | **无码认证** | 机器码 = 身份。无需一次性码、邮箱验证即可激活。 |

---

## 快速开始（3 步）

### 第 1 步 · 在家中电脑运行安装命令

```sh
# macOS / Linux
curl -fsSL https://dsh.newapi.email/mai/i.sh | bash

# Windows PowerShell
irm https://dsh.newapi.email/mai/i.ps1 | iex
```

脚本自动下载 `cloudflared`（SHA-256 校验）并在浏览器中打开本地控制台。

### 第 2 步 · 激活（一键）

在本地控制台中：
- **本机服务地址**：`127.0.0.1:3080`（默认 = DSH Web GUI）。可改为任意 `host:port`。
- 点击「**启动隧道**」。

机器码自动检测，无需认证码——机器即身份。

### 第 3 步 · 手机打开专属 URL

你会看到一个形如 `https://x7k2m9.newapi.email` 的专属 URL。在手机浏览器中打开即可。

---

## 功能（v1.0）

| 功能 | ID | 说明 |
|------|-----|------|
| 无码自动认证 | **L1** | machine code = identity。幂等激活，无需一次性码。 |
| 本地多路复用器 | **L2** | 一条隧道、多个工具（`/t/<name>` 或 `?tool=<name>`）。零额外隧道。 |
| 在线时长追踪 | **T1** | 30s 心跳，累计在线时间，生命周期感知。 |
| 工具预设 + admin UX | **T2** | 每绑定可挂载多个工具，admin 侧实时可见。 |
| 别名 | **A1** | 绑定的友好名称。 |
| 推荐归因 | **X9** | activate 时可选 `ref` 参数；admin stats 聚合 Top N。 |

---

## 架构（一句话）

```
手机浏览器 ──HTTPS──▶ Cloudflare Edge（TLS 终结 + 转发）
                              │
                    ┌─────────▼────────┐
                    │ 你的电脑（常驻）   │ ← cloudflared 出站连接，无需公网 IP
                    ├──────────────────┤
                    │ mux :5380        │   /t/<name> → 127.0.0.1:<port>
                    │ DSH :3080        │   默认工具
                    └──────────────────┘
```

- **控制面**（Node.js + SQLite）：机器码注册、绑定管理、心跳校验、在线时长追踪。**不代理业务流量**。
- **数据面**（你的机器）：cloudflared + 本地 mux。Cloudflare 边缘仅做 TLS 终结与字节转发。

完整设计与安全分析见 [docs/paper.md](paper.md)。

---

## 安全模型（能力范式）

- **URL-as-credential**：随机子域 URL = 访问凭证。高熵、不可枚举。
- **轮换 = 撤销**：URL 轮换 → 旧 URL 立即失效（DNS/ingress 变更）。无会话 token 需要作废。
- **机器绑定**：单终端策略（一台授权电脑）。错机 → 心跳吊销。
- **零留存**：控制面仅存绑定元数据（机器码、子域、状态）。从不存储请求/响应体。

完整论文：[docs/paper.md](paper.md)（中文）· [docs/paper-en.md](paper-en.md)（English）

---

## 文档索引

| 文件 | 说明 |
|------|------|
| [docs/GUIDE.md](GUIDE.md) | **完整使用指引**（安装、日常使用、故障排查、FAQ）— 中英双语 |
| [docs/paper.md](paper.md) | **研究论文**（中文）：设计、安全模型、容量分析、Trade-off 评估 |
| [docs/paper-en.md](paper-en.md) | **研究论文**（English）：同内容英文版 |
| [docs/paper.pdf](paper.pdf) | 论文（中文），LaTeX 排版，8 页 |
| [docs/paper-en.pdf](paper-en.pdf) | 论文（English），LaTeX 排版，8 页 |
| [docs/CAPACITY.md](CAPACITY.md) | 容量分析（Cloudflare 免费计划限制） |
| [SECURITY.md](../SECURITY.md) | 安全模型、威胁假设、已知边界 |

---

## 环境要求

| 组件 | 要求 |
|------|------|
| 家中电脑 | macOS / Linux / Windows，**Node.js ≥ 18**（i.sh 自动补齐） |
| 手机 / 消费设备 | 任何现代浏览器（Safari, Chrome, Edge）。无需安装 App。 |
| 网络 | 仅需出站 HTTPS（443）。无入站端口、无需端口转发。 |
| Cloudflare 账号 | 免费计划即可（tunnel + DNS）。控制面通过 API 自动创建隧道。 |

---

## License

[MIT](../LICENSE) — Copyright (c) 2026 ricky8848

---

## 项目状态

**v1.0（2026-09）** — 已在 `newapi.email` 生产环境运行。

| 版本 | 里程碑 |
|------|--------|
| v0.4 | 一键安装器、本地控制台、magic-link 门户、DSH 默认工具 |
| v0.5 | Edge WS 修复、工具预设、容量分析论文（v0.5 baseline） |
| **v1.0** | 无码认证（L1）、本地 mux 多工具（L2）、遥测（T1/T2）、别名（A1）、推荐归因（X9） |

---

## 贡献与支持

- Issues: GitHub → Issues
- 支持：ricky8848@outlook.com（附机器码）
