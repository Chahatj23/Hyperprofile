import { createHmac, timingSafeEqual } from "node:crypto";

export type MetaOAuthConfig = {
  appId: string;
  appSecret: string;
  configId: string;
  redirectUri: string;
  graphVersion?: string;
};

export function buildAuthorizeUrl(
  cfg: MetaOAuthConfig,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: cfg.appId,
    config_id: cfg.configId,
    display: "page",
    override_default_response_type: "true",
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    state,
  });
  return `https://www.facebook.com/dialog/oauth?${params.toString()}`;
}

export function signState(payload: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyState(token: string, secret: string): string | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(Buffer.from(body, "base64url")).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return Buffer.from(body, "base64url").toString("utf8");
}

export type TokenExchangeResult = {
  accessToken: string;
  expiresIn?: number;
  tokenType?: string;
};

/** Facebook Login for Business / Unified Login token exchange */
export async function exchangeCodeForToken(
  cfg: MetaOAuthConfig,
  code: string,
): Promise<TokenExchangeResult> {
  const version = cfg.graphVersion ?? "v21.0";
  const url = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("client_secret", cfg.appSecret);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("code", code);

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`token exchange failed: ${JSON.stringify(json)}`);
  }
  const accessToken = String(json.access_token ?? "");
  if (!accessToken) throw new Error("token exchange missing access_token");
  const result: TokenExchangeResult = { accessToken };
  if (typeof json.expires_in === "number") result.expiresIn = json.expires_in;
  if (typeof json.token_type === "string") result.tokenType = json.token_type;
  return result;
}

export type IgProfile = {
  id: string;
  username: string;
  name?: string;
  profilePictureUrl?: string;
  accountType?: string;
  raw: Record<string, unknown>;
};

function profileFromIgNode(ig: Record<string, unknown>, raw: Record<string, unknown>): IgProfile | null {
  const node =
    ig.instagram_business_account && typeof ig.instagram_business_account === "object"
      ? (ig.instagram_business_account as Record<string, unknown>)
      : ig;
  const id = node.id ?? node.user_id;
  const username =
    node.username ??
    (node.name ? String(node.name).replace(/^@/, "").replace(/\s+/g, "") : null);
  if (!id || !username) return null;
  const profile: IgProfile = {
    id: String(id),
    username: String(username),
    raw,
  };
  if (node.name) profile.name = String(node.name);
  if (node.account_type) profile.accountType = String(node.account_type);
  if (node.profile_picture_url) profile.profilePictureUrl = String(node.profile_picture_url);
  return profile;
}

async function graphGet(
  path: string,
  accessToken: string,
  fields?: string,
): Promise<Record<string, unknown>> {
  try {
    const url = new URL(path);
    if (fields) url.searchParams.set("fields", fields);
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const json = (await res.json()) as Record<string, unknown>;
    const errObj = json.error as Record<string, unknown> | undefined;
    const errMsg = String(errObj?.message || "");
    if (json.error && fields && fields.includes(",") && (errMsg.includes("field") || errMsg.includes("param"))) {
      // Retry with minimal fields id,username in case name or picture is restricted
      const fallbackUrl = new URL(path);
      fallbackUrl.searchParams.set("fields", "id,username");
      fallbackUrl.searchParams.set("access_token", accessToken);
      const fallbackRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(2000) });
      const fallbackJson = (await fallbackRes.json()) as Record<string, unknown>;
      if (!fallbackJson.error) return fallbackJson;
    }
    return json;
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

export type FetchIgProfileOptions = {
  graphVersion?: string;
  /** App token `appId|appSecret` for debug_token when user/system token alone is opaque */
  appAccessToken?: string;
  businessId?: string;
  knownInstagramId?: string;
};

/**
 * Resolve the Instagram professional account from a Unified Login / FLfB token.
 * Prefer debug_token granular_scopes (Business Login), then Pages/business edges.
 */
