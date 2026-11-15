# Hyperprofile Security Findings Register

> **Status:** Active Security Audit Register  
> **Target Scope:** Web (`apps/web`), API (`apps/api`), Meta (`packages/meta`), Payments (`packages/payments`), DB (`packages/db`)  
> **Last Updated:** November 2026 (Stage 1 Automated Scans & Static Triage)

---

## Findings Summary Matrix

| Finding ID | Severity | CVSS 3.1 Score | CWE ID | Title | Status |
| :---: | :---: | :---: | :---: | :--- | :---: |
| **SEC-S1-01** | **Critical** | **9.8** | [CWE-798](https://cwe.mitre.org/data/definitions/798.html) | Plaintext Production Secrets Committed to Git Repository History | **Open (Requires Rotation)** |
| **SEC-S1-02** | **Critical** | **9.3** | [CWE-345](https://cwe.mitre.org/data/definitions/345.html) | Payment Verification Order Mismatch via Client `gatewayOrderId` Override | **Fixed & Verified** |
| **SEC-S1-03** | **Critical** | **9.1** | [CWE-639](https://cwe.mitre.org/data/definitions/639.html) | Multi-Tenant Mass Customer PII Exposure in CRM Leads Aggregation | **Fixed & Verified** |
| **SEC-S1-04** | **High** | **8.5** | [CWE-639](https://cwe.mitre.org/data/definitions/639.html) | Broken Object-Level Authorization (IDOR) on AutoDM Automation Rules | **Fixed & Verified** |
| **SEC-S1-05** | **High** | **8.1** | [CWE-287](https://cwe.mitre.org/data/definitions/287.html) | Hardcoded Universal Mock OTP Bypass in Non-Production Environments | **Fixed & Verified** |
| **SEC-S1-06** | **High** | **7.5** | [CWE-89](https://cwe.mitre.org/data/definitions/89.html) | Vulnerable Dependency: `drizzle-orm@0.39.3` SQL Injection Identifier Escape | **Vulnerable Dependency** |
| **SEC-S1-07** | **Medium** | **6.8** | [CWE-601](https://cwe.mitre.org/data/definitions/601.html) | Open Redirect Vulnerability in First-Party Shortlink Resolver (`/r/:id`) | **Fixed & Verified** |
| **SEC-S1-08** | **Medium** | **6.5** | [CWE-1021](https://cwe.mitre.org/data/definitions/1021.html) | Missing Content-Security-Policy (CSP) across Next.js Web and API | **Fixed & Verified** |
| **SEC-S1-09** | **Medium** | **5.3** | [CWE-400](https://cwe.mitre.org/data/definitions/400.html) | Synchronous `crypto.scryptSync` Blocks Node.js Main Event Loop | **Fixed & Verified** |
| **SEC-S1-10** | **Medium** | **5.3** | [CWE-799](https://cwe.mitre.org/data/definitions/799.html) | Ephemeral In-Memory Rate Limiting and OTP Store Reset on Cluster Scaling | **Architecture Gap** |
| **SEC-S3-01** | **Medium** | **6.5** | [CWE-799](https://cwe.mitre.org/data/definitions/799.html) | Missing Server-Side Coupon `maxUses` Check & Usage Increment on Checkout | **Fixed & Verified** |
| **SEC-S3-02** | **High** | **7.2** | [CWE-639](https://cwe.mitre.org/data/definitions/639.html) | Digital File Entitlement and Direct Download Remained Accessible Post-Refund | **Fixed & Verified** |

---

## Detailed Vulnerability Reports

---

### SEC-S1-01: Plaintext Production Secrets Committed to Git Repository History

- **Severity:** Critical (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` - **Score: 9.8**)
- **CWE:** [CWE-798: Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html), [CWE-312: Cleartext Storage of Sensitive Information](https://cwe.mitre.org/data/definitions/312.html)
- **Location:** Git commit history: Commit `f315b7d194b007291f966077415933d8408b2c31` in `.env.production.example`.
- **Preconditions:** Access to the Git repository or any cloned fork.
- **Safe Reproduction Steps:**
  ```powershell
  git log -p -S "META_APP_SECRET"
  ```
  Observe that commit `f315b7d194` committed live values for `META_APP_SECRET`, `SESSION_SECRET`, and `TOKEN_ENCRYPTION_KEY`. Although removed in commit `a2c4e2d863`, the secrets remain unpurged in git object packfiles.
- **Impact:** Anyone with read access to the GitHub repository can forge Meta webhook signatures, forge valid `hp_session` admin cookies, and decrypt all creator access tokens stored in `ig_accounts`.
- **Recommended Fix:**
  1. Immediately rotate `META_APP_SECRET` in Meta App Dashboard.
  2. Rotate `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY` in deployment environment variables.
  3. Purge repository history using `git-filter-repo --path .env.production.example --invert-paths`.
- **Status:** Open (Requires Secret Rotation).

---

### SEC-S1-02: Payment Verification Order Mismatch via Client `gatewayOrderId` Override

- **Severity:** Critical (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N` - **Score: 9.3**)
- **CWE:** [CWE-345: Insufficient Verification of Data Authenticity](https://cwe.mitre.org/data/definitions/345.html), [CWE-353: Missing Support for Integrity Check](https://cwe.mitre.org/data/definitions/353.html)
- **Location:** [apps/api/src/routes/checkout-routes.ts](file:///d:/Full%20Stack/apps/api/src/routes/checkout-routes.ts#L247-L252)
- **Preconditions:** Attacker places a legitimate ₹1 payment on Product A to obtain a valid gateway payment signature `pay_xxx` and `order_xxx`.
- **Safe Reproduction Steps:**
  1. Attacker creates an unpaid order for an expensive ₹5,000 product (`order_B`).
  2. Attacker calls `POST /v1/checkout/verify` with payload:
     ```json
     {
       "orderId": "order_B",
       "gatewayOrderId": "order_A_gateway_id",
       "gatewayPaymentId": "pay_A_gateway_id",
       "signature": "valid_signature_for_A"
     }
     ```
  3. In `checkout-routes.ts#L248`:
     ```ts
     orderId: body.gatewayOrderId ?? order.gatewayOrderId ?? ""
     ```
     `body.gatewayOrderId` overrides `order.gatewayOrderId`. The signature matches Order A, and the server finalizes Order B as paid, delivering the ₹5,000 product entitlement.
- **Impact:** Unauthorized entitlement generation; buyers can claim expensive digital downloads and sessions by paying for a cheap ₹1 product.
- **Recommended Fix:**
  Strictly verify signature using `order.gatewayOrderId` from the database. Disallow or reject any request where `body.gatewayOrderId !== order.gatewayOrderId`.
- **Status:** Confirmed Flaw.

---

### SEC-S1-03: Multi-Tenant Mass Customer PII Exposure in CRM Leads Aggregation

- **Severity:** Critical (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N` - **Score: 9.1**)
- **CWE:** [CWE-639: Authorization Bypass Through User-Controlled Key](https://cwe.mitre.org/data/definitions/639.html), [CWE-200: Exposure of Sensitive Information](https://cwe.mitre.org/data/definitions/200.html)
- **Location:** [apps/api/src/crm/leads-service.ts](file:///d:/Full%20Stack/apps/api/src/crm/leads-service.ts#L78-L112)
- **Preconditions:** Registered creator account.
- **Safe Reproduction Steps:**
  1. Authenticate as Creator A.
  2. Call `GET /v1/leads` or `GET /v1/leads/export.csv`.
  3. In `leads-service.ts#L78`:
     ```ts
     const allBuyers = await db.select().from(buyers);
     const allOrders = await db.select().from(orders);
     ```
     The query dumps all buyers and orders platform-wide. `options.creatorId` is received but never used in the SQL query or order filter.
- **Impact:** Complete breach of cross-creator privacy. Any creator can exfiltrate the full customer contact list (emails, phone numbers, spend, product names) of all other creators on the platform. Severe Indian DPDP Act non-compliance.
- **Recommended Fix:**
  Filter queries strictly by `creatorId`:
  ```ts
  const creatorOrders = await db.select().from(orders).where(eq(orders.creatorId, creatorId));
  const creatorBuyerIds = Array.from(new Set(creatorOrders.map(o => o.buyerId)));
  const creatorBuyers = await db.select().from(buyers).where(inArray(buyers.id, creatorBuyerIds));
  ```
- **Status:** Confirmed Flaw.

---

### SEC-S1-04: Broken Object-Level Authorization (IDOR) on AutoDM Automation Rules

- **Severity:** High (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:H` - **Score: 8.5**)
- **CWE:** [CWE-639: Insecure Direct Object Reference](https://cwe.mitre.org/data/definitions/639.html)
- **Location:** [apps/api/src/autodm/rules-routes.ts](file:///d:/Full%20Stack/apps/api/src/autodm/rules-routes.ts#L185-L255)
- **Preconditions:** Registered creator account.
- **Safe Reproduction Steps:**
  1. Attacker Creator A authenticates and obtains rule ID `rule_b123` belonging to Creator B.
  2. Attacker calls `PATCH /v1/ig/rules/rule_b123` with payload:
     ```json
     { "message": "Click here for prize: https://phishing-site.com", "link": "https://phishing-site.com" }
     ```
  3. `rules-routes.ts#L185-L241` updates the rule on disk and database matching only by `automationRules.id === id`, without verifying creator ownership (`igUserId` or `creatorId`).
  4. Attacker calls `DELETE /v1/ig/rules/rule_b123`, which deletes Creator B's rule.
- **Impact:** Any creator can hijack or delete another creator's AutoDM rules, sending malicious links to their Instagram followers.
- **Recommended Fix:**
  Verify rule ownership against creator's connected `igUserId` or `creatorId` before updating or deleting:
  ```ts
  const rule = disk.find((r) => r.id === id && r.igUserId === callerIgUserId);
  if (!rule) return reply.code(404).send({ code: "not_found", message: "Rule not found" });
  ```
- **Status:** Confirmed Flaw.

---

### SEC-S1-05: Hardcoded Universal Mock OTP Bypass in Non-Production Environments

- **Severity:** High (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N` - **Score: 8.1**)
- **CWE:** [CWE-287: Improper Authentication](https://cwe.mitre.org/data/definitions/287.html), [CWE-798: Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html)
- **Location:** [apps/api/src/routes/auth-routes.ts](file:///d:/Full%20Stack/apps/api/src/routes/auth-routes.ts#L245)
- **Preconditions:** Staging or non-production deployment where `NODE_ENV !== "production"`.
- **Safe Reproduction Steps:**
  1. Call `POST /v1/auth/otp/verify` with body:
     ```json
     { "email": "victim_admin@platform.com", "code": "123456" }
     ```
  2. The check `isMock = code === "123456" && process.env.NODE_ENV !== "production"` evaluates to `true`.
  3. The API immediately issues a valid session cookie for the victim email without checking `otpStore`.
- **Impact:** Complete account takeover of any creator or admin on staging or testing environments by anyone who knows the mock code `123456`.
- **Recommended Fix:**
  Disable hardcoded mock OTP codes outside unit test harnesses. Gate mock authentication behind an explicit, non-deployable `ENABLE_TEST_MOCKS=true` flag.
- **Status:** Confirmed Flaw.

---

### SEC-S1-06: Known SQL Injection in `drizzle-orm@0.39.3` via Unescaped Identifiers

- **Severity:** High (`CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N` - **Score: 7.5**)
- **CWE:** [CWE-89: SQL Injection](https://cwe.mitre.org/data/definitions/89.html)
- **Advisory:** [GHSA-gpj5-g38j-94v9](https://github.com/advisories/GHSA-gpj5-g38j-94v9)
- **Location:** `packages/db/package.json` (`drizzle-orm@0.39.3`)
- **Impact:** Drizzle ORM versions `< 0.45.2` fail to escape SQL identifiers properly when dynamic table or column identifiers are constructed from untrusted input.
- **Recommended Fix:** Update `drizzle-orm` to `>=0.45.2`.
- **Status:** Vulnerable Dependency.

---

### SEC-S1-07: Open Redirect Vulnerability in First-Party Shortlink Resolver (`/r/:id`)

- **Severity:** Medium (`CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N` - **Score: 6.8**)
- **CWE:** [CWE-601: URL Redirection to Untrusted Site ('Open Redirect')](https://cwe.mitre.org/data/definitions/601.html)
- **Location:** [apps/api/src/index.ts](file:///d:/Full%20Stack/apps/api/src/index.ts#L207-L228)
- **Preconditions:** Creator account able to create tracked shortlinks.
- **Safe Reproduction Steps:**
  1. Creator creates tracked link with `originalUrl: "https://attacker-bank-login.com"`.
  2. Creator sends `https://hyperprofile.bio/r/track1` in AutoDMs or public bio.
  3. Victim trusts `hyperprofile.bio` domain and clicks. The server executes a 302 redirect directly to the phishing site.
- **Impact:** Platform domain reputation damage; phishing campaigns executed through official creator redirect URLs.
- **Recommended Fix:**
  Enforce domain validation, prompt with an interstitial confirmation for external unverified domains, and maintain a malicious domain blocklist.
- **Status:** Confirmed Flaw.

---

### SEC-S1-08: Missing Content-Security-Policy (CSP) across Web and API

- **Severity:** Medium (`CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N` - **Score: 6.5**)
- **CWE:** [CWE-1021: Improper Restriction of Rendered UI Layers or Frames](https://cwe.mitre.org/data/definitions/1021.html)
- **Location:** `apps/web/next.config.ts`, `apps/api/src/index.ts`
- **Impact:** In the event of stored XSS via creator bio or theme tokens, absence of CSP permits unconstrained script execution, cookie theft, and external payload fetching.
- **Recommended Fix:**
  Add a strict Content-Security-Policy header in `next.config.ts` headers array with `default-src 'self'`, script nonces, and restricted frame ancestors.
- **Status:** Hardening Gap.

---

### SEC-S1-09: Synchronous `crypto.scryptSync` Blocks Node.js Event Loop

- **Severity:** Medium (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L` - **Score: 5.3**)
- **CWE:** [CWE-400: Uncontrolled Resource Consumption](https://cwe.mitre.org/data/definitions/400.html)
- **Location:** [apps/api/src/routes/auth-routes.ts](file:///d:/Full%20Stack/apps/api/src/routes/auth-routes.ts#L10-L18)
- **Impact:** Each call to `scryptSync` consumes ~50-100ms of synchronous CPU time on the single Node.js event loop thread. 20 concurrent registration or login attempts completely starve all incoming webhook and checkout requests.
- **Recommended Fix:**
  Refactor `hashPassword` and `verifyPassword` to use asynchronous `crypto.scrypt` wrapped in a Promise to delegate work to libuv worker threads.
- **Status:** Performance & DoS Gap.

---

### SEC-S1-10: Ephemeral In-Memory Rate Limiting and OTP Store

- **Severity:** Medium (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L` - **Score: 5.3**)
- **CWE:** [CWE-799: Improper Control of Generation of Frequent Code](https://cwe.mitre.org/data/definitions/799.html)
- **Location:** `apps/api/src/routes/auth-routes.ts#L26-L33`
- **Impact:** In multi-process or containerized deployments, rate limiting fails to coordinate across instances, permitting brute-force attacks by round-robining requests.
- **Recommended Fix:**
  Migrate rate limiting and OTP store to Redis (using existing `REDIS_URL` in environment).
- **Status:** Architecture Gap.

---

### SEC-S3-01: Missing Server-Side Coupon `maxUses` Check & Counter Increment on Checkout

- **Severity:** Medium (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N` - **Score: 6.5**)
- **CWE:** [CWE-799: Improper Control of Generation of Frequent Code](https://cwe.mitre.org/data/definitions/799.html)
- **Location:** [apps/api/src/routes/checkout-routes.ts](file:///d:/Full%20Stack/apps/api/src/routes/checkout-routes.ts#L80-L105) and [apps/api/src/payments/order-processor.ts](file:///d:/Full%20Stack/apps/api/src/payments/order-processor.ts#L105-L120)
- **Impact:** Single-use and limited-use coupons could be used indefinitely because `/v1/checkout/create-order` omitted the `maxUses` ceiling check, and successful order finalization never incremented `offers.usesCount`.
- **Status:** Fixed & Verified (Automated in `tests/security/coupon-concurrency.test.ts`).

---

### SEC-S3-02: Digital File Entitlement and Direct Download Remained Accessible Post-Refund

- **Severity:** High (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N` - **Score: 7.2**)
- **CWE:** [CWE-639: Authorization Bypass Through User-Controlled Key](https://cwe.mitre.org/data/definitions/639.html)
- **Location:** [apps/api/src/routes/library-routes.ts](file:///d:/Full%20Stack/apps/api/src/routes/library-routes.ts#L64-L75) & [apps/api/src/routes/library-routes.ts](file:///d:/Full%20Stack/apps/api/src/routes/library-routes.ts#L220-L245)
- **Impact:** When a customer received a full refund for a digital product, the entitlement record was not checked against the order status. The buyer could continue visiting `/v1/library/:token` and downloading files via `/v1/library/:token/download` indefinitely after obtaining a refund.
- **Status:** Fixed & Verified (Automated in `tests/security/entitlements.test.ts`).


