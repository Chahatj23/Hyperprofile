# Instagram AutoDM reference implementation (comment → private reply)

A small, type-checked TypeScript service showing the full Meta connection: connect an Instagram professional account, receive comment webhooks, send exactly one private reply per comment, stay under rate limits, and keep tokens alive. Smoke-tested locally for signature checks, deduplication, own-comment skipping and retry on network failure. **It has not been run against live Meta**, so test with an Instagram Tester account first.

Read `TEARDOWN.md` for the SuperProfile analysis. `schema.sql` is the production database design.

## What it implements

| Piece | File | Notes |
|---|---|---|
| Business Login for Instagram | `server.ts`, `meta.ts` | Authorize → code → short token → 60-day token → `/me` |
| Signed `state` | `crypto.ts` | CSRF guard, 10-minute expiry, separate secret |
| Webhook handshake and POST | `server.ts` | `hub.verify_token` for GET; HMAC-SHA256 of the **raw** body for POST |
| Per-account field subscription | `meta.ts` | Replaces the field set each time; checks `success:true` |
| Idempotent claim | `store.ts`, `schema.sql` | `comment_id` primary key = one reply per comment |
| Send worker | `queue.ts` | 700/hour cap per account, queue not drop, backoff, 7-day expiry |
| Error classification | `meta.ts` | By code and subcode, never by HTTP status |
| Token refresh | `server.ts` | Hourly; 3-day buffer; dead tokens skipped |
| Deauthorize and data deletion | `server.ts` | Required by App Review |
| Click tracking | `handlers.ts` | First-party redirect per link |

## Meta setup (checklist)

1. Create a Meta app of type **Business**; add the **Instagram** product and use the *API setup with Instagram login* path. Copy the **Instagram** app ID and secret (not Settings → Basic).
2. Set the OAuth redirect URI and webhook callback (`/webhooks/instagram`) to an HTTPS URL (Cloudflare Tunnel or ngrok locally). Subscribe the `comments` and `messages` fields.
3. Add the deauthorize and data-deletion URLs, plus privacy-policy and terms URLs.
4. **Before App Review, only accounts with the Instagram Tester role can connect.** Invite your test account and accept it in Instagram under Website permissions → Apps and websites → Tester invites.
5. **Publish the app before testing webhooks.** One integration write-up reports that subscriptions succeed but no events arrive until the app is published, which looks exactly like a broken URL.
6. The account must be a Business or Creator account.
7. For real customers, request **Advanced Access** for `instagram_business_basic`, `instagram_business_manage_comments` and `instagram_business_manage_messages`: App Review plus Business Verification. Make at least one successful call per permission first, and record a screencast. Start Business Verification in week 1.

## Run

```bash
cp .env.example .env     # fill in values; TOKEN_ENC_KEY = openssl rand -hex 32
npm install
npm run dev
# 1. open http://localhost:3000/auth/instagram  (via your tunnel URL)
# 2. create a rule:
curl -X POST $PUBLIC_URL/api/rules -H 'content-type: application/json' \
  -d '{"igUserId":"<id from /api/status>","keyword":"GUIDE","message":"Hi {name}! Here is your guide:","link":"https://example.com/guide"}'
# 3. comment GUIDE from a second account on a post
```

## Meta rules baked into the code

- One private reply per comment, within 7 days; on Live, only while the broadcast runs.
- Follow-ups only after the person replies, within 24 hours (use ≤23, as SuperProfile does).
- Published cap: 750 private-reply calls per hour per account.
- No DMs to new followers. Message text ≤ 1000 bytes (UTF-8 bytes, not characters).
- Throttling and transient errors arrive as HTTP 400/5xx with codes 4, 17, 32, 613, 1, 2.
- Code 190 = token dead, stop retrying. Code 10 + subcode 2534022 = 24-hour window closed.
- Long-lived tokens last 60 days and refresh only after 24 hours of age.

## Before production

- Replace the in-memory store with Postgres (`schema.sql`) and the loop with BullMQ or SQS (one limiter per account).
- Authenticate `/api/*` and bind rules to the owner. They are open here for demo only.
- Honour `X-Business-Use-Case-Usage` wait hints (currently a flat 5-minute backoff).
- Check the current Graph API version in the dashboard (`IG_API_VERSION`).
- Confirm the `comments` payload shape with the dashboard Test button.
- Legal: privacy notice, deletion flow and consent under DPDP; get a lawyer to review.
