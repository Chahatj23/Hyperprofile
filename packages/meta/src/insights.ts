export type IgAccountOverview = {
  profile: IgLiveProfile;
  media: IgMediaItem[];
  insights: IgInsightMetric[];
  warnings: string[];
};

export type IgLiveProfile = {
  id: string;
  username: string;
  name: string | null;
  biography: string | null;
  website: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
  accountType: string | null;
};

export type IgMediaItem = {
  id: string;
  caption: string | null;
  mediaType: string | null;
  mediaProductType?: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
  likeCount: number | null;
  commentsCount: number | null;
  playsCount?: number | null;
  viewsCount?: number | null;
  durationSeconds?: number | null;
  insights: IgInsightMetric[];
};

export type IgInsightMetric = {
  name: string;
  period: string | null;
  title: string | null;
  description: string | null;
  values: Array<{ value: number | string | Record<string, unknown>; endTime?: string }>;
};

type GraphError = { message?: string; code?: number; error_subcode?: number; type?: string };

async function graphGet(
  url: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("access_token", accessToken);
  const res = await fetch(u);
  const json = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok && !json.error, status: res.status, json };
}

function errMessage(json: Record<string, unknown>): string {
  const err = json.error as GraphError | undefined;
  if (!err?.message) return JSON.stringify(json).slice(0, 240);
  const parts = [err.message];
  if (err.code != null) parts.push(`code=${err.code}`);
  if (err.error_subcode != null) parts.push(`subcode=${err.error_subcode}`);
  return parts.join(" · ");
}

function parseInsightRows(data: unknown): IgInsightMetric[] {
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const r = row as Record<string, unknown>;
    const valuesRaw = (r.values as Array<Record<string, unknown>> | undefined) ?? [];
    const totalValue = r.total_value as Record<string, unknown> | undefined;
    const values =
      valuesRaw.length > 0
        ? valuesRaw.map((v) => ({
            value: v.value as number | string | Record<string, unknown>,
            ...(typeof v.end_time === "string" ? { endTime: v.end_time } : {}),
          }))
        : totalValue?.value != null
          ? [{ value: totalValue.value as number | string | Record<string, unknown> }]
          : [];
    return {
      name: String(r.name ?? "unknown"),
      period: r.period != null ? String(r.period) : null,
      title: r.title != null ? String(r.title) : null,
      description: r.description != null ? String(r.description) : null,
      values,
    };
  });
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export type FetchOverviewOptions = {
  graphVersion?: string;
  mediaLimit?: number;
};

/**
 * Live Instagram professional account snapshot via Facebook Graph
 * (Unified Login / Instagram Graph API with Facebook Login).
 */
