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

---

# Zero-Cost Launch Free-Tier Verification Registry (Recorded 17 November 2026)

*Note: Free-tier terms change often and several sources below are third-party summaries. Anything listed must be re-confirmed on the provider's first-party pricing page before public production launch.*

### 1. Google Cloud Run (Compute Runtime)
- **Claimed Free Tier:** 2,000,000 requests/month, 360,000 GiB-seconds memory, 180,000 vCPU-seconds compute, with scale-to-zero capability.
- **Source:** Google Cloud Run pricing documentation & architecture decision records (checked mid-November 2026).
- **Items to Verify Before Launch:**
  - [ ] Confirm whether free monthly tier applies specifically to Mumbai region (`asia-south1`).
  - [ ] Verify outbound egress charges when communicating with external Neon database and Meta Graph API.
  - [ ] Measure cold-start latency from scale-to-zero for webhook ingestion.

### 2. Neon PostgreSQL (Primary Serverless Database)
- **Claimed Free Tier:** Scales to zero after 5 minutes idle; wakes in <500ms; 0.5 GB to 1.0 GB storage allowance; ~100 compute-hours/month.
- **Source:** Neon.tech documentation (checked November 2026).
- **Items to Verify Before Launch:**
  - [ ] Verify whether active storage cap is 0.5 GB or 1.0 GB on current project tier.
  - [ ] Verify exact point-in-time recovery (PITR) history window on free tier.
  - [ ] Verify connection pooling limit (Neon PgBouncer pooler endpoint vs direct).

### 3. Cloudflare (DNS, Edge CDN, R2 Storage, Cron Triggers)
- **Claimed Free Tier:**
  - Unlimited CDN bandwidth & edge caching.
  - Workers: 100,000 requests/day, 10ms CPU execution ceiling.
  - Cron Triggers: 5 scheduled cron triggers included.
  - R2 Object Storage: 10 GB storage, 1,000,000 Class A operations (writes), 10,000,000 Class B operations (reads), 0 egress fees.
  - Commercial use permitted on Cloudflare Pages and standard reverse proxy.
- **Source:** Cloudflare Pricing & Developer Platform Docs (checked November 2026).
- **Items to Verify Before Launch:**
  - [ ] Verify card-on-file spending notification threshold in Cloudflare dashboard.
  - [ ] Confirm Cloudflare Cache Purge API token permissions for automated publish invalidation.

### 4. Brevo (Transactional OTP Delivery)
- **Claimed Free Tier:** 300 free emails per day with zero domain locking (can deliver to any email recipient).
- **Source:** Brevo (formerly Sendinblue) pricing page (checked November 2026).
- **Items to Verify Before Launch:**
  - [ ] Verify hourly dispatch throttling on new Brevo accounts.
  - [ ] Confirm sender email verification status in Brevo dashboard (`https://app.brevo.com/senders`).

### 5. GitHub Actions (Automated CI & Encrypted Backups)
- **Claimed Free Tier:** 2,000 free runner minutes per month for private repositories.
- **Source:** GitHub Billing Docs (checked November 2026).
- **Items to Verify Before Launch:**
  - [ ] Ensure nightly backup run duration is < 2 minutes (consuming < 60 minutes/month).
  - [ ] Confirm OpenSSL encryption secret key is safely configured in GitHub Actions Secrets.

### 6. Razorpay (Payment Gateway)
- **Claimed Fees:** 2% per domestic UPI / Netbanking / Debit Card transaction + 18% GST on the fee (~2.36% total fee). No fixed setup or recurring monthly fee.
- **Source:** Razorpay Standard Pricing (checked November 2026).
- **Items to Verify Before Launch:**
  - [ ] Verify live KYC merchant onboarding approval status.
  - [ ] Verify Route marketplace sub-merchant split payout capabilities.

