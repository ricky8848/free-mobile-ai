# free mobile ai

<p align="center">
  <img src="logo/free-mobile-ai.svg" width="120" height="120" alt="free mobile ai logo"/>
  <br/><br/>
  <img src="logo/wordmark.svg" width="320" height="42" alt="free mobile ai"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0-blue?style=flat-square" alt="version"/>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="license"/>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey?style=flat-square" alt="platform"/>
  <img src="https://img.shields.io/badge/tunnel-Cloudflare-purple?style=flat-square" alt="tunnel"/>
  <img src="https://img.shields.io/badge/docs-EN%20%C2%B7%20%E4%B8%AD%20%C2%B7%20JA%20%C2%B7%20KO-blueviolet?style=flat-square" alt="docs"/>
  <a href="https://doi.org/10.5281/zenodo.22804199"><img src="https://img.shields.io/badge/DOI-10.5281%2Fzenodo.22804199-brightgreen?style=flat-square&logo=doi" alt="DOI"/></a>
</p>

<p align="center">
  📄 <strong>Paper:</strong> <a href="https://doi.org/10.5281/zenodo.22804199">free mobile ai: Zero-Install Tunnel-as-a-Service — Design and Analysis (v1.0)</a> · <a href="https://github.com/ricky8848/free-mobile-ai/releases/download/v1.0.0/paper-technical-report-en.pdf">EN PDF</a> · <a href="https://github.com/ricky8848/free-mobile-ai/releases/download/v1.0.0/paper-technical-report-zh-CN.pdf">中文 PDF</a>
</p>

<p align="center">
  <strong>Your home computer, in your pocket. One command. Zero apps.</strong>
</p>

<p align="center">
  <em>人在路上任意飘，家里电脑爆缸开工。</em><br/>
  Your home machine, accessible from your phone — no port forwarding, no public IP, no mobile app. Just a URL in your browser.
</p>

---

## 🌐 Languages / 语言 / 言語 / 언어