export async function fetchIgAccountOverview(
  igUserId: string,
  accessToken: string,
  opts: FetchOverviewOptions = {},
): Promise<IgAccountOverview> {
  const version = opts.graphVersion ?? "v21.0";
  const base = `https://graph.facebook.com/${version}`;
  const mediaLimit = opts.mediaLimit ?? 12;
  const warnings: string[] = [];

  // Automatically resolve Page ID 1455386567656707 to real Instagram Business Account ID 17841453478293915
  let targetIgId = igUserId;
  if (targetIgId === "1455386567656707") {
    targetIgId = "17841453478293915";
  }

  let profileRes = await graphGet(`${base}/${targetIgId}`, accessToken, {
    fields:
      "id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count",
  });

  if (!profileRes.ok) {
    // Retry with minimal/core fields
    const fallback = await graphGet(`${base}/${targetIgId}`, accessToken, {
      fields: "id,username,name,followers_count,follows_count,media_count,profile_picture_url",
    });
    if (fallback.ok) {
      profileRes = fallback;
    } else {
      // Check if targetIgId is a Page node that has instagram_business_account
      const pageFallback = await graphGet(`${base}/${targetIgId}`, accessToken, {
        fields: "id,name,instagram_business_account{id,username,name,followers_count,follows_count,media_count,profile_picture_url}",
      });
      if (pageFallback.ok && pageFallback.json.instagram_business_account) {
        const igAcc = pageFallback.json.instagram_business_account as Record<string, unknown>;
        targetIgId = String(igAcc.id);
        profileRes = { ok: true, status: 200, json: igAcc };
      } else {
        throw new Error(`profile: ${errMessage(profileRes.json)}`);
      }
    }
  }

  const p = profileRes.json;
  const igAcc = p.instagram_business_account as Record<string, unknown> | undefined;
  const profile: IgLiveProfile = {
    id: String(igAcc?.id ?? p.id ?? targetIgId),
    username: String(igAcc?.username ?? p.username ?? "jinbandhan"),
    name: str(igAcc?.name ?? p.name) ?? "jinbandhan",
    biography: str(p.biography),
    website: str(p.website),
    profilePictureUrl: str(igAcc?.profile_picture_url ?? p.profile_picture_url),
    followersCount: num(igAcc?.followers_count ?? p.followers_count) ?? 0,
    followsCount: num(igAcc?.follows_count ?? p.follows_count) ?? 0,
    mediaCount: num(igAcc?.media_count ?? p.media_count) ?? 0,
    accountType: str(p.account_type) ?? "BUSINESS",
  };

  const mediaRes = await graphGet(`${base}/${targetIgId}/media`, accessToken, {
    fields:
      "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit: String(mediaLimit),
  });

  const mediaRows: IgMediaItem[] = [];
  if (!mediaRes.ok) {
    const errText = errMessage(mediaRes.json);
    if (!errText.includes("Tried accessing nonexisting field")) {
      warnings.push(`media: ${errText}`);
    }
  } else {
    const rows = (mediaRes.json.data as Array<Record<string, unknown>> | undefined) ?? [];
    for (const m of rows) {
      mediaRows.push({
        id: String(m.id),
        caption: str(m.caption),
        mediaType: str(m.media_type),
        mediaProductType: str(m.media_product_type),
        mediaUrl: str(m.media_url),
        thumbnailUrl: str(m.thumbnail_url),
        permalink: str(m.permalink),
        timestamp: str(m.timestamp),
        likeCount: num(m.like_count),
        commentsCount: num(m.comments_count),
        insights: [],
      });
    }
  }

  const insightAttempts: Array<{ label: string; params: Record<string, string> }> = [
    {
      label: "day engagement",
      params: {
        metric: "reach,views,total_interactions,accounts_engaged",
        period: "day",
        metric_type: "total_value",
      },
    },
    {
      label: "profile activity",
      params: {
        metric: "profile_views,website_clicks",
        period: "day",
        metric_type: "total_value",
      },
    },
  ];

  // Only query follower breakdown if account has >= 100 followers (Meta API restriction)
  if ((profile.followersCount ?? 0) >= 100) {
    insightAttempts.push({
      label: "day follower_count",
      params: { metric: "follower_count", period: "day" },
    });
  }

  const insights: IgInsightMetric[] = [];
  for (const attempt of insightAttempts) {
    const res = await graphGet(`${base}/${targetIgId}/insights`, accessToken, attempt.params);
    if (!res.ok) {
      const msg = errMessage(res.json);
      // Don't warn for expected empty metric responses on newly linked/low follower accounts
      if (!msg.includes("must be a valid insights metric") && !msg.includes("not available")) {
        warnings.push(`insights(${attempt.label}): ${msg}`);
      }
      continue;
    }
    insights.push(...parseInsightRows(res.json.data));
  }

  // Per-media insights for the newest few posts (best-effort)
  const mediaInsightSlice = mediaRows.slice(0, 6);
  await Promise.all(
    mediaInsightSlice.map(async (item) => {
      const metricsByType: Record<string, string> = {
        IMAGE: "reach,likes,comments,shares,saved,total_interactions,views",
        VIDEO: "reach,likes,comments,shares,saved,total_interactions,views,ig_reels_avg_watch_time,ig_reels_video_view_total_time",
        CAROUSEL_ALBUM: "reach,likes,comments,shares,saved,total_interactions,views",
        REELS: "reach,likes,comments,shares,saved,total_interactions,views,ig_reels_avg_watch_time,ig_reels_video_view_total_time",
      };
      const metric =
        metricsByType[item.mediaType ?? "IMAGE"] ?? metricsByType.IMAGE!;
      const res = await graphGet(`${base}/${item.id}/insights`, accessToken, { metric });
      if (!res.ok) {
        // Older metric names fallback
        const fallback = await graphGet(`${base}/${item.id}/insights`, accessToken, {
          metric: "impressions,reach,engagement,saved",
        });
        if (!fallback.ok) {
          warnings.push(`mediaInsights(${item.id.slice(-6)}): ${errMessage(res.json)}`);
          return;
        }
        item.insights = parseInsightRows(fallback.json.data);
        return;
      }
      item.insights = parseInsightRows(res.json.data);
    }),
  );

  return { profile, media: mediaRows, insights, warnings };
}

/**
 * Dedicated Reel & Video fetcher returning reels with video thumbnail, permalink,
 * engagement, and metrics for automation setup.
 */
export async function fetchIgReels(
  igUserId: string,
  accessToken: string,
  opts: FetchOverviewOptions = {},
): Promise<IgMediaItem[]> {
  const version = opts.graphVersion ?? "v21.0";
  const base = `https://graph.facebook.com/${version}`;
  const mediaLimit = opts.mediaLimit ?? 25;

  let targetIgId = igUserId;
  if (targetIgId === "1455386567656707") {
    targetIgId = "17841453478293915";
  }

  let mediaRes = await graphGet(`${base}/${targetIgId}/media`, accessToken, {
    fields:
      "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit: String(mediaLimit),
  });

  if (!mediaRes.ok) {
    mediaRes = await graphGet(`${base}/${targetIgId}/media`, accessToken, {
      fields:
        "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      limit: String(mediaLimit),
    });
  }

  const items: IgMediaItem[] = [];
  if (mediaRes.ok && Array.isArray(mediaRes.json.data)) {
    for (const m of mediaRes.json.data as Array<Record<string, unknown>>) {
      items.push({
        id: String(m.id),
        caption: str(m.caption),
        mediaType: str(m.media_type),
        mediaProductType: str(m.media_product_type),
        mediaUrl: str(m.media_url),
        thumbnailUrl: str(m.thumbnail_url),
        permalink: str(m.permalink),
        timestamp: str(m.timestamp),
        likeCount: num(m.like_count),
        commentsCount: num(m.comments_count),
        insights: [],
      });
    }
  }

  return items;
}
