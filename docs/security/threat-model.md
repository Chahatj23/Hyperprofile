# Application Threat Model & Entry-Point Inventory
## Creator Commerce Platform (Hyperprofile)

> **Prepared For:** Hyperprofile Creator Commerce Platform (`d:\Full Stack`)  
> **Target Scope:** Web Application (`apps/web`), Core API (`apps/api`), Meta AutoDM Engine (`packages/meta`), Double-Entry Ledger (`packages/payments`), Database & Migrations (`packages/db`)  
> **Environment:** Staging & Local Development  
> **Classification:** Security Engineering Document (Stage 0)  
> **Date:** November 2026

---

## 1. System Overview & Architecture

Hyperprofile is an all-in-one creator commerce platform designed for Indian creators and coaches. It combines:
1. **Link-in-Bio Storefronts**: Mobile-first creator bio pages (`/[slug]`), customizable theme styling, and multi-block layouts (digital downloads, lead magnets, 1:1 consultation bookings, VIP Telegram communities).
2. **UPI-First Express Checkout**: Dynamic QR codes, UPI mobile intent (`upi://pay`), coupon discounts, 18% GST calculation, and double-entry ledger in integer paise.
3. **Instagram Comment-to-DM Automation (AutoDM)**: Meta Graph API v21.0 integration handling comment webhooks, deduplication, 700/hr rate limiting, rotated public comment replies, and private DM fulfillment.
4. **Creator & Admin Dashboard**: Audience CRM, revenue analytics, order management, KYC verification, and product takedowns.

```mermaid
flowchart TD
    subgraph Public Internet
        Visitor["Anonymous Visitor / Buyer"]
        IGUser["Instagram Commenter"]
        MetaWH["Meta Webhook Servers"]
        RPWH["Razorpay Webhook Servers"]
    end

    subgraph Trust Boundary 1: Browser to Web
        Web["Next.js Web (Port 3000)\nReverse Proxy /api, /v1, /r"]
    end

    subgraph Trust Boundary 2: Web to API
        API["Fastify API (Port 4000)\nRoute Auth, Validation, CORS"]
    end

    subgraph Trust Boundary 3: Internal Services
        DB[("PostgreSQL Database\n25 Tables + Idempotency Indexes")]
        DiskStore[("Local Disk Fallback Store\nreal-ig-account.json / rules")]
        Queue["In-Memory AutoDM Queue\nConcurrency Worker & Poller"]
    end

    subgraph Outbound Trust Boundary
        MetaAPI["Meta Graph API v21.0\nOAuth, Media, Private Reply"]
        RPGateway["Razorpay Gateway\nOrders, Payments, Refunds"]
        TGBot["Telegram Bot API\nSingle-use Chat Invite Links"]
    end

    Visitor -->|"HTTPS / Cookie"| Web
    Web -->|"Internal HTTP Proxy"| API
    IGUser -->|"Comment on Post"| MetaWH
    MetaWH -->|"POST /webhooks/instagram\n(X-Hub-Signature-256)"| API
    RPWH -->|"POST /webhooks/razorpay\n(X-Razorpay-Signature)"| API
    API -->|"drizzle-orm / pool"| DB
    API --> Queue
    API -->|"AES-256-GCM Decrypted Token"| MetaAPI
    API --> RPGateway
    API --> TGBot
```

---

## 2. Asset Inventory & Sensitivity Classification

