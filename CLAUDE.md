# Hyperprofile

Creator commerce platform for Indian creators (SuperProfile-style). Build in phases; stop after each phase.

## Decisions (locked)
- Product: Hyperprofile
- Launch: regional-language creators/coaches; EN + HI
- Payments: Razorpay Route marketplace (fallback BYO gateway)
- Hosting target: Vercel web, Fly/Railway workers, Neon Postgres
- Plans: Free 4%, Creator ₹399 (0%), Studio ₹1,499
- Meta: **Unified Login** (new apps cannot use classic Instagram Login setup)

## Non-negotiables
Official Meta APIs only; never hold customer money; append-only ledger in paise; idempotent webhooks; secrets encrypted at rest; verify before claiming; small tested commits.

## Phase gate
After each phase: report with section 14 template from the master prompt, then wait for go.
