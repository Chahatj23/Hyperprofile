"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";

interface IgAccountItem {
  id: string;
  igUserId: string;
  username: string;
  tokenExpiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

function ConnectInner() {
  const params = useSearchParams();
  const ok = params.get("ok");
  const username = params.get("username");
  const error = params.get("error");
  const sessionToken = params.get("session_token");

  const [connectedAccount, setConnectedAccount] = useState<string | null>(username || null);
  const [accountsList, setAccountsList] = useState<IgAccountItem[]>([]);
  const [currentUser, setCurrentUser] = useState<{ email?: string; slug?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  if (typeof window !== "undefined" && sessionToken) {
    try {
      const isHttps = window.location.protocol === "https:";
      document.cookie = `hp_session=${sessionToken}; path=/; max-age=2592000; SameSite=Lax${isHttps ? "; Secure" : ""}`;
      localStorage.setItem("hp_token", sessionToken);
    } catch {}
  }

  async function launchWorkspace(dest: string) {
    window.location.href = dest;
  }

  async function handleSelectAccount(acct: IgAccountItem) {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("hp_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch("/v1/ig/accounts/select", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ id: acct.id, username: acct.username, igUserId: acct.igUserId }),
      });
      if (res.ok) {
        setConnectedAccount(acct.username);
        setActionMsg(`Switched active account to @${acct.username} ✓`);
        setTimeout(() => setActionMsg(null), 3500);
      }
    } catch (e) {
      setActionMsg("Failed to switch account: " + String(e));
      setTimeout(() => setActionMsg(null), 3500);
    }
  }

