"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

type InsightMetric = {
  name: string;
  period: string | null;
  title: string | null;
  description: string | null;
  values: Array<{ value: number | string | Record<string, unknown>; endTime?: string }>;
};

type MediaItem = {
  id: string;
  caption: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
  likeCount: number | null;
  commentsCount: number | null;
  insights: InsightMetric[];
};

type Overview = {
  accountId: string;
  linkedAt: string;
  profile: {
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
  media: MediaItem[];
  insights: InsightMetric[];
  warnings: string[];
};

type ActivityItem = {
  id: string;
  type: "follower" | "comment" | "autodm" | "like" | "engagement" | "order" | "profile";
  title: string;
  description: string;
  timestamp: string;
  status: "verified" | "active" | "delivered" | "info";
  badge: string;
  actor?: string;
};

export default function DashboardInsightsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectedAccount, setConnectedAccount] = useState<string>("jinbandhan");
  const [pending, startTransition] = useTransition();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"overview" | "media" | "activity">("overview");

  // Activity stream state
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const loadOverview = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/v1/ig/overview", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          setData(json);
          if (json.profile?.username) {
            setConnectedAccount(json.profile.username);
          }
        } else {
          const json = await res.json();
          setError(json.message || "Unable to fetch insights from Meta");
        }
      } catch (err) {
        setError(String(err));
      }
    });
  }, []);

  const loadActivities = useCallback(async () => {
    try {
      const res = await fetch("/v1/ig/activity");
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.activities)) {
          setActivities(json.activities);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadOverview();
    loadActivities();
    const interval = setInterval(() => {
      loadActivities();
    }, 4000);
    return () => clearInterval(interval);
  }, [loadOverview, loadActivities]);

  // Extract real metric values from Meta Graph response
  const reachMetric = data?.insights.find((m) => m.name === "reach")?.values[0]?.value ?? (pending ? "…" : 0);
  const viewsMetric = data?.insights.find((m) => m.name === "views")?.values[0]?.value ?? (pending ? "…" : 0);
  const interactionsMetric = data?.insights.find((m) => m.name === "total_interactions")?.values[0]?.value ?? (pending ? "…" : 0);
  const engagedMetric = data?.insights.find((m) => m.name === "accounts_engaged")?.values[0]?.value ?? (pending ? "…" : 0);
  const profileViewsMetric = data?.insights.find((m) => m.name === "profile_views")?.values[0]?.value ?? (pending ? "…" : 0);
  const websiteClicksMetric = data?.insights.find((m) => m.name === "website_clicks")?.values[0]?.value ?? (pending ? "…" : 0);

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", color: "#111827", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: "#111827", letterSpacing: "-0.02em" }}>
              SuperAds &amp; Instagram Insights
            </h1>
            <span style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: "12px", background: "#d1fae5", color: "#065f46", fontWeight: 700 }}>
              ● Live Meta Graph v21.0
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6b7280" }}>
            Real-time analytics, followers growth, and media engagement directly from <strong>@{connectedAccount}</strong>.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={() => { loadOverview(); loadActivities(); }}
            disabled={pending}
            style={{
              padding: "9px 16px",
              borderRadius: "20px",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              color: "#374151",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: pending ? "wait" : "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            {pending ? "Refreshing…" : "↻ Refresh"}
          </button>

          <Link
            href="/dashboard/autodm"
            style={{
              padding: "10px 20px",
              borderRadius: "20px",
              background: "#0066fe",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: "0.88rem",
              fontWeight: 600,
              boxShadow: "0 2px 8px rgba(0, 102, 254, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>⚡</span> Open AutoDM Studio
          </Link>
        </div>
      </div>

      {/* Connected Account Banner Card */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #f0f0f0",
          padding: "20px 24px",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Story Gradient Ring */}
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              padding: "2.5px",
              background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: "1.2rem",
                color: "#1e293b",
              }}
            >
              🏛️
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#111827" }}>
                @{data?.profile.username || connectedAccount}
              </h2>
              <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: "10px", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700 }}>
                Verified Business
              </span>
            </div>
            <div style={{ fontSize: "0.82rem", color: "#6b7280", marginTop: "4px" }}>
              Instagram Business ID: <code>{data?.profile.id || "17841453478293915"}</code> · Connected Meta Page ID: <code>1455386567656707</code>
            </div>
          </div>
        </div>

        {/* Real Profile Stats */}
        <div style={{ display: "flex", gap: "32px", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#111827" }}>
              {data?.profile.followersCount ?? 1}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>Followers</div>
          </div>

          <div style={{ width: "1px", height: "30px", background: "#e5e7eb" }} />

          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#111827" }}>
              {data?.profile.followsCount ?? 2}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>Following</div>
          </div>

          <div style={{ width: "1px", height: "30px", background: "#e5e7eb" }} />

          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#111827" }}>
              {data?.profile.mediaCount ?? (data?.media?.length || 1)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>Posts</div>
          </div>
        </div>
      </div>

      {/* Tabs matching SuperProfile styling */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        {[
          { id: "overview", label: "Analytics Overview" },
          { id: "media", label: `Posts & Reels (${data?.media?.length || 1})` },
          { id: "activity", label: `Activity Stream (${activities.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as any)}
            style={{
              padding: "8px 18px",
              borderRadius: "20px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: activeTab === t.id ? "#111827" : "#ffffff",
              color: activeTab === t.id ? "#ffffff" : "#4b5563",
              boxShadow: activeTab === t.id ? "0 2px 6px rgba(0,0,0,0.15)" : "0 1px 3px rgba(0,0,0,0.03)",
              transition: "all 0.15s ease",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW METRICS                                                   */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* 6 Core Meta Graph API Metrics Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            {[
              { label: "ACCOUNTS REACHED", value: String(reachMetric), sub: "Unique accounts reached", icon: "🌐" },
              { label: "VIEWS / IMPRESSIONS", value: String(viewsMetric), sub: "Total impressions on posts", icon: "👁️" },
              { label: "CONTENT INTERACTIONS", value: String(interactionsMetric), sub: "Likes, comments & shares", icon: "💬" },
              { label: "ACCOUNTS ENGAGED", value: String(engagedMetric), sub: "Interacted with content", icon: "🔥" },
              { label: "PROFILE VISITS", value: String(profileViewsMetric), sub: "Profile visits recorded", icon: "👤" },
              { label: "WEBSITE CLICKS", value: String(websiteClicksMetric), sub: "Bio link taps", icon: "🔗" },
            ].map((card, i) => (
              <div
                key={i}
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #f0f0f0",
                  padding: "20px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {card.label}
                  </span>
                  <span style={{ fontSize: "1.1rem" }}>{card.icon}</span>
                </div>
                <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>
                  {card.value}
                </div>
                <div style={{ fontSize: "0.76rem", color: "#9ca3af", marginTop: "6px" }}>
                  {card.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Featured Post Card */}
          {data?.media && data.media.length > 0 && (
            <div
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                border: "1px solid #f0f0f0",
                padding: "24px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#111827" }}>
                  Active Post on @{connectedAccount}
                </h3>
                <Link
                  href="/dashboard/autodm"
                  style={{
                    fontSize: "0.82rem",
                    color: "#0066fe",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Configure AutoDM for this Post →
                </Link>
              </div>

              <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div
                  style={{
                    width: "120px",
                    height: "120px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "1px solid #e5e7eb",
                    flexShrink: 0,
                    position: "relative",
                  }}
                >
                  <img
                    src={data.media[0].mediaUrl || data.media[0].thumbnailUrl || ""}
                    alt="post"
                    referrerPolicy="no-referrer"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <span style={{ position: "absolute", bottom: "4px", right: "4px", fontSize: "0.7rem", background: "rgba(0,0,0,0.6)", padding: "2px 4px", borderRadius: "4px", color: "#fff" }}>
                    📸 Feed
                  </span>
                </div>

                <div style={{ flex: 1, minWidth: "260px" }}>
                  <div style={{ fontSize: "0.9rem", color: "#374151", lineHeight: 1.5, marginBottom: "12px" }}>
                    {data.media[0].caption}
                  </div>

                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      ❤️ <strong>{data.media[0].likeCount ?? 0}</strong> Likes
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      💬 <strong>{data.media[0].commentsCount ?? 0}</strong> Comments
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      👁️ <strong>{String(data.media[0].insights?.find((i) => i.name === "views")?.values?.[0]?.value ?? viewsMetric)}</strong> Views
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      🌐 <strong>{String(data.media[0].insights?.find((i) => i.name === "reach")?.values?.[0]?.value ?? reachMetric)}</strong> Reach
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MEDIA GALLERY                                                      */}
      {/* ========================================================================= */}
      {activeTab === "media" && (
        <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #f0f0f0", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 16px", color: "#111827" }}>
            Instagram Media &amp; Reels Catalog
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "18px" }}>
            {data?.media?.map((m) => (
              <div
                key={m.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  background: "#ffffff",
                }}
              >
                <div style={{ position: "relative", width: "100%", height: "200px" }}>
                  <img
                    src={m.mediaUrl || m.thumbnailUrl || ""}
                    alt="media"
                    referrerPolicy="no-referrer"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <span style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: "0.7rem", padding: "2px 6px", borderRadius: "6px" }}>
                    {m.mediaType === "VIDEO" ? "🎬 Reel" : "📸 Post"}
                  </span>
                </div>

                <div style={{ padding: "14px", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
                  <div style={{ fontSize: "0.82rem", color: "#374151", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: "12px" }}>
                    {m.caption}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f3f4f6", paddingTop: "10px" }}>
                    <div style={{ fontSize: "0.78rem", color: "#6b7280" }}>
                      ❤️ {m.likeCount ?? 0} · 💬 {m.commentsCount ?? 0}
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      {m.permalink && (
                        <a
                          href={m.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "6px 10px",
                            borderRadius: "8px",
                            background: "#f1f5f9",
                            color: "#475569",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          IG ↗
                        </a>
                      )}
                      <Link
                        href={`/dashboard/autodm?mediaId=${m.id}`}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        AutoDM ⚡
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ACTIVITY STREAM                                                    */}
      {/* ========================================================================= */}
      {activeTab === "activity" && (
        <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #f0f0f0", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#111827" }}>
              Live Activity Log for @{connectedAccount}
            </h3>
            <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 600 }}>
              ● Live Sync Active
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {activities.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>
                No activity recorded yet.
              </div>
            ) : (
              activities.map((a) => (
                <div
                  key={a.id}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: "1px solid #f3f4f6",
                    background: "#f9fafb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        background:
                          a.type === "autodm"
                            ? "#dbeafe"
                            : a.type === "like"
                            ? "#fee2e2"
                            : a.type === "comment"
                            ? "#dcfce7"
                            : "#f3e8ff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "1rem",
                      }}
                    >
                      {a.type === "autodm" ? "⚡" : a.type === "like" ? "❤️" : a.type === "comment" ? "💬" : "👥"}
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#111827" }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: "2px" }}>
                        {a.description.replace(/\s+on\s+media\s+\d+/gi, "").replace(/\s+on\s+Post\s+\d+/gi, "")}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: "10px", background: "#ffffff", border: "1px solid #e5e7eb", color: "#4b5563", fontWeight: 600 }}>
                      {a.badge}
                    </span>
                    <div style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: "4px" }}>
                      {new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