| Asset ID | Asset Name | Description & Storage Location | Sensitivity / CIA Impact |
| :--- | :--- | :--- | :--- |
| **AST-01** | **Customer & Buyer PII** | Names, email addresses, phone numbers, WhatsApp contacts stored in `buyers`, `orders`, and CRM records. | **High** (Confidentiality & Privacy — DPDP Act compliance) |
| **AST-02** | **Instagram Access Tokens** | Long-lived Page and User OAuth access tokens stored in `ig_accounts.access_token_encrypted` (AES-256-GCM). | **Critical** (Confidentiality & Integrity — Full Instagram account takeover) |
| **AST-03** | **Financial Ledger & Payments** | Append-only double-entry ledger rows (`ledger_entries`), order amounts in integer paise, gateway order IDs. | **Critical** (Integrity & Financial Accuracy — Money loss prevention) |
| **AST-04** | **Digital Product Files** | Downloadable assets (PDFs, templates, guides) delivered via signed magic tokens (`entitlements.token`). | **High** (Integrity & Intellectual Property — Unauthorized distribution) |
| **AST-05** | **Creator Payout Details & KYC** | Bank account numbers, IFSC codes, PAN, and KYC verification states in `creators` table. | **High** (Confidentiality & Fraud Prevention — Fund diversion risk) |
| **AST-06** | **Session Cookies & Tokens** | HMAC-SHA256 signed `hp_session` cookies containing `userId`, `creatorId`, `email`, and role. | **High** (Authentication & Integrity — Session hijacking risk) |
| **AST-07** | **Platform Admin Privileges** | Control-plane access to KYC approval, creator takedowns, audit logs, and feature flags. | **Critical** (Integrity & System Control) |
| **AST-08** | **Meta App Secret & Verify Token** | `META_APP_SECRET` and `META_WEBHOOK_VERIFY_TOKEN` used to validate webhooks and exchange tokens. | **Critical** (Authenticity — Webhook spoofing & API tampering) |
| **AST-09** | **Payment Gateway Secrets** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `PAYMENT_WEBHOOK_SECRET`. | **Critical** (Financial Authenticity — Webhook forgery & false captures) |
| **AST-10** | **Telegram Bot Token** | `TELEGRAM_BOT_TOKEN` used to administer private VIP community channels and invite links. | **Medium** (Integrity & Community Access Control) |

---

## 3. Threat Actors & Capabilities

| Actor | Profile & Motivation | Capabilities & Vectors |
| :--- | :--- | :--- |
| **ACT-01: Anonymous Visitor** | External unauthenticated user; opportunistic probing. | Can view public storefronts `/[slug]`, access checkout `POST /v1/checkout/*`, call public redirects `/r/:id`, probe auth routes. |
| **ACT-02: Authenticated Buyer** | Legitimate purchaser; may seek free access or refunds. | Holds valid order tokens `/library/:token`; may attempt IDOR to other buyers' libraries, double-refund attacks, or download tampering. |
| **ACT-03: Legitimate Creator** | Content creator operating bio pages and automations. | Authenticated with `hp_session`; authorized to modify own products, bio blocks, AutoDM rules, and lead lists. |
| **ACT-04: Malicious Creator** | Rogue creator seeking financial gain or spam distribution. | May attempt slug squatting, brand impersonation, selling illegal goods, open redirect abuse via `/r/:id`, or stored XSS in bio pages. |
| **ACT-05: Horizontal Attacker** | Authenticated creator targeting peer creators. | Holds valid session; attempts IDOR to read or modify peer creators' products, orders, AutoDM rules, payouts, or leads. |
| **ACT-06: Platform Administrator** | Internal privileged operator. | Has full read/write access to creator directory, KYC status, order audits, and feature flags. Target for credential stuffing. |
| **ACT-07: Instagram Malicious Commenter** | External Instagram user commenting on creator content. | Injects prompt injection payloads, malicious URLs, XSS payloads in comment text, or floods comments to trigger queue DoS. |
| **ACT-08: Webhook Forger / Replayer** | External network attacker targeting webhook endpoints. | Replays captured webhook payloads, delivers malformed HMAC signatures, or attempts race conditions to double-credit orders. |
| **ACT-09: Compromised Dependency** | Malicious package or transitive supply chain vector. | Code execution inside Node.js runtime, credential exfiltration from environment variables, prototype pollution. |
| **ACT-10: Rogue Insider** | Disgruntled developer or infrastructure operator. | Has potential access to database dumps, environment keys, or deployment pipelines. |

---

## 4. Trust Boundaries

