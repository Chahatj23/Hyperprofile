# Hyperprofile

Creator commerce for Indian creators — link-in-bio, UPI checkout, Instagram AutoDM.

## Phase 0

Monorepo foundations + Instagram Unified Login POC.

### Prerequisites
- Node 22+, pnpm 9
- Docker Desktop running

### Setup

```bash
pnpm install
cp .env.example .env   # or use existing .env with Meta keys
pnpm docker:up
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:4000/health
- Mailcatcher: http://localhost:1080

### Instagram POC
1. Keep `cloudflared tunnel --url http://localhost:3000` running
2. Ensure Meta redirect matches `META_REDIRECT_URI` (and Business Suite has an IG Pro account on portfolio Hyperprofile)
3. Add that IG account as Instagram Tester on the Meta app
4. Open the tunnel `/connect` URL (not bare localhost — Meta requires the HTTPS redirect host)

See `docs/PHASE0.md` for the Phase 0 verification report.
