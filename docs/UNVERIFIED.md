# Unverified

## Instagram insights permission
Added to Meta Login config + app permissions: `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list`. Live `/insights` returns metrics for `@jinbandhan` (zeros while the account has no posts/followers). Some metrics still need 100+ followers. OAuth reconnect from `localhost` can hit `invalid_state` when the callback host is the Cloudflare tunnel — start connect from the tunnel origin so the state cookie matches.

## Phase 0 POC — live token upsert
OAuth authorize + Meta consent UI verified 2026-11-06. Encrypted `ig_accounts` row not written yet: Hyperprofile business portfolio has zero Instagram Pro accounts. Needs link + Instagram Tester role, then re-run `/connect`.

## Meta — Unified Login vs Instagram Login scopes
Confirm current permission names for Unified Login (`instagram_basic` vs `instagram_business_*`) against live Meta docs before App Review. Dashboard listed `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments` on the template config.

## Meta — Long-lived token refresh for Unified Login
Hourly job tries `fb_exchange_token` (+ `set_token_expires_in_60_days`) then `ig_refresh_token`. Non-expiring system-user tokens (null `token_expires_at`) are skipped after first successful subscribe. Confirm which lifetime your Login config issues against a live refresh before relying on production continuity.

## Payments — Razorpay Route marketplace approval
Live bank transfers and linked accounts via Razorpay Route require approved marketplace onboarding and Indian business KYC. Offline integration tests run against `MockPaymentProvider` and cryptographic HMAC-SHA256 signature fixtures.

## Payments — NPCI UPI merchant discount above ₹2,000
NPCI proposed a 0.4% fee above ₹2,000 capped at ₹300, which was deferred. Fee handling is configurable via `options.upiDiscountAbove2000` in `calculateGatewayFee` and tested for both bands.

## Compliance — TDS / GST marketplace obligations
Ledger designed with extensible account heads for TDS (Section 194-O) and TCS; formal CA review required before launching live marketplace payouts.