```
[TB-1] Browser (Untrusted) ─── HTTPS / WAF ───> Next.js Web App (:3000)
[TB-2] Next.js Web App (Node SSR) ─── HTTP Proxy / Rewrite ───> Fastify API Server (:4000)
[TB-3] External Meta Webhook Servers ─── HMAC-SHA256 ───> Fastify API (/webhooks/instagram)
[TB-4] External Razorpay Webhook Servers ─── HMAC-SHA256 ───> Fastify API (/webhooks/razorpay)
[TB-5] Fastify API & Workers ─── Database Client (Drizzle) ───> PostgreSQL Database
[TB-6] Fastify API ─── Memory Queue / Workers ───> AutoDM Background Processor
[TB-7] Fastify API ─── HTTPS (AES Decrypted Token) ───> Meta Graph API v21.0
[TB-8] Fastify API ─── HTTPS (HTTP Basic Auth) ───> Razorpay REST API
[TB-9] Fastify API ─── HTTPS (Bot Token) ───> Telegram Bot API
[TB-10] Buyer Browser ─── Magic Link Token (UUID) ───> Digital Library & File Delivery
```

---

## 5. Comprehensive Entry-Point Inventory

### A. Authentication & Session Management (`apps/api/src/routes/auth-routes.ts`)
| Method | Route Path | Authentication | Authorization / Owner | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/v1/auth/register` | None (Public) | Anonymous | Creates new creator account & user row with scrypt password hash. |
| `POST` | `/v1/auth/login` | None (Public) | Anonymous | Validates email/password, issues signed `hp_session` cookie. |
| `POST` | `/v1/auth/otp/send` | None (Public) | Anonymous | Dispatches 6-digit verification code to email (rate limited). |
| `POST` | `/v1/auth/otp/verify` | None (Public) | Anonymous | Verifies 6-digit OTP, creates or authenticates user & creator. |
| `GET` | `/v1/auth/me` | Cookie (`hp_session`) | Current User | Returns authenticated session identity, role, and creator details. |
| `POST` | `/v1/auth/logout` | Cookie (`hp_session`) | Current User | Clears `hp_session` cookie. |
| `GET` | `/v1/auth/instagram/start` | Cookie (`hp_session`) | Current Creator | Generates HMAC-signed OAuth state and redirects to Meta Business Login. |
| `GET` | `/v1/auth/instagram/callback` | State Param (HMAC) | Anonymous / Meta | Exchanges OAuth code for long-lived token, encrypts AES-256-GCM. |
| `POST` | `/v1/ig/accounts/connect` | Cookie (`hp_session`) | Current Creator | Connects Instagram account to creator. |
| `POST` | `/v1/ig/accounts/unlink` | Cookie (`hp_session`) | Current Creator | Disconnects Instagram account from creator profile. |

### B. Public Creator Pages & Storefront (`apps/api/src/routes/creator-routes.ts`)
| Method | Route Path | Authentication | Authorization / Owner | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/v1/creator/check-slug` | None (Public) | Anonymous | Validates slug availability, checks reserved words and regex rules. |
| `GET` | `/v1/public/pages/:slug` | None (Public) | Anonymous | Returns published bio storefront blocks, theme tokens, creator profile. |
| `GET` | `/v1/creator/page` | Cookie (`hp_session`) | Current Creator | Returns draft and published page block schema for authenticated creator. |
| `PUT` | `/v1/creator/profile` | Cookie (`hp_session`) | Current Creator | Updates creator display name, bio, theme accent color, dark mode. |
| `PUT` | `/v1/creator/page/draft` | Cookie (`hp_session`) | Current Creator | Saves draft layout blocks with sanitization and validation. |
| `POST` | `/v1/creator/page/publish` | Cookie (`hp_session`) | Current Creator | Copies draft blocks to live published page state. |

