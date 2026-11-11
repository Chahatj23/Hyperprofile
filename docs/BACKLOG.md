# Backlog

## Open
- [x] Live Instagram OAuth upsert (`@jinbandhan`)
- [x] Insights UI (`/insights`) + `instagram_manage_insights` on Login config
- [x] Copy `reference/ig-autodm` + AutoDM schema (`automation_rules` / `automation_events` / `link_clicks`)
- [x] AutoDM step 2: Meta client (error classify, private reply, subscribe) in `packages/meta`
- [x] AutoDM step 3: Webhook GET verify + POST HMAC → `webhook_inbox`
- [x] AutoDM step 4: Claim + enqueue + send worker (700/hr, never drop)
- [x] AutoDM step 5: Rules API + click redirect `/r/:id`
- [x] AutoDM step 6: Token refresh job + deauth/data-deletion endpoints
- [x] Named Cloudflare tunnel / custom domain (stable redirect URL)
- [x] Phase 1: email OTP sessions, public `/[slug]` ISR pages
- [x] Phase 2: Page builder, mobile preview, block types, themes, draft/publish audit log
- [x] Phase 3: Products CRUD (4 types), UPI-first checkout, append-only double-entry ledger, refunds, buyer digital library
- [x] Phase 4: AutoDM rules dashboard, test mode simulator, delivery diagnostics log
- [x] Phase 5: Plans (Free/Creator/Studio), FY gap-free tax invoices, first-party analytics pipeline
- [x] Phase 6: DPDP compliance, data export & deletion flows, abuse reporting, CSP & rate limits
- [x] Admin control plane (Section 3.3): creator list, KYC review, order/payout search, takedown tool, audit log viewer, feature flags
- [x] Payment webhooks inbox (`/webhooks/payments`, `/webhooks/razorpay`) with idempotent order finalization & replay rejection
- [x] Database unique constraints on `orders.gateway_order_id`, `invoices.order_id`, and `entitlements.order_id`
- [x] Digital product file download GET endpoint with attachment streaming
- [x] AutoDM Free plan attribution footer & 1000 UTF-8 bytes ceiling guard
- [x] Instagram Reels integration & Visual Reel Picker grid for AutoDM rules (/v1/ig/reels, /v1/ig/media)

## Issues from TODOs
- None yet beyond phase plan.
