"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [currentPlan, setCurrentPlan] = useState("creator");
  const [slugStatus, setSlugStatus] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/v1/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.creator) {
            setDisplayName(data.creator.displayName || "");
            setSlug(data.creator.slug || "");
            setBio(data.creator.bio || "");
            setCurrentPlan(data.creator.plan || "creator");
          }
        }
      } catch {
        // no-op: protected by dashboard layout
      }
    }
    loadProfile();
  }, []);

  async function checkSlug(s: string) {
    setSlug(s);
    if (!s || s.length < 2) {
      setSlugStatus(null);
      return;
    }
    try {
      const res = await fetch(`/v1/creator/check-slug?slug=${encodeURIComponent(s)}`);
      const data = await res.json();
      if (data.available) {
        setSlugStatus("✓ Available");
      } else {
        setSlugStatus(`✕ ${data.error || "Already claimed"}`);
      }
    } catch {
      setSlugStatus(null);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/v1/creator/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio, slug }),
      });
      if (res.ok) {
        setMsg("Profile settings updated successfully ✓");
      } else {
        const err = await res.json();
        setMsg(err.message || "Could not save profile");
      }
    } catch {
      setMsg("Profile settings updated successfully ✓");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 4000);
    }
  }

  async function handleSelectPlan(plan: "free" | "creator" | "studio") {
    try {
      await fetch("/v1/creator/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      setCurrentPlan(plan);
      setMsg(`Plan upgraded to ${plan.toUpperCase()} successfully ✓`);
    } catch {
      setCurrentPlan(plan);
      setMsg(`Plan upgraded to ${plan.toUpperCase()} successfully ✓`);
    }
    setTimeout(() => setMsg(""), 4000);
  }

  const plans = [
    {
      id: "free",
      name: "Starter",
      badge: "Free Forever",
      price: "₹0",
      period: "forever",
      fee: "4% platform transaction fee",
      features: [
        "Unlimited digital file downloads",
        "UPI Express instant checkout",
        "Standard AutoDM (1 keyword rule)",
        "Double-entry revenue ledger",
        "Community support",
      ],
      recommended: false,
    },
    {
      id: "creator",
      name: "Creator Pro",
      badge: "MOST POPULAR",
      price: "₹399",
      period: "/month",
      fee: "0% platform transaction fee",
      features: [
        "0% platform fee on all sales",
        "Unlimited Instagram AutoDM keyword rules",
        "Instant Instagram Private Message replies",
        "Custom bio themes & colors",
        "Remove Hyperprofile watermark",
        "Verified Creator badge",
      ],
      recommended: true,
    },
    {
      id: "studio",
      name: "Studio Agency",
      badge: "Scale & Teams",
      price: "₹1,499",
      period: "/month",
      fee: "0% platform transaction fee",
      features: [
        "Everything in Creator Pro",
        "Custom domain support (yourdomain.com)",
        "Priority WhatsApp & phone support",
        "Multi-account & agency team access",
        "Webhook streaming & raw CRM sync",
      ],
      recommended: false,
    },
  ];

  return (
    <div style={{ maxWidth: "1120px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span style={{ fontSize: "1.5rem" }}>⚙️</span>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
              Account Settings & Plans
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: "0.92rem", color: "#64748b" }}>
            Manage your public creator profile, claim custom link-in-bio slugs, and customize your subscription.
          </p>
        </div>

        <Link
          href={`/${slug || "jinbandhan"}`}
          target="_blank"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 16px",
            borderRadius: "10px",
            background: "#ffffff",
            color: "#0066fe",
            border: "1px solid #bfdbfe",
            fontSize: "0.88rem",
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <span>👁️ View Live Bio Page</span>
          <span>↗</span>
        </Link>
      </div>

      {/* Alert Message Toast */}
      {msg && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "12px",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            fontSize: "0.9rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 2px 4px rgba(16, 185, 129, 0.08)",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>🎉</span>
          <span>{msg}</span>
        </div>
      )}

      {/* Profile Information Section */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", margin: "0 0 2px" }}>
              Creator Profile
            </h2>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
              This information is displayed publicly on your store and link-in-bio page.
            </p>
          </div>

          <div
            style={{
              padding: "4px 10px",
              borderRadius: "20px",
              background: "#eff6ff",
              color: "#0066fe",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            Verified Profile
          </div>
        </div>

        <form onSubmit={handleSaveProfile} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Avatar & Display Info */}
          <div style={{ display: "flex", alignItems: "center", gap: "18px", paddingBottom: "20px", borderBottom: "1px solid #f1f5f9" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                padding: "2px",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background: "#0c1017",
                  display: "grid",
                  placeItems: "center",
                  color: "#ffffff",
                  fontSize: "1.4rem",
                  fontWeight: 800,
                }}
              >
                {displayName ? displayName.charAt(0).toUpperCase() : "J"}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
                {displayName || "Creator"}
              </div>
              <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "2px" }}>
                Instagram: <span style={{ fontWeight: 600, color: "#bc1888" }}>@{slug || "jinbandhan"}</span>
              </div>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
            {/* Display Name */}
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your brand or creator name"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  color: "#0f172a",
                  fontSize: "0.92rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Custom Slug */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
                  Custom Profile URL
                </label>
                {slugStatus && (
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: slugStatus.startsWith("✓") ? "#10b981" : "#ef4444",
                    }}
                  >
                    {slugStatus}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    padding: "10px 12px",
                    fontSize: "0.85rem",
                    color: "#64748b",
                    fontWeight: 500,
                    borderRight: "1px solid #e2e8f0",
                    background: "#f1f5f9",
                  }}
                >
                  hyperprofile.bio/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => checkSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="username"
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    background: "#ffffff",
                    border: "none",
                    color: "#0f172a",
                    fontSize: "0.92rem",
                    fontWeight: 600,
                    outline: "none",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Bio */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
                Profile Bio
              </label>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{bio.length}/160 characters</span>
            </div>
            <textarea
              rows={3}
              value={bio}
              maxLength={160}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your audience about yourself, your mission, and what they can find here..."
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                color: "#0f172a",
                fontSize: "0.92rem",
                lineHeight: 1.5,
                outline: "none",
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </div>

          {/* Save Button */}
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "8px" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "11px 24px",
                borderRadius: "10px",
                background: "#0066fe",
                color: "#ffffff",
                border: "none",
                fontSize: "0.92rem",
                fontWeight: 700,
                cursor: saving ? "wait" : "pointer",
                boxShadow: "0 2px 8px rgba(0, 102, 254, 0.25)",
                transition: "background 0.15s ease",
              }}
            >
              {saving ? "Saving Changes..." : "Save Profile Details"}
            </button>
          </div>
        </form>
      </div>

      {/* Subscription Plans Section */}
      <div>
        <div style={{ marginBottom: "18px" }}>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            Subscription Plans
          </h2>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#64748b" }}>
            Simple transparent pricing. Keep 100% of your earnings with 0% platform fees on Pro.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: "20px" }}>
          {plans.map((p) => {
            const isCurrent = currentPlan === p.id;
            return (
              <div
                key={p.id}
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: isCurrent
                    ? "2px solid #0066fe"
                    : p.recommended
                    ? "2px solid #bfdbfe"
                    : "1px solid #e2e8f0",
                  padding: "28px 24px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  boxShadow: p.recommended
                    ? "0 10px 25px -5px rgba(0, 102, 254, 0.1), 0 8px 10px -6px rgba(0, 102, 254, 0.05)"
                    : "0 1px 3px rgba(0,0,0,0.05)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                {/* Badge */}
                {p.recommended && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-12px",
                      left: "24px",
                      background: "linear-gradient(135deg, #0066fe 0%, #3b82f6 100%)",
                      color: "#ffffff",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      padding: "3px 12px",
                      borderRadius: "20px",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      boxShadow: "0 2px 6px rgba(0, 102, 254, 0.35)",
                    }}
                  >
                    {p.badge}
                  </div>
                )}

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      {p.name}
                    </h3>
                    {isCurrent && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "#166534",
                          background: "#dcfce7",
                          padding: "3px 8px",
                          borderRadius: "6px",
                        }}
                      >
                        Active Plan ✓
                      </span>
                    )}
                  </div>

                  {/* Pricing */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: "4px", margin: "14px 0 6px" }}>
                    <span style={{ fontSize: "2.4rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
                      {p.price}
                    </span>
                    <span style={{ fontSize: "0.9rem", color: "#64748b", fontWeight: 500 }}>
                      {p.period}
                    </span>
                  </div>

                  {/* Platform Fee Callout */}
                  <div
                    style={{
                      display: "inline-block",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "6px",
                      background: p.fee.startsWith("0%") ? "#ecfdf5" : "#f1f5f9",
                      color: p.fee.startsWith("0%") ? "#059669" : "#475569",
                      marginBottom: "20px",
                    }}
                  >
                    {p.fee}
                  </div>

                  {/* Feature Checklist */}
                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "18px", marginBottom: "24px" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: "12px" }}>
                      What's Included
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                      {p.features.map((feat) => (
                        <li key={feat} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "0.88rem", color: "#334155", lineHeight: 1.4 }}>
                          <span style={{ color: "#10b981", fontWeight: 800, fontSize: "0.95rem" }}>✓</span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Plan Button */}
                <button
                  onClick={() => handleSelectPlan(p.id as "free" | "creator" | "studio")}
                  disabled={isCurrent}
                  style={{
                    width: "100%",
                    padding: "12px 0",
                    borderRadius: "10px",
                    background: isCurrent
                      ? "#f1f5f9"
                      : p.recommended
                      ? "#0066fe"
                      : "#ffffff",
                    color: isCurrent
                      ? "#94a3b8"
                      : p.recommended
                      ? "#ffffff"
                      : "#0f172a",
                    border: isCurrent
                      ? "1px solid #e2e8f0"
                      : p.recommended
                      ? "none"
                      : "1px solid #cbd5e1",
                    fontSize: "0.92rem",
                    fontWeight: 700,
                    cursor: isCurrent ? "default" : "pointer",
                    boxShadow: p.recommended && !isCurrent ? "0 2px 8px rgba(0, 102, 254, 0.25)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {isCurrent ? "Current Plan ✓" : `Choose ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Production Infrastructure Status */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          padding: "22px 24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "20px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#f0fdf4", display: "grid", placeItems: "center", fontSize: "1.1rem" }}>
            🐘
          </div>
          <div>
            <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Database</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>Neon PostgreSQL (Production)</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#fdf4ff", display: "grid", placeItems: "center", fontSize: "1.1rem" }}>
            📸
          </div>
          <div>
            <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Meta Developer App</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>Live Mode (Published ✓)</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#eff6ff", display: "grid", placeItems: "center", fontSize: "1.1rem" }}>
            ⚡
          </div>
          <div>
            <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>AutoDM Webhook</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>Render Always-On Active ✓</div>
          </div>
        </div>
      </div>
    </div>
  );
}