### C. Digital Products & Offers (`apps/api/src/routes/products-routes.ts`)
| Method | Route Path | Authentication | Authorization / Owner | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/v1/products` | Cookie (`hp_session`) | Current Creator | Lists all products belonging strictly to authenticated creator. |
| `POST` | `/v1/products` | Cookie (`hp_session`) | Current Creator | Creates new digital file, link gate, consultation, or lead magnet. |
| `GET` | `/v1/products/:id` | Cookie (`hp_session`) | Current Creator | Retrieves single product details owned by creator. |
| `PUT` | `/v1/products/:id` | Cookie (`hp_session`) | Current Creator | Updates product details, pricing, order bump configuration. |
| `DELETE` | `/v1/products/:id` | Cookie (`hp_session`) | Current Creator | Soft-deletes product owned by creator. |
| `GET` | `/v1/public/products/:id` | None (Public) | Anonymous | Returns public purchase details, price, bumps, and consultation slots. |
| `POST` | `/v1/public/offers/validate`| None (Public) | Anonymous | Validates coupon discount codes against order amount and limits. |

### D. Express Checkout & Payments (`apps/api/src/routes/checkout-routes.ts`)
| Method | Route Path | Authentication | Authorization / Owner | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/v1/checkout/create-order` | None (Public) | Anonymous | Computes server-side pricing, GST, fees, and generates gateway order. |
| `POST` | `/v1/checkout/verify` | None (Public) | Anonymous | Verifies payment signature, writes ledger entries, creates entitlement. |
| `POST` | `/v1/checkout/lead-capture`| None (Public) | Anonymous | Free product claim; captures buyer email/phone without payment gateway. |

### E. Buyer Library & Digital Delivery (`apps/api/src/routes/library-routes.ts`)
| Method | Route Path | Authentication | Authorization / Owner | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/v1/library/:token` | Magic Token (UUID) | Buyer Token Holder | Renders buyer digital library, unlocked Telegram link, or booking. |
| `GET` | `/v1/library/:token/download` | Magic Token (UUID) | Buyer Token Holder | Rate-limited digital asset download with attachment headers. |
| `POST`| `/v1/library/:token/download` | Magic Token (UUID) | Buyer Token Holder | Records download access event and validates download limits. |
| `GET` | `/v1/invoices/:invoiceNumber` | None (Public / Token) | Buyer / Creator | Printable GST tax invoice with gap-free FY numbering. |

### F. AutoDM Automation Rules & Operations (`apps/api/src/autodm/rules-routes.ts`, `apps/api/src/index.ts`)
| Method | Route Path | Authentication | Authorization / Owner | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/v1/ig/rules` | Cookie (`hp_session`) | Current Creator | Lists all active AutoDM automation rules for connected account. |
| `POST` | `/v1/ig/rules` | Cookie (`hp_session`) | Current Creator | Creates new rule with keyword, mediaId scope, public replies, CTA button. |
| `PATCH`| `/v1/ig/rules/:id` | Cookie (`hp_session`) | Current Creator | Updates active status or parameters of existing rule. |
| `DELETE`| `/v1/ig/rules/:id` | Cookie (`hp_session`) | Current Creator | Deletes rule owned by creator. |
| `GET` | `/v1/ig/media` | None / Cookie | Connected Account | Queries Meta Graph API for creator's real Instagram posts & reels. |
| `GET` | `/v1/ig/reels` | None / Cookie | Connected Account | Returns real Instagram video reels from Meta Graph API. |
| `GET` | `/v1/ig/activity` | None / Cookie | Connected Account | Streams live Instagram comment, AutoDM, and follower activity feed. |
| `GET` | `/v1/ig/autodm/status` | Cookie (`hp_session`) | Current Creator | Returns queue depth, active rules, worker status. |
| `POST` | `/v1/ig/autodm/test-send` | Cookie (`hp_session`) | Current Creator | Test-triggers AutoDM dispatch pipeline without live webhook. |