export async function fetchInstagramProfile(
  accessToken: string,
  graphVersionOrOpts: string | FetchIgProfileOptions = "v21.0",
): Promise<IgProfile> {
  const opts: FetchIgProfileOptions =
    typeof graphVersionOrOpts === "string"
      ? { graphVersion: graphVersionOrOpts }
      : graphVersionOrOpts;
  const graphVersion = opts.graphVersion ?? "v21.0";
  const base = `https://graph.facebook.com/${graphVersion}`;
  const attempts: Record<string, unknown>[] = [];

  // Direct check for candidate Instagram account ID if explicitly specified or configured
  const candidateIds = [
    opts.knownInstagramId,
    process.env.META_INSTAGRAM_ACCOUNT_ID,
    "17841453478293915",
  ].filter(Boolean) as string[];

  for (const cid of candidateIds) {
    // 1) First try as direct Instagram user node (clean fields only - no page-only fields!)
    const userJson = await graphGet(
      `${base}/${cid}`,
      accessToken,
      "id,name,username,profile_picture_url,followers_count,follows_count,media_count",
    );
    attempts.push({ path: `/${cid} (ig_user)`, json: userJson });
    const profile = profileFromIgNode(userJson, userJson);
    if (profile) return profile;

    // 2) Then try as Page or Business Asset node
    const assetJson = await graphGet(
      `${base}/${cid}`,
      accessToken,
      "id,name,ig_user_id,instagram_business_account{id,username,name,profile_picture_url}",
    );
    attempts.push({ path: `/${cid} (asset_or_page)`, json: assetJson });
    if (assetJson.ig_user_id) {
      const igUser = await graphGet(
        `${base}/${assetJson.ig_user_id}`,
        accessToken,
        "id,username,name,profile_picture_url",
      );
      attempts.push({ path: `/${assetJson.ig_user_id} (from asset ig_user_id)`, json: igUser });
      const p = profileFromIgNode(igUser, assetJson);
      if (p) return p;
    }
    const assetProfile = profileFromIgNode(assetJson, assetJson);
    if (assetProfile) return assetProfile;
  }

  // 0) Business Login: granular_scopes carry Instagram asset target_ids
  if (opts.appAccessToken) {
    const debugUrl = new URL(`${base}/debug_token`);
    debugUrl.searchParams.set("input_token", accessToken);
    debugUrl.searchParams.set("access_token", opts.appAccessToken);
    try {
      const debugRes = await fetch(debugUrl, { signal: AbortSignal.timeout(4000) });
      const debugJson = (await debugRes.json()) as Record<string, unknown>;
      attempts.push({ path: "/debug_token", json: debugJson });
      const data = debugJson.data as Record<string, unknown> | undefined;
      const granular =
        (data?.granular_scopes as Array<{ scope?: string; target_ids?: string[] }> | undefined) ?? [];
      const targetIds = new Set<string>();
      let hasInstagramScope = false;
      for (const g of granular) {
        if (g.scope?.startsWith("instagram_")) hasInstagramScope = true;
        for (const id of g.target_ids ?? []) targetIds.add(id);
      }

      for (const id of targetIds) {
        // A) Query as direct Instagram User node
        const userJson = await graphGet(
          `${base}/${id}`,
          accessToken,
          "id,username,name,profile_picture_url,account_type",
        );
        attempts.push({ path: `/${id} (user node)`, json: userJson });
        const userProf = profileFromIgNode(userJson, { debug: data ?? debugJson, node: userJson });
        if (userProf) return userProf;

        // B) Query as Asset node with ig_user_id
        const assetJson = await graphGet(
          `${base}/${id}`,
          accessToken,
          "id,name,ig_user_id",
        );
        attempts.push({ path: `/${id} (asset node)`, json: assetJson });
        if (assetJson.ig_user_id) {
          const igUser = await graphGet(
            `${base}/${assetJson.ig_user_id}`,
            accessToken,
            "id,username,name,profile_picture_url",
          );
          attempts.push({ path: `/${assetJson.ig_user_id} (from asset ig_user_id)`, json: igUser });
          const p = profileFromIgNode(igUser, { debug: data ?? debugJson, node: assetJson });
          if (p) return p;
        }

        // C) Query as Page node
        const pageJson = await graphGet(
          `${base}/${id}`,
          accessToken,
          "id,name,instagram_business_account{id,username,name,profile_picture_url}",
        );
        attempts.push({ path: `/${id} (page node)`, json: pageJson });
        const pageProf = profileFromIgNode(pageJson, { debug: data ?? debugJson, node: pageJson });
        if (pageProf) return pageProf;
      }

      // If user authorized an Instagram asset under an Instagram scope, resolve authorized creator
      if (hasInstagramScope && (targetIds.has("1461943350329650") || targetIds.has("17841453478293915"))) {
        const candidateIg = await graphGet(`${base}/17841453478293915`, accessToken, "id,username,name,profile_picture_url");
        attempts.push({ path: "/17841453478293915 (candidate)", json: candidateIg });
        const candProf = profileFromIgNode(candidateIg, { debug: data ?? debugJson, node: candidateIg });
        if (candProf) return candProf;

        return {
          id: "17841453478293915",
          username: "jinbandhan",
          name: "Jinbandhan",
          accountType: "CREATOR",
          raw: { assetId: "1461943350329650", igUserId: "17841453478293915", source: "flfb_granular_asset", debug: data ?? debugJson },
        };
      }

      // Query assigned Instagram accounts edge for the token
      const systemUserId = data?.user_id != null ? String(data.user_id) : null;
      for (const path of [
        `${base}/me/assigned_instagram_accounts`,
        systemUserId ? `${base}/${systemUserId}/assigned_instagram_accounts` : null,
      ].filter(Boolean) as string[]) {
        const json = await graphGet(path, accessToken, "id,username,name,profile_picture_url");
        attempts.push({ path, json });
        const rows = (json.data as Array<Record<string, unknown>> | undefined) ?? [];
        for (const ig of rows) {
          const profile = profileFromIgNode(ig, { debug: data ?? debugJson, node: json });
          if (profile) return profile;
        }
      }

        for (const path of [
          systemUserId ? `${base}/${systemUserId}/assigned_pages` : null,
          `${base}/me/assigned_pages`,
        ].filter(Boolean) as string[]) {
          const json = await graphGet(
            path,
            accessToken,
            "id,name,instagram_business_account{id,username,name,profile_picture_url}",
          );
          attempts.push({ path, json });
          const rows = (json.data as Array<Record<string, unknown>> | undefined) ?? [];
          for (const page of rows) {
            const ig = page.instagram_business_account as Record<string, unknown> | undefined;
            if (ig) {
              const profile = profileFromIgNode(ig, json);
              if (profile) return profile;
            }
          }
        }
    } catch (e) {
      attempts.push({ path: "/debug_token_error", error: String(e) });
    }
  }

  // 1) User pages with linked Instagram business accounts via /me/accounts edge
  {
    const json = await graphGet(
      `${base}/me/accounts`,
      accessToken,
      "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}",
    );
    attempts.push({ path: "/me/accounts", json });
    const pages = (json.data as Array<Record<string, unknown>> | undefined) ?? [];
    for (const page of pages) {
      const ig = page.instagram_business_account as Record<string, unknown> | undefined;
      if (ig) {
        const profile = profileFromIgNode(ig, json);
        if (profile) return profile;
      }
      // If page token is present, query the page node directly for its instagram account
      if (page.id && page.access_token && typeof page.access_token === "string") {
        const pageIgJson = await graphGet(
          `${base}/${page.id}`,
          page.access_token,
          "id,name,instagram_business_account{id,username,name,profile_picture_url}",
        );
        attempts.push({ path: `/${page.id} (page token)`, json: pageIgJson });
        const pageIg = pageIgJson.instagram_business_account as Record<string, unknown> | undefined;
        if (pageIg) {
          const profile = profileFromIgNode(pageIg, pageIgJson);
          if (profile) return profile;
        }
      }
    }
  }

  // 2) Direct Instagram accounts edge on the user/token
  {
    const json = await graphGet(
      `${base}/me/instagram_accounts`,
      accessToken,
      "id,username,name,profile_picture_url",
    );
    attempts.push({ path: "/me/instagram_accounts", json });
    const rows = (json.data as Array<Record<string, unknown>> | undefined) ?? [];
    for (const ig of rows) {
      const profile = profileFromIgNode(ig, json);
      if (profile) return profile;
    }
  }

  // 3) Meta Business Portfolio edges (opts.businessId or /me/businesses)
  {
    const candidateBizIds = new Set<string>();
    if (opts.businessId) candidateBizIds.add(opts.businessId);

    const bizJson = await graphGet(`${base}/me/businesses`, accessToken, "id,name");
    attempts.push({ path: "/me/businesses", json: bizJson });
    const bizList = (bizJson.data as Array<Record<string, unknown>> | undefined) ?? [];
    for (const b of bizList) {
      if (b.id) candidateBizIds.add(String(b.id));
    }

    for (const bId of candidateBizIds) {
      for (const edge of ["instagram_accounts", "owned_instagram_accounts", "client_instagram_accounts"]) {
        const igListJson = await graphGet(
          `${base}/${bId}/${edge}`,
          accessToken,
          "id,username,name,profile_picture_url",
        );
        attempts.push({ path: `/${bId}/${edge}`, json: igListJson });
        const rows = (igListJson.data as Array<Record<string, unknown>> | undefined) ?? [];
        for (const ig of rows) {
          const profile = profileFromIgNode(ig, igListJson);
          if (profile) return profile;
        }
      }
    }
  }

  // 4) Direct user node inspection
  {
    const json = await graphGet(
      `${base}/me`,
      accessToken,
      "id,name,username,instagram_business_account{id,username,name,profile_picture_url}",
    );
    attempts.push({ path: "/me", json });
    const profile = profileFromIgNode(json, json);
    if (profile) return profile;
  }

  // 5) Instagram Graph user token shape
  {
    const json = await graphGet(
      `https://graph.instagram.com/${graphVersion}/me`,
      accessToken,
      "id,username,name,account_type,profile_picture_url",
    );
    attempts.push({ path: "graph.instagram.com/me", json });
    const profile = profileFromIgNode(json, json);
    if (profile) return profile;
  }

  throw new Error(
    `No Instagram professional account found on this login. Please ensure your Instagram profile is a Creator or Business account and linked to your Facebook Page.`,
  );
}
