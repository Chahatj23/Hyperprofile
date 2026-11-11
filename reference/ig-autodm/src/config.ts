function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}
export const cfg = {
  appId: req("IG_APP_ID"),
  appSecret: req("IG_APP_SECRET"),
  redirectUri: req("IG_REDIRECT_URI"),
  verifyToken: req("IG_WEBHOOK_VERIFY_TOKEN"),
  apiVersion: process.env.IG_API_VERSION ?? "v26.0",
  publicUrl: req("PUBLIC_URL"),
  tokenKeyHex: req("TOKEN_ENC_KEY"),
  stateSecret: req("STATE_SECRET"),
  port: Number(process.env.PORT ?? 3000),
  // Meta's published ceiling is 750 private replies/hour/account. Stay under it.
  hourlyCap: 700,
  replyWindowMs: 7 * 24 * 3600 * 1000,
  refreshWithinMs: 3 * 24 * 3600 * 1000,
};