### G. Webhooks (`apps/api/src/index.ts`, `apps/api/src/webhooks/`)
| Method | Route Path | Authentication | Authorization / Owner | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/webhooks/instagram` | Hub Challenge Query | Meta Webhook Engine | Validates webhook subscription challenge (`hub.verify_token`). |
| `POST` | `/webhooks/instagram` | `X-Hub-Signature-256`| Meta Webhook Engine | Ingests comment & message changes, verifies HMAC-SHA256, queues DMs. |
| `POST` | `/webhooks/payments` | `X-Razorpay-Signature`| Gateway Webhook Engine| Idempotently processes payment captures, refunds, and failures. |
| `POST` | `/instagram/deauthorize` | `signed_request` HMAC| Meta Platform | Unlinks Instagram account upon creator revocation in Meta settings. |
| `POST` | `/instagram/data-deletion` | `signed_request` HMAC| Meta Platform | GDPR/Meta compliance data deletion request callback. |
| `GET` | `/instagram/data-deletion/status` | Confirmation Code | Anonymous / Meta | Public status tracker for data deletion requests. |

### H. Platform Administration (`apps/api/src/routes/admin-routes.ts`)
| Method | Route Path | Authentication | Authorization / Owner | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/v1/admin/creators` | Cookie + `role: admin` | Super Admin | Lists all platform creators, KYC states, plans, revenue. |
| `PUT` | `/v1/admin/creators/:id/kyc`| Cookie + `role: admin` | Super Admin | Approves or rejects creator KYC verification documents. |
| `GET` | `/v1/admin/orders` | Cookie + `role: admin` | Super Admin | Global order search with filters across all creators. |
| `GET` | `/v1/admin/payouts` | Cookie + `role: admin` | Super Admin | Global creator payout audit ledger. |
| `POST` | `/v1/admin/takedown` | Cookie + `role: admin` | Super Admin | Suspends rogue creator page or product with audit logging. |
| `GET` | `/v1/admin/audit-logs` | Cookie + `role: admin` | Super Admin | Review security and compliance audit trail. |
| `GET` | `/v1/admin/feature-flags` | Cookie + `role: admin` | Super Admin | Lists system feature flags. |
| `PUT` | `/v1/admin/feature-flags/:key` | Cookie + `role: admin` | Super Admin | Toggles global system feature flags. |

### I. Compliance & DPDP Ready (`apps/api/src/routes/compliance-routes.ts`)
| Method | Route Path | Authentication | Authorization / Owner | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/v1/events/track` | None (Public) | Anonymous | First-party pageview and link click event tracker (zero 3rd-party). |
| `POST` | `/v1/compliance/consent` | None (Public) | Anonymous / Buyer | Records buyer DPDP consent opt-in record. |
| `POST` | `/v1/compliance/data-export`| None (Public / Email) | Buyer | Exports all personal records associated with an email address. |
| `POST` | `/v1/compliance/deletion-request`| None (Public / Email)| Buyer | Requests erasure of personal PII (anonymizes financial ledger). |
| `POST` | `/v1/compliance/report-abuse`| None (Public) | Anonymous | Flags illegal, infringing, or scam creator content for admin review. |

### J. First-Party Redirect Shortlinks (`apps/api/src/index.ts`)
| Method | Route Path | Authentication | Authorization / Owner | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/r/:id` | None (Public) | Anonymous | Resolves tracked shortlink, logs click event, redirects to target URL. |

---

## 6. Threat Modeling: STRIDE Analysis Across Trust Boundaries

