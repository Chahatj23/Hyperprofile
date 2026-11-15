# Hyperprofile Security Incident Response & Operations Runbooks

> **Scope:** Hyperprofile Platform Operations (`apps/api`, `apps/web`, `packages/*`)  
> **Prepared:** November 2026  
> **Applicability:** Critical Infrastructure, Secret Management, Breach Response & Regulatory Compliance (DPDP Act 2023, CERT-In, Meta Developer Terms)

---

## Runbook 1: Production Incident Response Protocol

### Severity Levels
- **P0 (Critical / Severe):** Active unauthorized data exfiltration, ongoing financial loss (price/payment manipulation), full system outage, or confirmed credential leak in public.
- **P1 (High):** Bypassed authentication/authorization on non-admin routes, single creator account hijack, persistent webhook failure, or high-risk vulnerability discovered.
- **P2 (Medium):** Edge-case rate limit bypass, localized performance degradation, non-impacting security anomaly.

### Response Workflow
1. **Detection & Triage (T0 to T+15m):**
   - Confirm vulnerability or attack vector via API logs (`pino` structured logs in Render dashboard).
   - Identify affected creator accounts, buyer IDs, and transaction IDs.
2. **Containment (T+15m to T+30m):**
   - If unauthorized API access: Immediately rotate leaked tokens or revoke attacker sessions.
   - If payment / ledger exploit: Temporarily freeze checkout endpoints via environment flag `DISABLE_CHECKOUT=true` or scale API workers to maintenance mode.
   - If webhook forgery: Block originating IP range via Cloudflare WAF.
3. **Eradication & Remediation:**
   - Deploy hotfix with automated regression tests added to `tests/security/`.
   - Verify fix passes `pnpm exec vitest run tests/security` and `pnpm typecheck`.
4. **Post-Mortem:**
   - Conduct root-cause analysis within 48 hours; document in `docs/security/incidents/`.

---

## Runbook 2: Key & Secret Rotation Procedures

### 2.1 Meta App Secret Rotation (Zero-Downtime Dual-Secret)
Meta allows rotating the App Secret with a grace period where both old and new secrets sign webhooks. Hyperprofile supports zero-downtime rotation via comma-separated secrets in `META_APP_SECRET`.

1. **Step 1:** Log in to [Meta App Dashboard](https://developers.facebook.com/apps) -> **App Settings** -> **Basic**.
2. **Step 2:** Under **App Secret**, click **Reset Secret** and choose **Grace Period (e.g., 24 hours)**. Meta will display `NEW_APP_SECRET` while keeping `OLD_APP_SECRET` valid.
3. **Step 3:** Update the environment variable in Render:
   ```env
   META_APP_SECRET="<NEW_APP_SECRET>,<OLD_APP_SECRET>"
   ```
4. **Step 4:** Trigger zero-downtime redeploy. Incoming webhooks will accept signatures made with either secret.
5. **Step 5:** Once the grace period expires in Meta Dashboard, update the environment variable to contain strictly the new secret:
   ```env
   META_APP_SECRET="<NEW_APP_SECRET>"
   ```

### 2.2 Session Secret (`SESSION_SECRET`) Rotation
Rotating `SESSION_SECRET` invalidates all issued `hp_session` cookies, forcing all creators and admins to re-authenticate via OTP or credentials.

1. Generate a new cryptographically secure 64-character secret:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Update `SESSION_SECRET` in deployment settings.
3. Redeploy the API server. All previous user sessions will be rejected safely (`signature_mismatch`).

### 2.3 Token Encryption Key (`TOKEN_ENCRYPTION_KEY`) Rotation
Instagram OAuth access tokens in `ig_accounts.access_token_encrypted` are protected using AES-256-GCM.
1. Run a re-encryption migration script to decrypt rows using `OLD_KEY` and re-encrypt using `NEW_KEY`.
2. Update `TOKEN_ENCRYPTION_KEY` in environment variables.

### 2.4 Razorpay Webhook Secret & Gateway Keys
1. In the Razorpay Dashboard -> **Settings** -> **Webhooks**, generate a secondary secret.
2. Update `RAZORPAY_WEBHOOK_SECRET` in Render.

---

## Runbook 3: Meta Token Revocation & Deauthorization Response

When a creator uninstalls the Hyperprofile app from Instagram, Meta issues a signed HTTP POST request to `/instagram/deauthorize` and `/instagram/delete`.

1. **Verification:**
   - The server validates `signed_request` HMAC using `parseSignedRequest(body.signed_request, META_APP_SECRET)`.
2. **Account Deactivation:**
   - Extract `user_id` from parsed payload.
   - Set `ig_accounts.reauthRequiredAt = new Date()` and clear `accessTokenEncrypted`.
   - Update all associated AutoDM automation rules: `active = false`.
   - Abort all pending outbound reply queue tasks for this `igUserId`.
3. **Compliance Logging:**
   - Record deauthorization event in `audit_log` with IP, timestamp, and Meta user identifier.

---

## Runbook 4: Data Breach Notification Procedure

Compliant with India's **Digital Personal Data Protection (DPDP) Act 2023** and **CERT-In Directions**.

### Reporting Timeline
- **Within 6 Hours (CERT-In Mandatory):** Any cybersecurity incident involving unauthorized access to systems or customer PII must be reported to the Indian Computer Emergency Response Team (CERT-In) at `incident@cert-in.org.in`.
- **Without Undue Delay (Data Protection Board of India & Creators):** If personal data (names, emails, phone numbers) of buyers or creators is compromised:
  1. Notify the Data Protection Board of India detailing:
     - Nature of breach and vulnerability exploited.
     - Categories and estimated count of affected data principals.
     - Remedial actions implemented.
  2. Send email notification to affected creators and buyers with recommended protective steps.

---

## Runbook 5: Creator Payout Emergency Freeze & KYC Suspension

Used in the event of suspected payment fraud, unauthorized chargeback volume, or account takeover.

1. **Immediate Payout Freeze:**
   - Execute database freeze on creator account:
     ```sql
     UPDATE creators 
     SET kyc_status = 'suspended', updated_at = NOW() 
     WHERE id = '<SUSPICIOUS_CREATOR_ID>';
     ```
2. **Hold Pending Escrow Transfers:**
   - Mark pending payouts as `on_hold`:
     ```sql
     UPDATE payouts 
     SET status = 'on_hold', updated_at = NOW() 
     WHERE creator_id = '<SUSPICIOUS_CREATOR_ID>' AND status = 'pending';
     ```
3. **Audit Trail Inspection:**
   - Review ledger postings:
     ```sql
     SELECT * FROM ledger_entries 
     WHERE order_id IN (SELECT id FROM orders WHERE creator_id = '<SUSPICIOUS_CREATOR_ID>')
     ORDER BY created_at DESC;
     ```
4. **Investigation & Unfreeze:**
   - Verify transaction legitimacy with Razorpay dispute dashboard before releasing payout hold.
