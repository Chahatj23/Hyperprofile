"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";

function ConnectInner() {
  const params = useSearchParams();
  const ok = params.get("ok");
  const username = params.get("username");
  const error = params.get("error");

  const [connectedAccount, setConnectedAccount] = useState<string | null>(username || null);
  const [loading, setLoading] = useState(true);

  async function launchWorkspace(dest: string) {
    if (connectedAccount) {
      try {
        await fetch("/v1/auth/instagram/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username: connectedAccount }),
        });
      } catch {}
    }
    window.location.href = dest;
  }

  useEffect(() => {
    async function checkCurrentAccounts() {
      try {
        const res = await fetch("/v1/ig/accounts");
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
    checkCurrentAccounts();
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
              <div className="status err" style={{ marginBottom: "16px" }}>
                Could not connect: {error}
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
                  <strong>Active Redirect URI</strong>: In Meta App &rarr; Instagram Business &rarr; Unified Login Configuration (<code>1131117443101525</code>), ensure the active redirect URI is set in your Meta App.
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
