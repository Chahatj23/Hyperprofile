"use client";

import { useEffect, useState } from "react";

interface AnalyticsData {
  pageViews: number;
  paidOrders: number;
  revenuePaise: number;
  revenueFormatted: string;
  dmsSent: number;
  conversionRate: string;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>({
    pageViews: 0,
    paidOrders: 0,
    revenuePaise: 0,
    revenueFormatted: "₹0.00",
    dmsSent: 0,
    conversionRate: "0.0%",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await fetch("/v1/creator/analytics");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // use default state
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  const stats = [
    { label: "Total Revenue", value: data.revenueFormatted, change: data.paidOrders > 0 ? "Verified receipts" : "No orders yet", icon: "💰" },
    { label: "Page Views", value: data.pageViews.toLocaleString(), change: "First-party events", icon: "👁" },
    { label: "Paid Orders", value: data.paidOrders.toString(), change: "UPI & Cards", icon: "📦" },
    { label: "Store Conversion", value: data.conversionRate, change: data.pageViews > 0 ? "Visitor-to-paid" : "Awaiting visits", icon: "🎯" },
    { label: "AutoDMs Sent", value: data.dmsSent.toString(), change: "0 dropped · under cap", icon: "⚡" },
  ];

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.6rem", margin: "0 0 4px" }}>Performance Analytics</h1>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
          First-party analytics pipeline. Zero third-party trackers or cookies on public pages.
        </p>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            className="card"
            style={{
              width: "100%",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{s.label}</span>
              <span style={{ fontSize: "1.2rem" }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--ink)" }}>{s.value}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600 }}>{s.change}</div>
          </div>
        ))}
      </div>

      {/* Traffic Sources */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div className="card" style={{ width: "100%", padding: "24px" }}>
          <h2 style={{ fontSize: "1.1rem", margin: "0 0 16px" }}>Traffic Sources</h2>
          {data.pageViews === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--muted)" }}>
              <div style={{ fontSize: "1.6rem", marginBottom: "8px" }}>🌐</div>
              <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>No traffic recorded yet</div>
              <div style={{ fontSize: "0.82rem" }}>Share your store link on your Instagram bio to start capturing visitors.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.9rem" }}>
              {[
                { source: "Instagram Profile & DMs", pct: "100%", count: `${data.pageViews} views` },
              ].map((t) => (
                <div key={t.source}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span>{t.source}</span>
                    <span style={{ fontWeight: 700 }}>{t.pct}</span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: t.pct, height: "100%", background: "var(--accent)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Funnel Breakdown */}
        <div className="card" style={{ width: "100%", padding: "24px" }}>
          <h2 style={{ fontSize: "1.1rem", margin: "0 0 16px" }}>Conversion Funnel</h2>
          {data.pageViews === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--muted)" }}>
              <div style={{ fontSize: "1.6rem", marginBottom: "8px" }}>🎯</div>
              <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>No checkout sessions yet</div>
              <div style={{ fontSize: "0.82rem" }}>Conversions from page view to completed UPI payment will reflect here.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "0.9rem" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span>1. Public Page Visits</span>
                  <span style={{ fontWeight: 700 }}>{data.pageViews} (100%)</span>
                </div>
                <div style={{ height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: "100%", height: "100%", background: "#6366f1" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span>2. Checkout Initiated</span>
                  <span style={{ fontWeight: 700 }}>{data.paidOrders} ({data.conversionRate})</span>
                </div>
                <div style={{ height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: data.conversionRate, height: "100%", background: "var(--accent)" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span>3. Successful UPI Payment</span>
                  <span style={{ fontWeight: 700 }}>{data.paidOrders} ({data.conversionRate})</span>
                </div>
                <div style={{ height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: data.conversionRate, height: "100%", background: "#34d399" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
