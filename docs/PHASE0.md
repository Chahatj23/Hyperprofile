# Phase 0 report — Hyperprofile

**Date:** 2026-11-06  
**Status:** Foundations complete. Live OAuth start → Meta consent verified. Token upsert blocked until an Instagram Pro account is linked.

## Delivered

| Item | Status |
|------|--------|
| pnpm monorepo (`apps/web\|api\|worker`, `packages/db\|shared\|meta\|payments`) | Done |
| Docker Compose (Postgres, Redis, Mailcatcher) | Healthy |
| Drizzle migrations + seed + reserved slugs | Done |
| Env validation (Zod) + structured JSON logs | Done |
| AES-256-GCM token helpers + unit tests | Done |
| Meta Unified Login client (`config_id`) | Done |
| Mock payment provider stub | Done |
| CI workflow | Present |
| docs: DECISIONS / UNVERIFIED / BACKLOG / CLAUDE.md | Done |

## Verification

- `pnpm typecheck` — pass
- `pnpm --filter @hyperprofile/{api,web} build` — pass
- `packages/shared` + `packages/db` tests — pass
- `GET /health` (api :4000 and via Next rewrite) — `{"ok":true,"phase":0}`
- Worker — Redis heartbeat online
- Tunnel — `https://months-most-prepare-rider.trycloudflare.com` → :3000
- `/connect` — 200
- `GET /v1/auth/instagram/start` — 302 to Facebook Login for Business with correct `redirect_uri` + `config_id=1131117443101525`
- Meta dashboard redirect URI updated to current tunnel callback

## POC (Instagram Unified Login)

**Verified end-to-end through authorize + consent UI.**

1. Open tunnel `/connect` → Continue with Instagram  
2. Meta Business login (Chahat Jain)  
3. Asset picker for Hyperportfolio **Hyperprofile**  
4. **Blocker:** no Instagram Pro account on the portfolio → Next disabled  
5. Business Suite → Instagram accounts → Add opens Instagram login  

**Not yet:** code exchange → encrypt → `ig_accounts` upsert (needs a professional IG account logged in / linked, then re-run `/connect`).

## Meta app (dev mode)

- App ID: `2808976552852144`
- Business: `2654567394963774`
- Login config: `1131117443101525`
- Redirect: `https://months-most-prepare-rider.trycloudflare.com/api/auth/instagram/callback`

## Risks / notes

- Cloudflare quick tunnels rotate on restart → update Meta + `.env` each time (or use a named tunnel).
- New Meta apps cannot use classic Instagram Login; Unified Login only (recorded in DECISIONS).
- Quick tunnel URL is temporary; do not hardcode in production configs.

## Unblock POC (manual, ~5 min)

1. Convert/create an Instagram **Creator or Business** account.  
2. Link it under Business Suite → Settings → Instagram accounts for Hyperprofile.  
3. Add that account as **Instagram Tester** on the Meta app (Roles).  
4. Re-open tunnel `/connect` and finish consent → expect `?ok=1&username=…` and a row in `/v1/ig/accounts` (token never returned).