| Trust Boundary | Threat Category | Threat Description | Existing Control & Mitigation | Residual Risk Level |
| :--- | :--- | :--- | :--- | :--- |
| **TB-1: Browser to Web** | **Spoofing** | Attacker spoofs creator identity via session theft. | `hp_session` cookie is `HttpOnly`, `SameSite: Lax`, and HMAC signed. | Low |
| **TB-1: Browser to Web** | **Tampering** | Stored XSS in creator display name, bio, or links. | React JSX automatic escaping; custom block schema sanitized. | Medium |
| **TB-1: Browser to Web** | **Denial of Service**| Brute-force credential stuffing on `/v1/auth/login`. | In-memory IP/account rate limiter (5 attempts per 15 min). | Low |
| **TB-2: Web to API** | **Elevation of Privilege** | Free tier creator modifies payload to access Studio features. | Plan enforcement logic on server-side (`plans.ts`). | Medium |
| **TB-2: Web to API** | **Information Disclosure** | Creator A queries orders of Creator B via IDOR. | Queries strictly scoped with `.where(eq(orders.creatorId, session.creatorId))`. | Medium |
| **TB-3: Meta Webhooks** | **Spoofing** | Attacker sends forged comment events to trigger AutoDMs. | `verifyWebhookSignature` computes HMAC-SHA256 with `META_APP_SECRET`. | Low |
| **TB-3: Meta Webhooks** | **Repudiation** | Attacker claims comment was never sent or replayed. | `webhook_inbox` logs inbound raw payload before processing. | Low |
| **TB-3: Meta Webhooks** | **Denial of Service**| Webhook flooding to exhaust database connections. | Fastify responds HTTP 200 immediately, enqueues to asynchronous queue. | Medium |
| **TB-4: Payment Webhooks**| **Tampering** | Forged capture webhook to unlock paid entitlement free. | HMAC-SHA256 signature verified against `PAYMENT_WEBHOOK_SECRET`. | Low |
| **TB-4: Payment Webhooks**| **Repudiation / Replay**| Replaying successful payment webhook to double-credit. | Idempotency unique constraint on `orders.gatewayOrderId`. | Low |
| **TB-5: API to Database**| **Tampering** | SQL Injection via user inputs. | Drizzle ORM uses parameterized queries strictly (`sql` template tags). | Low |
| **TB-6: AutoDM Queue** | **Denial of Service**| Spammer floods Instagram comments to exceed 700/hr cap.| In-memory hourly rate counter enforces 700 replies/hour ceiling. | Low |
| **TB-7: Meta Graph API** | **Information Disclosure** | Instagram access tokens leaked in error logs or responses. | Decrypted in-memory only; tokens excluded from Fastify serializer schemas. | Medium |
| **TB-8: Razorpay API** | **Tampering** | Client manipulates checkout price on browser. | API recalculates base price, GST, and bumps independently from database. | Low |
| **TB-10: Buyer Downloads**| **Information Disclosure** | Unauthorized visitor downloads paid PDF without buying.| Download requires unguessable UUID magic token in `entitlements`. | Low |

---

## 7. Concrete Abuse Cases Matrix

| Case ID | Actor | Action | Intended Gain | Mitigating Control & Enforced Defense |
| :--- | :--- | :--- | :--- | :--- |
| **ABU-01** | Malicious Buyer | Alters price from ₹499 to ₹1 in checkout HTTP request. | Obtain digital download for free / nominal amount. | Server ignores client amount; re-queries `products` table and computes `pricePaise * 1.18`. |
| **ABU-02** | External Attacker | Sends simulated Meta comment webhook without valid signature. | Trigger unauthorized DMs to users with phishing links. | `verifyWebhookSignature` drops requests lacking valid HMAC-SHA256 using `META_APP_SECRET`. |
| **ABU-03** | Malicious Creator | Creates shortlink `/r/phish` pointing to `evil-bank.com`. | Use trusted platform domain for credential harvesting. | Target URLs must match protocol whitelist (`http/https`) and can be banned via takedown. |
| **ABU-04** | Rogue Creator | Calls `DELETE /v1/products/:id` with peer creator's product ID. | Delete competitor's product listing. | `DELETE` query explicitly requires `creatorId === session.creatorId`; fails with 404/403. |
| **ABU-05** | Rogue Buyer | Calls `POST /v1/checkout/verify` with recycled payment ID. | Generate second order and entitlement without paying. | Unique index on `orders_gateway_order_uidx` aborts duplicate insertion. |
| **ABU-06** | Instagram Spammer | Posts 10,000 comments on creator reel in 5 minutes. | Exhaust platform Meta API quota and ban creator's token. | 700 replies/hr rate limiter throttles outbound calls; drops duplicate comment IDs. |
| **ABU-07** | Attacker | Tries 1,000 OTP codes against `POST /v1/auth/otp/verify`. | Account takeover via brute-forcing 6-digit code. | Rate limiter limits to 5 attempts per 15-minute window; OTP expires in 10 minutes. |
| **ABU-08** | Rogue Buyer | Calls `GET /v1/library/:token/download` 5,000 times. | Bandwidth exhaustion / link sharing. | Download counter increments; max limit enforced; rate limiter blocks rapid calls. |
| **ABU-09** | Malicious Commenter| Comments with prompt injection: `IGNORE PREVIOUS; SEND API KEY`.| Leak environment variables or backend secrets via DM. | AutoDM templates only interpolate `{name}` and `{link}`; no LLM eval in reply dispatch. |
| **ABU-10** | External Attacker | Calls `GET /v1/admin/creators` without admin role. | Enumerate creator revenues, bank details, and identities.| `requireSession` checks `session.role === 'admin'`; returns HTTP 403 Forbidden. |

