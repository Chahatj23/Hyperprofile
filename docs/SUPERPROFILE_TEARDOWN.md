# SuperProfile teardown: what it does and how it is probably built

**Method and limits.** This is a functional teardown from *public* evidence only: SuperProfile's own AutoDM guide (updated 27 Oct 2026), its public pricing and product pages, and Meta's official docs. I did not decompile their apps, intercept private API traffic, or bypass anything, and you shouldn't either: it breaches their terms, adds legal risk, and teaches you less than the public record does. Everything under "Observed" is stated by SuperProfile. Everything under "Inferred" is my reasoning and could be wrong.

## 1. Observed: AutoDM behaviour (from their guide)

| Area | What they state |
|---|---|
| Triggers | Comment keyword on posts and Reels (free); Stories, Lives, incoming DMs, any-comment, all-posts (paid) |
| Free plan limits | One keyword per automation; text + button DMs; a "Sent via" footer naming SuperProfile |
| Paid extras | Unlimited keywords, ask-to-follow gate, email collection inside the DM (to Kit, Mailchimp, Klaviyo with tags), follow-ups, Facebook Messenger, multiple IG accounts, `{{Name}}` variable |
| Public comment replies | Up to three rotating replies posted under the comment, so commenters know to check their inbox |
| Follow-ups | Sent within 23 hours of the person's message (one hour inside Meta's 24-hour window) |
| AI intent matching | "Also reply without your keywords": comments with typos, Hinglish, "pls send" are read by AI; DM sent only when confident |
| Link tracking | Links go through a redirect by default (toggle off to send raw). Amazon and Flipkart links are never rewritten, so affiliate attribution and app-open work |
| Comment moderation | Rules for spam/promotion, links, abuse; action per rule: ignore, hide, delete (paid) |
| Scheduler tie-in | Attach an AutoDM to a scheduled post, editable until 10 minutes before publish |
| DM buttons | Can open a SuperProfile product (payment page, course, webinar, 1:1, Telegram community, lead magnet) |
| Not offered | No new-follower trigger (Meta doesn't allow it) |
| Other | Their own MCP server so Claude/ChatGPT can draft automations (changes are prepared, not auto-published); marketing site is on Webflow |

## 2. Inferred architecture

```
Creator  --Business Login--> Instagram OAuth --> token store (encrypted, 60-day refresh)
IG --webhook(comments,messages)--> receiver --verify HMAC--> queue
queue --> rule matcher (keyword | media | AI intent) --> claim(comment_id) --> send worker
send worker --(per-account limiter)--> POST /{ig-id}/messages {recipient:{comment_id}}
send worker --> optional public reply (comments API) --> click-tracking redirect
DM button/link --> /r/:id --> product checkout (the commerce side of the platform)
```

Why I believe each piece exists (reasoning, not proof):
- **Claim-before-send + one reply per comment:** Meta enforces one private reply per comment, and their docs on failures mention lapsed plans and older comments. A duplicate-safe claim is the only sane way to handle webhook redelivery.
- **23-hour follow-up cutoff:** a deliberate safety margin below Meta's 24 hours. Copy it.
- **Queue and per-account limiting:** a viral Reel would otherwise exceed the 750/hour ceiling. Free-tier footers and rotating public replies suggest per-message variation logic in the sender.
- **AI intent matching:** a classifier call per non-matching comment with a confidence threshold. The cost scales with comment volume, which is probably why it's paid-only.
- **Redirect tracking with carve-outs:** a plain short-link service, with domain allow-lists to avoid breaking affiliate deep links.
- **Product-linked buttons:** AutoDM and commerce share one database of products, so a button is a foreign key to a product, not a free URL. This coupling is their real moat: automation that sells.

## 3. What this means for your build

1. The *feature list* is copyable; the *reliability* is the product. Idempotency, queueing, token refresh and honest error messages decide whether creators trust you.
2. Free-tier "Sent via" footers are a growth loop: every DM is an advertisement.
3. Gaps to exploit: regional-language intent matching, a no-footer free tier, WhatsApp follow-up, and clearer failure explanations ("window closed at 14:02" beats "DM failed").
4. Tie buttons to products from day one.

## 4. Unverified (check before relying)
- SuperProfile's real stack, volumes and Meta app status beyond what they publish.
- Exact `comments` webhook field names on your Graph API version (use the dashboard Test button).
- Whether ask-to-follow gating has an official field you can call. I did not verify one, so the reference code omits it.