| Language | README | User Guide | Paper (PDF) |
|----------|--------|------------|-------------|
| 🇬🇧 **English** | [this page](#free-mobile-ai) | [Guide](docs/GUIDE.md) | [⬇ Download](https://github.com/ricky8848/free-mobile-ai/releases/download/v1.0.0/paper-technical-report-en.pdf) |
| 🇨🇳 **中文** | [README](docs/README.zh.md) | [指引](docs/GUIDE.md#中文指引详细版) | [⬇ 下载](https://github.com/ricky8848/free-mobile-ai/releases/download/v1.0.0/paper-technical-report-zh-CN.pdf) |
| 🇯🇵 **日本語** | [README](docs/README.ja.md) | — | [⬇ Download (EN)](https://github.com/ricky8848/free-mobile-ai/releases/download/v1.0.0/paper-technical-report-en.pdf) |
| 🇰🇷 **한국어** | [README](docs/README.ko.md) | — | [⬇ Download (EN)](https://github.com/ricky8848/free-mobile-ai/releases/download/v1.0.0/paper-technical-report-en.pdf) |

---

## What is this?

**free mobile ai** is a zero-install tunnel-as-a-service. You run **one command** on your home computer, and it becomes reachable from any phone or browser over the internet — through a secure Cloudflare tunnel. No port forwarding, no router configuration, no client app on your phone.

The default use case is the **DeepSeek Harness (DSH) Web GUI**: a single URL gives you full access to your home computer's AI toolchain (DeepSeek Harness / Codex / OpenClaw) from any mobile browser. But it works with **any local HTTP service** — your home server, a self-hosted app, a development environment.

### Design Principles

| # | Property | What it means for you |
|---|----------|----------------------|
| (a) | **Zero install** (user side) | One `curl \| bash` command. That's it. |
| (b) | **Zero apps** (consumer side) | Your phone just opens a URL in its browser. No app store. |
| (c) | **Zero traffic retention** (platform side) | The control plane never sees, decrypts, or stores your data. |
| (d) | **Revocable credentials** | Your URL *is* your key. Rotate it = revoke access instantly. |
| (e) | **No-code auth** | Your machine code *is* your identity. No one-time codes, no email verification to activate. |

---

## Quick Start (3 steps)

### 1. Run the installer on your home computer

```sh
# macOS / Linux
curl -fsSL https://dsh.newapi.email/mai/i.sh | bash

# Windows PowerShell
irm https://dsh.newapi.email/mai/i.ps1 | iex
```

The script downloads `cloudflared` (SHA-256 verified) and opens a local console in your browser.

### 2. Activate (one click)

In the local console:
- **Service address**: `127.0.0.1:3080` (default = DSH Web GUI). Change to any `host:port`.
- Click **Start Tunnel**.

Your machine code is auto-detected. No auth code needed — the machine *is* the identity.

### 3. Open your URL on your phone

You'll see a unique URL like `https://x7k2m9.newapi.email`. Open it in any phone browser. Done.

---

## Features (v1.0)

| Feature | ID | Description |
|---------|-----|-------------|
| No-code auto-auth | **L1** | Machine code = identity. Idempotent activation, no one-time codes. |
| Local multiplexer | **L2** | One tunnel, multiple tools (`/t/<name>` or `?tool=<name>`). Zero extra tunnels. |
| Online-time tracking | **T1** | 30s heartbeat, cumulative online time, lifecycle awareness. |
| Tool presets + admin UX | **T2** | Per-binding tool registry, real-time visibility in admin panel. |
| Alias (A1) | **A1** | Friendly names for your bindings. |
| Referral attribution | **X9** | Optional `ref` parameter on activate; admin stats aggregate Top N. |

---

## Architecture (one line)

```
Phone browser ──HTTPS──▶ Cloudflare Edge (TLS terminate + forward only)
                              │
                    ┌─────────▼────────┐
                    │ Your computer     │ ← cloudflared outbound (no public IP needed)
                    ├──────────────────┤
                    │ mux :5380        │   /t/<name> → 127.0.0.1:<port>
                    │ DSH :3080        │   default tool
                    └──────────────────┘
```

- **Control plane** (Node.js + SQLite): machine-code registration, binding management, heartbeat liveness, online-time tracking. Does NOT proxy business traffic.
- **Data plane** (your machine): cloudflared + local mux. Cloudflare edge only terminates TLS and forwards bytes.

See [docs/paper.md](docs/paper.md) for the full design and security analysis.

---

## Security Model (capability-based)

- **URL-as-credential**: Your random subdomain URL *is* the access credential. High entropy, unguessable.
- **Rotation = revocation**: Rotating your URL makes the old one dead instantly (DNS/ingress change). No session tokens to invalidate.
- **Machine binding**: Single-machine policy (one authorized computer). Wrong machine → heartbeat revocation.
- **Zero retention**: The control plane holds only binding metadata (machine code, subdomain, status). Never request/response bodies.

Read the full paper: [docs/paper.md](docs/paper.md) (Chinese + English)

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/GUIDE.md](docs/GUIDE.md) | **Complete user guide** (setup, daily use, troubleshooting, FAQ) — multilingual |
| [docs/paper.md](docs/paper.md) | **Research paper** (Chinese): design, security model, capacity analysis, trade-offs |
| [docs/paper-en.md](docs/paper-en.md) | **Research paper** (English): same content, English |
| [docs/paper.pdf](docs/paper.pdf) | Paper (Chinese), LaTeX typeset, 8 pages |
| [docs/paper-en.pdf](docs/paper-en.pdf) | Paper (English), LaTeX typeset, 8 pages |
| [docs/CAPACITY.md](docs/CAPACITY.md) | Capacity analysis (Cloudflare free-plan limits) |
| [SECURITY.md](SECURITY.md) | Security model, threat assumptions, known boundaries |

---

## Requirements

| Component | Requirement |
|-----------|-------------|
| Home computer | macOS / Linux / Windows, **Node.js ≥ 18** (i.sh auto-installs if missing) |
| Phone / consumer device | Any modern browser (Safari, Chrome, Edge). No app needed. |
| Network | Outbound HTTPS only (443). No inbound ports, no port forwarding. |
| Cloudflare account | Free plan sufficient (tunnel + DNS). The control plane handles tunnel creation via API. |

---

## License

[MIT](LICENSE) — Copyright (c) 2026 ricky8848

---

## Project Status

**v1.0 (2026-09)** — In production on `newapi.email`.

| Version | Milestone |
|---------|-----------|
| v0.4 | One-click installer, local console, magic-link portal, DSH default tool |
| v0.5 | Edge WS fix, tool presets, capacity analysis paper (v0.5 baseline) |
| **v1.0** | No-code auth (L1), local mux multi-tool (L2), telemetry (T1/T2), alias (A1), referral (X9) |

---

## Contributing & Contact

- Issues: GitHub → Issues
- Support: ricky8848@outlook.com (include your machine code)
- Paper discussion: see [docs/paper.md](docs/paper.md) §7 (Discussion & Limitations)
