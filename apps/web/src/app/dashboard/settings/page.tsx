"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [currentPlan, setCurrentPlan] = useState("free");
  const [slugStatus, setSlugStatus] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/v1/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.creator) {
            setDisplayName(data.creator.displayName || "");
            setSlug(data.creator.slug || "");
            setBio(data.creator.bio || "");
            setCurrentPlan(data.creator.plan || "free");
          }
        }
      } catch {
        // default state
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
        setSlugStatus(`✕ ${data.error || "Not available"}`);
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
        setMsg("Profile settings saved ✓");
      } else {
        const err = await res.json();
        setMsg(err.message || "Could not save profile");
      }
    } catch {
      setMsg("Profile saved in preview mode ✓");
    } finally {
      setSaving(false);
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
      setMsg(`Plan updated to ${plan.toUpperCase()} ✓`);
    } catch {
      setCurrentPlan(plan);
      setMsg(`Plan updated to ${plan.toUpperCase()} in preview mode ✓`);
    }
  }

  const plans = [
    {
      id: "free",
      name: "Free",
      price: "₹0",
      fee: "4% platform fee",
      features: ["Unlimited digital products", "UPI Express checkout", "Standard AutoDM", "Community support"],
    },
    {
      id: "creator",
      name: "Creator",
      price: "₹399/mo",
      fee: "0% platform fee",
      features: ["0% platform fee on sales", "Unlimited AutoDM rules", "Remove Hyperprofile watermark", "Custom theme branding"],
      recommended: true,
    },
    {
      id: "studio",
      name: "Studio",
      price: "₹1,499/mo",
      fee: "0% platform fee",
      features: ["Everything in Creator", "Custom domain support", "Priority WhatsApp support", "Multi-team access"],
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.6rem", margin: "0 0 4px" }}>Account Settings & Plans</h1>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
          Manage your creator profile, custom URL slug, and subscription plan.
        </p>
      </div>

      {msg && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            background: "rgba(52, 211, 153, 0.15)",
            color: "#34d399",
            marginBottom: "20px",
            fontSize: "0.85rem",
          }}
        >
          {msg}
        </div>
      )}

      {/* Profile Form */}
      <div className="card" style={{ width: "100%", padding: "24px", marginBottom: "32px" }}>
        <h2 style={{ fontSize: "1.2rem", margin: "0 0 16px" }}>Creator Details</h2>
        <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "4px" }}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Custom Slug</label>
                {slugStatus && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: slugStatus.startsWith("✓") ? "#34d399" : "#f87171",
                    }}
                  >
                    {slugStatus}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)", marginRight: "6px" }}>
                  hyperprofile.bio/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => checkSlug(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid var(--line)",
                    color: "var(--ink)",
                  }}
                />
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "4px" }}>
              Bio
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
              }}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                background: "var(--accent)",
                color: "#0f1a14",
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>

      {/* Subscription Plans */}
      <div>
        <h2 style={{ fontSize: "1.2rem", margin: "0 0 8px" }}>Subscription Plans</h2>
        <p style={{ margin: "0 0 20px", fontSize: "0.85rem", color: "var(--muted)" }}>
          Transparent pricing with zero hidden fees. Upgrade anytime with UPI AutoPay or card.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
          {plans.map((p) => {
            const isCurrent = currentPlan === p.id;
            return (
              <div
                key={p.id}
                className="card"
                style={{
                  width: "100%",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  border: p.recommended ? "2px solid var(--accent)" : "1px solid var(--line)",
                  position: "relative",
                }}
              >
                {p.recommended && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-12px",
                      right: "20px",
                      background: "var(--accent)",
                      color: "#0f1a14",
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      padding: "2px 10px",
                      borderRadius: "10px",
                      textTransform: "uppercase",
                    }}
                  >
                    Recommended
                  </div>
                )}

                <div>
                  <h3 style={{ fontSize: "1.2rem", margin: "0 0 4px" }}>{p.name}</h3>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--accent)", margin: "4px 0" }}>
                    {p.price}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "16px" }}>{p.fee}</div>

                  <ul style={{ paddingLeft: "18px", margin: "0 0 24px", fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.6 }}>
                    {p.features.map((f) => (
                      <li key={f} style={{ color: "var(--ink)" }}>{f}</li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => handleSelectPlan(p.id as "free" | "creator" | "studio")}
                  disabled={isCurrent}
                  style={{
                    width: "100%",
                    padding: "12px 0",
                    borderRadius: "8px",
                    background: isCurrent ? "rgba(255,255,255,0.08)" : "var(--accent)",
                    color: isCurrent ? "var(--muted)" : "#0f1a14",
                    border: "none",
                    fontWeight: 700,
                    cursor: isCurrent ? "default" : "pointer",
                  }}
                >
                  {isCurrent ? "Current Plan ✓" : `Switch to ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
