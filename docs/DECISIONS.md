# Decisions

## 2026-11-06 — Product name
**Decision:** Product is **Hyperprofile**.  
**Why:** User choice.

## 2026-11-06 — Meta auth path
**Decision:** Use **Instagram API with Unified Login** (Facebook Login for Business + `config_id`), not classic Instagram Login OAuth at `instagram.com/oauth/authorize`.  
**Why:** Meta dashboard states Instagram Login API setup is unavailable for newer apps. Credentials used are Meta App ID/Secret + Login configuration ID.  
**Consequence:** Token exchange hits `graph.facebook.com/.../oauth/access_token`. Profile resolution walks Pages → `instagram_business_account`, with Instagram Graph `/me` fallback.

## 2026-11-06 — ORM
**Decision:** Drizzle ORM + `postgres` driver.  
**Why:** Lightweight TypeScript-first migrations; easy append-only ledger later.

## 2026-11-06 — Local HTTPS for OAuth
**Decision:** Cloudflare `cloudflared` quick tunnel for Meta redirect URIs.  
**Why:** Meta requires HTTPS redirect URLs; localhost HTTP is rejected.

## 2026-11-06 — Monorepo layout
**Decision:** pnpm workspaces with `apps/web`, `apps/api`, `apps/worker`, `packages/{db,shared,meta,payments}`.  
**Why:** Matches master build prompt; boring and scalable.

## 2026-11-07 — AutoDM reference port
**Decision:** Keep `reference/ig-autodm` as the source of truth for Meta AutoDM invariants; port into `packages/meta` + `apps/api` + `apps/worker` one piece at a time (schema → Meta client → webhooks → queue → rules UI).  
**Why:** User provided the reference zip; master prompt says reuse rather than rewrite. Unified Login tokens stay as already implemented — do not switch back to classic Instagram Login OAuth.

## 2026-11-07 — Double-entry append-only ledger in paise
**Decision:** All monetary transactions (buyer payments, gateway fees, GST on fees, platform fees, creator payables, refunds) are written as immutable double-entry ledger rows in paise. In double entry, Sum(Debits) === Sum(Credits). Never update or delete ledger rows; refunds are posted as reversing entries. Every entry has a deterministic unique idempotency key.
**Why:** Master prompt non-negotiable rule 3 & 4. Proves financial balance and prevents reconciliation mismatches.

## 2026-11-07 — UPI-first checkout and mock/live dual provider
**Decision:** Provide `PaymentProvider` interface with both `RazorpayRouteProvider` and `MockPaymentProvider`. The checkout UI prioritizes mobile UPI Intent (`upi://pay`) and desktop UPI QR code, while supporting card/netbanking.
**Why:** Indian creator commerce converts over 80% on UPI. Mock provider enables offline testing, integration tests, and UI testing without needing live sandbox bank credentials.

## 2026-11-07 — Financial year gap-free tax invoices
**Decision:** Invoices generated with format `INV-YYYYYY-NNNNN` tied to Indian fiscal calendar (April to March) with atomic sequence counter and full CGST/SGST/IGST breakdown.
**Why:** Mandatory for Indian GST compliance and merchant accounting.

## 2026-11-07 — DPDP compliance and personal data anonymization
**Decision:** Buyer deletion requests anonymize personal identifiers (`name`, `email`, `phone`) while retaining immutable order IDs and ledger postings.
**Why:** Satisfies India's Digital Personal Data Protection Act (DPDP) while maintaining legal accounting and financial ledger continuity.

## 2026-11-07 — Payment Webhook Inbox & Database Unique Constraints
**Decision:** All payment webhooks (`/webhooks/payments`, `/webhooks/razorpay`) are received, cryptographically verified with constant-time byte comparisons, recorded first in `webhook_inbox` with unique constraint `(provider, event_id)`, acknowledged immediately, and processed idempotently. Database unique constraints were added on `orders.gateway_order_id`, `invoices.order_id`, and `entitlements.order_id` to guarantee that concurrent payment confirmations or webhook replays never produce duplicate entitlements, invoices, or ledger entries.
**Why:** Non-negotiable rule 4 (Idempotency everywhere enforced via database constraints, not just code checks).

## 2026-11-07 — Internal Admin Platform & Moderation Suite
**Decision:** Added administrative control plane (`/v1/admin/creators`, `/v1/admin/creators/:id/kyc`, `/v1/admin/orders`, `/v1/admin/payouts`, `/v1/admin/takedown`, `/v1/admin/audit-logs`, `/v1/admin/feature-flags`) protected by admin secret token.
**Why:** Section 3.3 requirement for platform compliance, takedown of reported pages/products, and feature flag management.

## 2026-11-07 — Plan-Aware AutoDM Attribution Footer & 1000-Byte Guard
**Decision:** AutoDM message generation appends an attribution footer (`\n\nSent via Hyperprofile`) for Free plan creators and omits it for paid plans (Creator/Studio). Enforced a strict 1000 UTF-8 bytes ceiling before message dispatch to satisfy Meta's private-reply character limits.
**Why:** Section 4 requirement.