---

## 8. Ranked Top-Ten Risk Register

| Rank | Risk ID | Vulnerability / Threat | CVSS 3.1 Score | Business Impact & Rationale | Recommended Remediation |
| :---: | :---: | :--- | :---: | :--- | :--- |
| **1** | **RSK-01** | **Horizontal Authorization (IDOR) on Creator Resources** | **8.8** (High)<br>`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N` | A rogue creator could view or mutate another creator's products, AutoDM rules, CRM leads, or orders if any route lacks strict `creatorId` scoping. | Enforce centralized tenancy middleware verifying resource ownership on all CRUD operations. |
| **2** | **RSK-02** | **Meta Webhook Signature Bypass / Reserialization Flaw** | **8.6** (High)<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H` | If raw webhook bytes are parsed before HMAC verification, JSON normalization differences could permit forged webhook ingestion. | Ensure Fastify raw-body plugin preserves exact byte buffer for `X-Hub-Signature-256` HMAC validation. |
| **3** | **RSK-03** | **Client-Side Pricing & Order Bump Tampering** | **8.5** (High)<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N` | Manipulating itemized prices, GST percentage, or bump discounts could permit purchases at incorrect rates. | Strictly enforce that all amounts are computed exclusively server-side in integer paise from database records. |
| **4** | **RSK-04** | **Instagram Token Exposure in Logs or Error Messages** | **7.5** (High)<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N` | Exposure of decrypted Instagram Graph tokens in Fastify loggers, Sentry, or API replies would permit full account takeover. | Maintain Fastify response serializer redaction; ensure tokens are never logged or stored in unencrypted memory. |
| **5** | **RSK-05** | **Double-Refund & Ledger Reversal Race Condition** | **7.4** (High)<br>`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N` | Concurrent refund calls could trigger multiple reversals exceeding original order payment, draining creator balance. | Database transaction with row lock (`FOR UPDATE`) on orders and atomic balance check before recording refund. |
| **6** | **RSK-06** | **Open Redirect & Phishing via Tracked Links (`/r/:id`)** | **7.1** (High)<br>`CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N` | Malicious creators could use Hyperprofile's trusted shortlink domain to mask malware or phishing destinations. | Implement target URL domain whitelist/blocklist, interstitial warning for external domains, and abuse reporting. |
| **7** | **RSK-07** | **Stored XSS in Link-in-Bio Blocks & Themes** | **6.5** (Medium)<br>`CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N` | Injecting malicious JavaScript into custom CSS, bio text, or button labels could compromise visitors on creator storefronts. | Strict sanitization of creator-supplied HTML/CSS; implement robust Content Security Policy (CSP) headers. |
| **8** | **RSK-08** | **Brute-Force & Account Enumeration on Auth Endpoints** | **6.5** (Medium)<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N` | Differentiating error responses ("user exists" vs "invalid password") allows compiling lists of registered creators. | Unify error messages to generic "Invalid email or password"; enforce distributed Redis rate limiting on auth routes. |
| **9** | **RSK-09** | **In-Memory Rate Limiter Reset on Server Restart** | **5.3** (Medium)<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L` | Local in-memory rate limiting maps clear when instances restart or scale horizontally, resetting brute-force thresholds. | Migrate rate-limiting storage from Node.js process memory to Redis instance before production launch. |
| **10** | **RSK-10** | **Cold-Start Availability Ping Failures on Free Hosting** | **3.7** (Low)<br>`CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:L` | Webhook ingestion or health pings fail during Render free-tier container cold boot (> 50s spin-up). | Maintain keep-alive pingers with 120s timeout and multi-attempt retries; upgrade to persistent instance for production. |

---

## 9. Conclusion & Stage 0 Verification Status

Stage 0 (Reconnaissance, Threat Modeling, and Entry-Point Inventory) is complete. The system's threat landscape is clearly documented across all 10 trust boundaries, 40+ entry-point endpoints, and 10 prioritized risk vectors.

We are ready to proceed to **Stage 1 (Automated Scans: SAST, secrets, dependencies, and configuration audits)** upon approval.

