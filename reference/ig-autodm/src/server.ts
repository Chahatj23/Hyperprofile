import express from "express";
import { cfg } from "./config.js";
import { encrypt, parseSignedRequest, safeEqual, signState, verifyState, verifyWebhookSignature, decrypt } from "./crypto.js";
import { handleWebhookPayload, trackedTargets } from "./handlers.js";
import * as meta from "./meta.js";
import { queueDepth, startWorker } from "./queue.js";
import { store } from "./store.js";

const app = express();
// Keep the RAW bytes: the signature is over the exact body Meta sent, not re-serialised JSON.
app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false }));

/* ---------- 1. Connect: Business Login for Instagram ---------- */
app.get("/auth/instagram", (req, res) => {
  const owner = String(req.query.owner ?? "demo-owner"); // production: your session's user id
  res.redirect(meta.authorizeUrl(signState({ owner })));
});

app.get("/auth/instagram/callback", async (req, res) => {
  const st = verifyState<{ owner: string }>(String(req.query.state ?? ""));
  if (!st) return res.status(400).send("Invalid or expired state");
  if (req.query.error || !req.query.code) return res.status(400).send(`Authorization declined: ${req.query.error_description ?? "no code"}`);
  try {
    const code = String(req.query.code).replace(/#_$/, "");
    const short = await meta.exchangeCode(code);                 // ~1h token. Never store or expose.
    const long = await meta.toLongLived(short.token);            // 60 days. This is what we persist.
    const me = await meta.getMe(long.token);
    const existed = store.accounts.has(me.user_id);
    store.accounts.set(me.user_id, {
      igUserId: me.user_id, username: me.username, ownerId: st.owner,
      tokenEnc: encrypt(long.token), expiresAt: long.expiresAt,
    });
    try {
      await meta.subscribe(long.token);
      store.accounts.get(me.user_id)!.subscribedAt = Date.now();
    } catch (e) {
      if (!existed) store.accounts.delete(me.user_id);           // don't leave a half-connected account
      throw e;
    }
    res.send(`Connected @${me.username}. Webhooks subscribed.`);
  } catch (e) {
    console.error("[oauth]", e);
    res.status(502).send("Could not connect Instagram. Please try again.");
  }
});

/* ---------- 2. Webhooks ---------- */
app.get("/webhooks/instagram", (req, res) => {              // one-time verification handshake
  if (req.query["hub.mode"] === "subscribe" && safeEqual(String(req.query["hub.verify_token"] ?? ""), cfg.verifyToken)) {
    return res.status(200).send(String(req.query["hub.challenge"]));
  }
  res.sendStatus(403);
});

app.post("/webhooks/instagram", (req: any, res) => {
  if (!verifyWebhookSignature(req.rawBody ?? Buffer.alloc(0), req.header("x-hub-signature-256"))) {
    console.error("[webhook] signature mismatch: alert on this");
    return res.sendStatus(200);                             // 200 on purpose: a retry of the same bytes can't help
  }
  res.sendStatus(200);                                      // ack fast, work async
  try { handleWebhookPayload(req.body); } catch (e) { console.error("[webhook] handler error", e); }
});

/* ---------- 3. Required by App Review: deauthorize + data deletion ---------- */
app.post("/instagram/deauthorize", (req, res) => {
  const p = parseSignedRequest(String(req.body.signed_request ?? ""));
  if (!p?.user_id) return res.sendStatus(400);
  const a = store.accounts.get(p.user_id);
  if (a) { a.tokenEnc = ""; a.reauthAt = Date.now(); }       // access ended; history kept
  res.sendStatus(200);
});

app.post("/instagram/data-deletion", (req, res) => {
  const p = parseSignedRequest(String(req.body.signed_request ?? ""));
  if (!p?.user_id) return res.sendStatus(400);
  store.accounts.delete(p.user_id);                          // production: delete all rows + blobs, then blank creds
  res.json({ url: `${cfg.publicUrl}/instagram/data-deletion/status?code=${p.user_id}`, confirmation_code: p.user_id });
});
app.get("/instagram/data-deletion/status", (req, res) =>
  res.json({ deleted: !store.accounts.has(String(req.query.code)) }));

/* ---------- 4. Demo API + click tracking ---------- */
app.post("/api/rules", (req, res) => {                      // production: authenticate + authorise by owner
  const { igUserId, keyword = "", mediaId, message, link } = req.body ?? {};
  if (!store.accounts.has(igUserId) || !message) return res.status(400).json({ error: "unknown account or missing message" });
  const id = crypto.randomUUID();
  store.rules.set(id, { id, igUserId, keyword, mediaId, message, link, active: true });
  res.json({ id });
});
app.get("/api/status", (_req, res) =>
  res.json({ queueDepth: queueDepth(), claims: Object.fromEntries(store.claims), accounts: [...store.accounts.values()].map(a => ({ u: a.username, exp: a.expiresAt, reauth: !!a.reauthAt })) }));
app.get("/r/:id", (req, res) => {
  const t = trackedTargets.get(req.params.id);
  if (!t) return res.sendStatus(404);
  store.clicks.set(req.params.id, (store.clicks.get(req.params.id) ?? 0) + 1);
  res.redirect(302, t);
});

/* ---------- 5. Hourly token refresh ---------- */
async function refreshDue() {
  for (const a of store.accounts.values()) {
    if (a.reauthAt || !a.tokenEnc) continue;                 // dead tokens can't be refreshed: skip, don't hammer
    if (a.expiresAt > Date.now() + cfg.refreshWithinMs) continue;
    if (a.expiresAt <= Date.now()) { a.reauthAt = Date.now(); continue; }
    try {
      const r = await meta.refreshToken(decrypt(a.tokenEnc));
      a.tokenEnc = encrypt(r.token); a.expiresAt = r.expiresAt;
      await meta.subscribe(r.token);                          // converge on the current field set
    } catch (e) {
      if (e instanceof meta.MetaError && e.kind === "token") a.reauthAt = Date.now();
      console.error("[refresh]", a.username, e);
    }
  }
}
setInterval(refreshDue, 3600_000);

startWorker();
app.listen(cfg.port, () => console.log(`listening on :${cfg.port}`));
