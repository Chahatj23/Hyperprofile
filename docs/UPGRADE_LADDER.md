# Hyperprofile Upgrade Ladder

> **Core Philosophy:** Run on free tiers during the validation stage (first 100 to 300 active creators). Upgrade only when real usage forces it.
> **The Golden Rule:** Upgrade the single component that is hurting, not everything at once. Every row below is independent.

---

## Upgrade Triggers & Action Plan

| Trigger / Metric | Threshold | Action to Take | Cost Impact |
| :--- | :--- | :--- | :--- |
| **Day 0 Launch** | Pre-launch | Purchase domain (`.bio` / `.com`), configure Cloudflare DNS proxy, set billing budget alerts. | Small and unavoidable. |
| **Cloudflare Workers / Edge Requests** | > 80,000 requests/day OR CPU limit errors (10ms limit) | Upgrade to **Cloudflare Workers Paid Plan**. Increases CPU to 50ms per request and gives 10M requests/month. | \$5/month per Cloudflare pricing. |
| **Cloudflare R2 Storage** | > 8 GB stored objects | Continue on R2 and pay storage overages. Egress remains 100% free with zero transfer fees. | \$0.015 per GB-month over 10 GB. |
| **Neon Postgres Storage or Compute** | Storage > 400 MB (80% of 0.5GB tier) OR compute hours > 80 hrs/mo OR point-in-time recovery required | Upgrade from Neon Free to **Neon Launch / Scale Plan** or provision dedicated database capacity. | Variable usage-based (check current Neon pricing). |
| **Webhook Cold Starts** | P95 acknowledgement latency > 2.5s causing Meta webhook retry storms or timeouts | **Option 1 (Stack B):** Deploy lightweight Cloudflare Worker receiver to acknowledge instantly and queue to Neon.<br>**Option 2:** Configure minimum 1 warm instance (`min-instances=1`) on Google Cloud Run. | Cloud Run warm instance: ~\$5–\$12/month. Worker: free within 100k req/day. |
| **Cloud Run Invocations** | > 1.4M requests/month (> 70% of free 2M monthly tier) | Increase Cloud Run quota or transition to paid container tier with automatic concurrency scaling. | Pay-as-you-go per vCPU-second and request. |
| **AutoDM Queue Backlog** | Queue age > 2 minutes regularly during viral Reel comment bursts | Replace PostgreSQL `SKIP LOCKED` job queue with managed **Redis (Upstash/Aiven) + BullMQ** workers. | Redis free tier (~500k commands) or ~\$5–\$10/month. |
| **Live Payment Transaction Volume** | Sustained creator sales (> ₹5,00,000/mo) | 1. Book formal external independent penetration test.<br>2. Chartered Accountant (CA) compliance & tax sign-off (GST/TDS 194-O).<br>3. Upgrade Sentry and observability to paid tier. | One-time security audit + ongoing CA compliance fees. |
| **Scale Milestone (~1,000 Creators)** | ~1,000 active creators OR enterprise SLA commitments | Move to full **Production Multi-AZ Architecture**: Multi-AZ Postgres with read replicas, dedicated Redis clusters, isolated worker fleets, AWS KMS key rotation, enterprise CDN. | Refer to System Design Specification. |

---

## Zero-Cost Guardrails & Capacity Overview

| Layer | Free Provider & Tier | Allocation / Month | Capacity Estimate |
| :--- | :--- | :--- | :--- |
| **DNS, CDN, Edge Cache** | Cloudflare Free | Unlimited cached bandwidth, edge SSL, DDoS protection | Tens of thousands of creator page views per day. |
| **App Runtime** | Google Cloud Run (Mumbai) | 2,000,000 requests, 360,000 GiB-seconds, 180,000 vCPU-seconds | ~60,000 requests/day (~100–300 active creators). |
| **Primary Database** | Neon PostgreSQL Free | Scale-to-zero compute (5 min idle), 0.5–1 GB storage | Years of ledger & orders; raw events rolled up daily. |
| **File Storage** | Cloudflare R2 | 10 GB storage, 1M writes, 10M reads, 0 egress | Hundreds of digital products and invoices. |
| **Scheduled Tasks** | Cloudflare Cron Triggers | 5 free cron triggers calling signed HMAC internal endpoints | Triggers every 30+ minutes; keeps DB asleep between runs. |
| **Transactional Email** | Brevo (v3 REST API) | 300 free emails / day (zero domain locking) | OTP codes and purchase receipts. |
| **CI/CD & Backups** | GitHub Actions | 2,000 free runner minutes / month | PR test suites + nightly encrypted `pg_dump` to R2. |

---

## Alert Thresholds & Automated Circuit Breakers

1. **Storage Budget:** Keep total PostgreSQL database size under **400 MB**. Raw page views and event logs older than 30 days are rolled up into daily aggregates and purged.
2. **Per-Account Daily Webhook Cap:** If a creator's Reel goes viral and exceeds **5,000 webhooks in 24 hours**, non-essential comment ingestion is throttled to prevent consuming the monthly Cloud Run allowance.
3. **Emergency Kill Switches:**
   - `PAUSE_AUTODM`: Instantly halts Meta private-reply dispatches.
   - `PAUSE_SIGNUPS`: Prevents new account registration bursts.
   - `PAUSE_CHECKOUT`: Temporarily holds new checkout sessions if gateway or bank rails experience incidents.
4. **Daily Health & Budget Report:** Cloudflare cron invokes `/v1/jobs/usage-report` daily, emitting alerts if storage, requests, or compute exceed 70% of quota.
