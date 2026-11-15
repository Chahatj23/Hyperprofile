"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";

function ConnectInner() {
  const params = useSearchParams();
  const ok = params.get("ok");
  const username = params.get("username");
  const error = params.get("error");
  const sessionToken = params.get("session_token");

  const [connectedAccount, setConnectedAccount] = useState<string | null>(username || null);
  const [currentUser, setCurrentUser] = useState<{ email?: string; slug?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  if (typeof window !== "undefined" && sessionToken) {
    try {
      const isHttps = window.location.protocol === "https:";
      document.cookie = `hp_session=${sessionToken}; path=/; max-age=2592000; SameSite=Lax${isHttps ? "; Secure" : ""}`;
      localStorage.setItem("hp_token", sessionToken);
    } catch {}
  }

  async function launchWorkspace(dest: string) {
    const token = typeof window !== "undefined" ? localStorage.getItem("hp_token") : null;
    const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (token) authHeaders.Authorization = `Bearer ${token}`;

    if (connectedAccount) {
      try {
        await fetch("/v1/ig/accounts/connect", {
          method: "POST",
          headers: authHeaders,
          credentials: "include",
          body: JSON.stringify({ username: connectedAccount }),
        });
      } catch {}
    }
    window.location.href = dest;
  }

  useEffect(() => {
    async function checkAuthAndAccounts() {
      const token = typeof window !== "undefined" ? localStorage.getItem("hp_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      try {
        const authRes = await fetch("/v1/auth/me", {
          credentials: "include",
          headers: Object.keys(headers).length ? headers : undefined,
        });
        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData?.user) {
            setCurrentUser(authData.user);
            if (authData.instagram?.username) {
              setConnectedAccount(authData.instagram.username);
            }
          }
        } else {
          window.location.href = "/login?next=/connect";
          return;
        }
      } catch {
        window.location.href = "/login?next=/connect";
        return;
      }

      try {
        const res = await fetch("/v1/ig/accounts", {
          credentials: "include",
          headers: Object.keys(headers).length ? headers : undefined,
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setConnectedAccount(json.data[0].username);
          }
        }
      } catch {
        // use query param fallback
      } finally {
        setLoading(false);
      }
    }
    checkAuthAndAccounts();
  }, []);

  return (
    <main className="shell">
      <section className="card" style={{ maxWidth: "580px", margin: "0 auto" }}>
        <h1 className="brand">Instagram Connection</h1>
        <p className="lede">
          Connect your Instagram Professional account (Creator or Business) to enable official Meta AutoDM keyword replies and live profile analytics.
        </p>

        {connectedAccount ? (
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                padding: "24px 20px",
                background: "rgba(52, 211, 153, 0.08)",
                border: "1px solid rgba(52, 211, 153, 0.3)",
                borderRadius: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 800,
                      fontSize: "1.1rem",
                      color: "#fff",
                    }}
                  >
                    IG
                  </div>
                  <div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--ink)" }}>
                      @{connectedAccount}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#34d399", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                      <span>●</span> Instagram Professional Account Connected
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: "16px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    background: "rgba(52, 211, 153, 0.15)",
                    color: "#34d399",
                    border: "1px solid rgba(52, 211, 153, 0.3)",
                  }}
                >
                  ACTIVE
                </span>
              </div>

              <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => launchWorkspace("/dashboard/autodm")}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    background: "var(--accent)",
                    color: "#0f1a14",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  ⚡ AutoDM Rules &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => launchWorkspace("/dashboard/insights")}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.08)",
                    color: "var(--ink)",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    border: "1px solid var(--line)",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  📸 Live Insights &rarr;
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", color: "#f87171", fontSize: "0.85rem", marginBottom: "20px" }}>
              ⚠ Instagram is currently not connected. Click below to connect via official Meta OAuth:
            </div>

            {error && (
              <div style={{ marginBottom: "20px" }}>
                <div className="status err" style={{ marginBottom: "12px", padding: "12px 14px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "10px", color: "#f87171", fontSize: "0.86rem" }}>
                  <strong>Connection Error:</strong> {error}
                </div>

                <div style={{ padding: "16px", background: "rgba(2, 132, 199, 0.06)", border: "1px solid rgba(2, 132, 199, 0.2)", borderRadius: "12px", fontSize: "0.82rem", lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>💡</span> How to solve this in 3 quick steps:
                  </div>
                  <ol style={{ paddingLeft: "18px", margin: "0 0 10px", color: "var(--ink)" }}>
                    <li style={{ marginBottom: "6px" }}>
                      <strong>Switch to Creator Profile:</strong> In your Instagram mobile app &rarr; <em>Settings</em> &rarr; <em>Account type and tools</em> &rarr; tap <strong>Switch to Professional Account</strong> (select <em>Creator</em>). Personal accounts are blocked by Meta's Graph API.
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      <strong>Link a Facebook Page:</strong> In your Instagram app &rarr; <em>Edit Profile</em> &rarr; <em>Public Business Information / Page</em> &rarr; link or create a free Facebook Page.
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      <strong>Check Permissions in Popup:</strong> When the Facebook popup opens, click <em>Edit settings</em> and make sure the checkbox next to your Instagram account and Facebook page is checked.
                    </li>
                  </ol>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                    If your Meta App is in Development mode (App ID <code>2808976552852144</code>), also add your Instagram username under <strong>Roles &rarr; Instagram Testers</strong> in the Meta Dashboard.
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
              <a
                className="cta"
                href="/api/auth/instagram/start"
                style={{
                  display: "block",
                  textAlign: "center",
                  background: "linear-gradient(135deg, #e8a54b 0%, #d97706 100%)",
                  color: "#000",
                  fontWeight: 700,
                  padding: "14px 24px",
                  borderRadius: "10px",
                  textDecoration: "none",
                  fontSize: "1rem",
                }}
              >
                Connect with Instagram (Official Meta OAuth) →
              </a>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "16px", fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--ink)", display: "block", marginBottom: "8px" }}>
                Prerequisites for Live Meta Graph API Connection:
              </strong>
              <ol style={{ paddingLeft: "18px", margin: "0 0 12px" }}>
                <li style={{ marginBottom: "6px" }}>
                  <strong>Professional Account</strong>: Switch your Instagram account to a <em>Creator</em> or <em>Business</em> profile in the Instagram mobile app (Settings &rarr; Account type and tools).
                </li>
                <li style={{ marginBottom: "6px" }}>
                  <strong>Meta App Tester Role</strong>: In your open Meta App Dashboard (App ID <code>2808976552852144</code>), navigate to <strong>Roles &rarr; Roles</strong>, add your Instagram handle under <em>Instagram Testers</em>, and accept the pending invite in your Instagram app (Settings &rarr; Apps and Websites &rarr; Tester Invites).
                </li>
                <li style={{ marginBottom: "6px" }}>
                  <strong>Permanent Redirect URI</strong>: In Meta App &rarr; Instagram Business &rarr; Unified Login Configuration (<code>1131117443101525</code>) and App Client OAuth settings, the redirect URI is permanently set to <code>https://hyperprofile-api.onrender.com/api/auth/instagram/callback</code>.
                </li>
              </ol>
              <p style={{ margin: 0 }}>
                Tokens are encrypted at rest with <strong>AES-256-GCM</strong>. Token payloads and bodies are never exposed to the client browser.
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<main className="shell"><section className="card">Loading…</section></main>}>
      <ConnectInner />
    </Suspense>
  );
}
