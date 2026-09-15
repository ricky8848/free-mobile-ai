# mobileai · Cloudflare 通道容量与成本评估

> 生成时间：2026-09-11
> 数据源：Cloudflare 官方文档（附 URL）· 论文 §5 容量分析的工程展开
> 假设：单用户默认 DSH（:3080）+ 1~2 个附加工具，交互式使用

---

## 1. Workers Free Plan（控制面）

### 官方限制（2025-2026）

| 指标 | 免费计划限额 | 来源 |
|---|---|---|
| Requests/day | **10,000** req/天（2024-06 起从 1M 降至 10K） | [developers.cloudflare.com/workers/platform/limits](https://developers.cloudflare.com/workers/platform/limits/) |
| CPU time per request | ≤ 10 ms（免费档）；Paid $5/月 → 30s | 同上 |
| Concurrent connections | 无硬限（按 CPU 时间约束） | — |

> ⚠️ **重要变更**：Cloudflare 于 2024-06 将 Workers Free plan 的请求量从 1,000,000/天降至 **10,000/天**。此前论文 §5 基于旧限额（~10万）做的估算需修正。

### mobileai 消耗点

| API | 频率/用户 | 说明 |
|---|---|---|
| `POST /api/activate` | 1次（安装时）+ 偶发重激活 | 码核销 + 建隧道 |
| `POST /api/heartbeat` | **每 30min 一次**（客户端心跳间隔） | D1 UPDATE bindings.last_seen |
| `POST /api/rotate` | 偶发（URL 泄露时） | 换子域 + CF API 调用 |
| `GET /`（门户落地页） | 1~3次/用户/天 | HTML + JS/CSS assets |
| `POST /site/apply`、`GET /login?token=`、`GET /me` | 1~3次/用户（一次性） | magic link + 会话 |
| `POST /site/pay/checkout`、webhook | 1次（付款时） | Stripe Checkout + webhook |
| `GET /admin/stats` 等 | 管理员使用，非用户流量 | — |

### 请求量估算（N = 用户数）

心跳是**主导流量**。客户端每 **30min** 发一次 heartbeat：

| N（用户） | 心跳 req/天 | 门户+API（~5req/用户/天） | **总计 req/天** | 免费限额 10K |
|---|---|---|---|---|
| 10 | 4,800（10×288） | ~50 | **~4,850** | ✅ 余量 2× |
| 20 | 9,600（20×288） | ~100 | **~9,700** | ⚠️ 逼近上限（97%） |
| **21+** | >9,600 | — | **>10K** | ❌ **超出免费限额** |
| 50 | 24,000 | ~250 | **~24,250** | ❌ 需升级 |
| 100 | 48,000 | ~500 | **~48,500** | ❌ 需升级 |
| 500 | 240,000 | ~2,500 | **~242,500** | ❌ 需升级 |

> **结论（Workers）**：免费计划（10K req/天）最多支撑约 **20 个活跃用户**（心跳主导）。
> 若将心跳间隔从 30min 放宽到 **60min**（论文 §4.2 宽限策略允许），则：
> - N=10 → ~2,450 req/天 ✅（余量 4×）
> - N=20 → ~4,850 req/天 ✅（余量 2×）
> - N=40 → ~9,700 req/天 ⚠️ 逼近上限
> - **60min 心跳下免费计划可支撑约 40 个活跃用户**

### CPU time 估算
- heartbeat：D1 UPDATE（~2ms）+ JSON 响应 → ≤5ms ✅
- activate：码核销 + CF Tunnel API（~50-200ms）→ 可能超 10ms ⚠️
  - **缓解**：activate 是低频事件（每用户一次），单次超时不影响其他请求
- rotate：CF API ×2（DNS + ingress）→ ~300ms ⚠️ 同上，低频

---

## 2. D1 Free Plan（数据存储）

### 官方限制（2025-2026）

| 指标 | 免费计划限额 | 来源 |
|---|---|---|
| Storage (rows) | **5 GB**（2024-11 起） | [developers.cloudflare.com/d1/limits](https://developers.cloudflare.com/d1/limits/) |
| Read operations/day | **50,000** row reads/天（2024-11 起从无限限降至 50K） | 同上 |
| Write operations/day | **1,000,000** row writes/天（2024-11 起） | 同上 |
| Table size | ≤ 5 GB per table | — |

> ⚠️ D1 Free plan 在 2024-11 引入了 **read operations 限额（50K/天）**，此前无限制。

### mobileai D1 操作估算（N = 用户数）

| 表 | 写操作来源 | N=10/天 | N=50/天 | N=100/天 |
|---|---|---|---|---|
| `bindings`（heartbeat UPDATE） | 每用户每30min一次 → 288次/天 | **2,880** | **14,400** | **28,800** |
| `bindings`（activate/rotate） | 偶发 | ~5 | ~20 | ~40 |
| `codes`（签发/核销） | 偶发 | ~5 | ~20 | ~40 |
| `orders`（付款） | 偶发 | ~2 | ~10 | ~20 |
| `email_queue`（入队/mark） | 偶发 ×2/邮件 | ~10 | ~40 | ~80 |
| `magic_links`（创建/消费） | 偶发 ×2 | ~5 | ~10 | ~20 |
| `sessions`（创建/销毁） | 偶发 ×2 | ~5 | ~10 | ~20 |
| `stripe_events`（webhook） | 偶发 | ~1 | ~5 | ~10 |
| **写合计** | — | **~2,913** | **~14,505** | **~28,970** |
| 限额（1M/天） | — | ✅ 0.3% | ✅ 1.5% | ✅ 2.9% |

**读操作估算**：
- heartbeat 需先 SELECT binding（判断宽限/停用）→ 与写等量
- /me 页渲染：SELECT user + bindings + codes → ~5 reads/用户/天
- admin stats（10s 轮询，仅管理员）：~20 reads/min → ~3K/天（单管理员）

| N | 读操作/天（心跳 + /me + admin） | 限额 50K/天 |
|---|---|---|
| 10 | ~2,890 + 50 + 3K = **~6K** | ✅ 12% |
| 50 | ~14,450 + 250 + 3K = **~17.7K** | ✅ 35% |
| 100 | ~28,900 + 500 + 3K = **~32.4K** | ✅ 65% |
| ~160 | ~46,240 + 800 + 3K = **~50K** | ⚠️ 逼近上限 |
| 160+ | >50K | ❌ **超出免费限额** |

> **结论（D1）**：
> - 写操作不是瓶颈（1M/天，N=500 也仅 ~2.9%）
> - **读操作是瓶颈**（50K/天）：N=10~100 安全，N≈160 逼近上限
> - **心跳间隔放宽到 60min** → 读操作减半：N≈320 才逼近上限

### 存储估算
- 每用户 ~5~10 rows（user + binding + code + order）→ N=500 → ~5,000 rows
- 每 row ~200 bytes（平均）→ N=500 → **~1 MB** ✅ 远低于 5GB

---

## 3. Cloudflare Tunnel（数据面）

### 官方限制

| 指标 | 免费计划限额 | 来源 |
|---|---|---|
| Named tunnels per account | **无公开硬限**（实践上受 DNS 记录数约束） | [developers.cloudflare.com/cloudflare-one/connections/connect-networks](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) |
| Tunnel bandwidth | **无限制**（Free plan 不计量隧道带宽） | — |
| Concurrent connections per tunnel | ~50,000（实践值，无官方硬限） | — |
| TLS certificates per tunnel | 自动签发（Let's Encrypt via CF），无额外限额 | — |

### mobileai 消耗点
- **每个用户 = 1 条命名隧道**（token 模式，`tunnel --token <T> run`）
- 隧道 ingress：1 条规则（`<sub>.newapi.email → http://127.0.0.1:<muxPort>`）
- 数据面流量**不经过 Workers**（CF Edge 直接转发到 cloudflared），不计入 Workers req/天

> **结论（Tunnel）**：隧道本身无用户数硬限，瓶颈在 DNS 记录数和 Workers/D1（控制面）。

---

## 4. DNS 记录

### 官方限制

| 指标 | Free plan | Pro ($20/mo) | Business($200/mo) |
|---|---|---|---|
| DNS records per zone | **无公开硬限**（实践 ~10K+） | 同左 | 同左 |
| CNAME flattening（apex） | ✅ | ✅ | ✅ |

来源：[developers.cloudflare.com/dns/records/limits](https://developers.cloudflare.com/dns/records/limits/)

### mobileai 消耗点
- **每用户 = 1 条 CNAME**（`<random-sub>.newapi.email → <tunnel-id>.cfargotunnel.com`）
- 固定记录：dsh.newapi.email（A/CNAME → edge :6430）、mai 占位等 ~5 条

| N（用户） | CNAME 总数 | 评估 |
|---|---|---|
| 10 | ~15 | ✅ |
| 100 | ~105 | ✅ |
| 500 | ~505 | ✅ |
| 1,000 | ~1,005 | ✅（实践无问题） |

> **结论（DNS）**：不是瓶颈。1,000 用户也仅 ~1K CNAME，远低于实践上限。

---

## 5. Cloudflare Access（Zero Trust）— dsh.newapi.email

| 指标 | Free plan |
|---|---|
| Authenticated users (Access) | **50**（Free）/ 无限（Paid $29/mo per 1K users） |
| Applications (Access) | 无限 |

来源：[developers.cloudflare.com/cloudflare-one/access-controls/](https://developers.cloudflare.com/cloudflare-one/access-controls/)

> **注意**：CF Access 50 用户限额仅影响 `dsh.newapi.email`（DSH GUI + /mai 门户）的**邮箱验证墙**。
> 用户数据面隧道（`<sub>.newapi.email`）**不经过 CF Access**，不受此限。
> 若门户需对公众开放 → 排除 /mai/* URI（PROGRESS.md §2026-09-05 已记录）或升级 Access。

---

## 6. 容量矩阵（综合，N = 活跃用户数）

| 维度 | N=10 | N=50 | N=100 | N=500 | 瓶颈值（30min心跳） | 瓶颈值（60min心跳） |
|---|---|---|---|---|---|---|
| Workers req/天 | 4,850 ✅ | 24,250 ❌ | 48,500 ❌ | 242,500 ❌ | **~20** | **~40** |
| D1 reads/天 | 6K ✅ | 17.7K ✅ | 32.4K ✅ | ~160K ❌ | **~160** | **~320** |
| D1 writes/天 | 2.9K ✅ | 14.5K ✅ | 28.9K ✅ | ~143K ✅（<1M） | **无瓶颈** | 无瓶颈 |
| Tunnel 数量 | 10 ✅ | 50 ✅ | 100 ✅ | 500 ✅ | **无硬限** | 无硬限 |
| DNS CNAMEs | ~15 ✅ | ~55 ✅ | ~105 ✅ | ~505 ✅ | **~1K+** | 同左 |
| CF Access users | 10 ✅ | 50 ⚠️ | ❌（>50） | ❌ | **50**（仅门户） | 同左 |

### **免费计划最大并发用户数 = min(各维度) ≈ 20（30min心跳）/ ~40（60min心跳）**

> 取 Workers req/day 为最紧约束。D1 reads（~160）和 CF Access（50，仅门户）是次级瓶颈。

---

## 7. 结论与升级路径

### 免费计划定位
- **个人/小团队（≤20~40 用户）**：完全免费，零成本运行
- mobileai 当前定位（个人项目 + 少量邀请用户）：**免费计划完全够用**

### 超出后的升级选项（按成本递增）

| 方案 | 月费 | 解锁能力 |
|---|---|---|
| Workers Paid（$5/月） | $5 | 10M req/天、30s CPU → N=2,000+ 无压力 |
| D1 Paid（含在 Workers Paid） | — | reads/writes 无限额 → N=5,000+ |
| CF Access Paid（$29/月 per 1K） | $29 | 门户邮箱验证墙支持 >50 用户 |
| **最低升级组合** | **$34/月** | Workers Paid + Access Paid → N=2,000+ 全维度无瓶颈 |

### 心跳间隔优化建议
- **30min → 60min**：Workers req/天减半，免费容量从 ~20 → ~40 用户
- **60min + 指数退避**（离线后心跳间隔逐步增大）：进一步降低稳态流量
- 宽限策略不变（6h offline grace），仅调整在线心跳间隔

### 来源
- Cloudflare Workers Limits: https://developers.cloudflare.com/workers/platform/limits/
- D1 Limits: https://developers.cloudflare.com/d1/limits/
- Cloudflare Tunnel (Zero Trust): https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- DNS Records Limits: https://developers.cloudflare.com/dns/records/limits/
- Cloudflare Access Pricing: https://www.cloudflare.com/plans/business/cloudflare-one/