  async function handleDisconnectAccount(acctUsername: string) {
    if (!confirm(`Are you sure you want to disconnect @${acctUsername}?`)) return;
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("hp_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch("/v1/ig/accounts/unlink", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ username: acctUsername }),
      });
      if (res.ok) {
        const remaining = accountsList.filter((a) => a.username !== acctUsername);
        setAccountsList(remaining);
        if (connectedAccount === acctUsername) {
          setConnectedAccount(remaining.length > 0 ? remaining[0].username : null);
        }
        setActionMsg(`@${acctUsername} disconnected ✓`);
        setTimeout(() => setActionMsg(null), 3500);
      }
    } catch (e) {
      setActionMsg("Failed to disconnect: " + String(e));
      setTimeout(() => setActionMsg(null), 3500);
    }
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
          } else {
            window.location.href = "/login?next=/connect";
            return;
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
          if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            setAccountsList(json.data);
            if (!connectedAccount) {
              setConnectedAccount(json.data[0].username);
            }
          }
        }
      } catch {
        // Fallback to query param
      } finally {
        setLoading(false);
      }
    }
    checkAuthAndAccounts();
  }, []);

  return (
    <main className="shell">
      <section className="card" style={{ maxWidth: "600px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h1 className="brand" style={{ margin: 0 }}>Instagram Connection</h1>
          <Link
            href="/dashboard/autodm"
            style={{ fontSize: "0.82rem", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
          >
            ← Back to Dashboard
          </Link>
        </div>

        <p className="lede">
          Connect your Instagram Professional accounts (Creator or Business) to enable official Meta AutoDM keyword replies, audience leads, and live profile analytics.
        </p>

        {actionMsg && (
          <div style={{ padding: "10px 14px", background: "rgba(52, 211, 153, 0.15)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: "8px", color: "#34d399", fontSize: "0.85rem", marginBottom: "16px", fontWeight: 600 }}>
            {actionMsg}
          </div>
        )}

        {ok && (
          <div style={{ padding: "12px 16px", background: "rgba(52, 211, 153, 0.12)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: "10px", color: "#34d399", fontSize: "0.88rem", marginBottom: "20px", fontWeight: 600 }}>
            ✓ Successfully connected @{username || connectedAccount || "your account"}! You can now configure AutoDM rules below.
          </div>
        )}

        {/* CONNECTED ACCOUNTS LIST */}
        {accountsList.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Connected Instagram Accounts ({accountsList.length})
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {accountsList.map((acct) => {
                const isActive = acct.username === connectedAccount;
                return (
                  <div
                    key={acct.id || acct.igUserId}
                    style={{
                      padding: "16px 18px",
                      background: isActive ? "rgba(52, 211, 153, 0.08)" : "rgba(255, 255, 255, 0.03)",
                      border: isActive ? "1px solid rgba(52, 211, 153, 0.35)" : "1px solid var(--line)",
                      borderRadius: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                          style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "50%",
                            background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                            display: "grid",
                            placeItems: "center",
                            fontWeight: 800,
                            fontSize: "0.95rem",
                            color: "#fff",
                          }}
                        >
                          IG
                        </div>
                        <div>
                          <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)" }}>
                            @{acct.username}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                            ID: <code>{acct.igUserId}</code>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {isActive ? (
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "16px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              background: "rgba(52, 211, 153, 0.2)",
                              color: "#34d399",
                              border: "1px solid rgba(52, 211, 153, 0.4)",
                            }}
                          >
                            ● ACTIVE
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectAccount(acct)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "8px",
                              background: "rgba(255, 255, 255, 0.08)",
                              border: "1px solid var(--line)",
                              color: "var(--ink)",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Switch to this
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDisconnectAccount(acct.username)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.25)",
                            color: "#f87171",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>

                    {isActive && (
                      <div style={{ borderTop: "1px solid var(--line)", paddingTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <button
                          type="button"
                          onClick={() => launchWorkspace("/dashboard/autodm")}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "8px",
                            background: "var(--accent)",
                            color: "#0f1a14",
                            fontWeight: 700,
                            fontSize: "0.82rem",
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
                            padding: "8px 12px",
                            borderRadius: "8px",
                            background: "rgba(255,255,255,0.08)",
                            color: "var(--ink)",
                            fontWeight: 600,
                            fontSize: "0.82rem",
                            border: "1px solid var(--line)",
                            cursor: "pointer",
                            textAlign: "center",
                          }}
                        >
                          📸 Live Insights &rarr;
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fallback display if connectedAccount set via URL but not yet in list */}
        {connectedAccount && accountsList.length === 0 && (
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                padding: "18px",
                background: "rgba(52, 211, 153, 0.08)",
                border: "1px solid rgba(52, 211, 153, 0.3)",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: "0.95rem",
                    color: "#fff",
                  }}
                >
                  IG
                </div>
                <div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)" }}>
                    @{connectedAccount}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#34d399", fontWeight: 600 }}>
                    ● Active Instagram Profile
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDisconnectAccount(connectedAccount)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  color: "#f87171",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* CONNECT SECTION */}
        <div style={{ marginTop: (connectedAccount || accountsList.length > 0) ? "20px" : "0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
              {(connectedAccount || accountsList.length > 0) ? "+ Connect Another Instagram Account" : "Connect Instagram Account"}
            </h2>
            {(connectedAccount || accountsList.length > 0) && (
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Multi-account support active</span>
            )}
          </div>

          {!connectedAccount && accountsList.length === 0 && !loading && (
            <div style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", color: "#f87171", fontSize: "0.85rem", marginBottom: "20px" }}>
              ⚠ No Instagram account currently connected. Choose an option below to connect via official Meta OAuth:
            </div>
          )}

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
                    <strong>Switch to Creator Profile:</strong> In your Instagram mobile app &rarr; <em>Settings</em> &rarr; <em>Account type and tools</em> &rarr; tap <strong>Switch to Professional Account</strong> (select <em>Creator</em>). Personal accounts are blocked by Meta&apos;s Graph API.
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    <strong>Link a Facebook Page:</strong> In your Instagram app &rarr; <em>Edit Profile</em> &rarr; <em>Public Business Information / Page</em> &rarr; link or create a free Facebook Page.
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    <strong>Add Tester Role:</strong> In Meta Dashboard (App ID <code>2808976552852144</code>) &rarr; <em>Roles &rarr; Instagram Testers</em> &rarr; add your Instagram username and accept the invite in your Instagram app.
                  </li>
                </ol>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
            <a
              className="cta"
              href="/v1/auth/instagram/start"
              style={{
                display: "block",
                textAlign: "center",
                background: "linear-gradient(135deg, #1877f2 0%, #0066fe 50%, #e1306c 100%)",
                color: "#fff",
                fontWeight: 700,
                padding: "14px 24px",
                borderRadius: "10px",
                textDecoration: "none",
                fontSize: "1rem",
                boxShadow: "0 4px 14px rgba(0, 102, 254, 0.35)",
              }}
            >
              📸 Connect Instagram (Meta Unified Business Login) &rarr;
            </a>
          </div>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "16px", fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--ink)", display: "block", marginBottom: "8px" }}>
              Prerequisites for Connecting a New Instagram Account:
            </strong>
            <ol style={{ paddingLeft: "18px", margin: "0 0 12px" }}>
              <li style={{ marginBottom: "6px" }}>
                <strong>Professional Account</strong>: In the Instagram app &rarr; Settings &rarr; Account type and tools &rarr; <em>Switch to Professional Account</em> (choose Creator).
              </li>
              <li style={{ marginBottom: "6px" }}>
                <strong>Meta App Tester Role</strong>: If your Meta App is in Development mode (App ID <code>2808976552852144</code>), add your Instagram username under <strong>Roles &rarr; Instagram Testers</strong> in the Meta Dashboard, and accept the pending invite in your Instagram app (Settings &rarr; Apps and Websites &rarr; Tester Invites).
              </li>
              <li style={{ marginBottom: "6px" }}>
                <strong>Authorized Redirect URI</strong>: Permanent redirect URI is <code>https://hyperprofile-api.onrender.com/v1/auth/instagram/callback</code>.
              </li>
            </ol>
            <p style={{ margin: 0 }}>
              Tokens are encrypted at rest with <strong>AES-256-GCM</strong>. Token payloads and bodies are never exposed to the client browser.
            </p>
          </div>
        </div>
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
