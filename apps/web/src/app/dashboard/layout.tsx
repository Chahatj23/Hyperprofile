"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [appsOpen, setAppsOpen] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [creatorUser, setCreatorUser] = useState<{ displayName: string; slug: string; username?: string; email?: string } | null>(null);
  const [detectedAccount, setDetectedAccount] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/v1/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.creator) {
            setIsAuthenticated(true);
            setCreatorUser({
              displayName: data.creator.displayName || "Creator",
              slug: data.creator.slug || "",
              username: data.instagram?.username || data.ig?.username || "",
              email: data.user?.email || "",
            });
            return;
          }
        }
        setIsAuthenticated(false);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    }

    async function checkAccount() {
      try {
        const res = await fetch("/v1/ig/accounts");
        if (res.ok) {
          const j = await res.json();
          if (j?.data?.[0]?.username) {
            setDetectedAccount(j.data[0].username);
          }
        }
      } catch {}
    }

    checkAuth();
    checkAccount();
  }, [pathname]);

  const mainNav = [
    { label: "Getting Started", href: "/dashboard/autodm", icon: "✨" },
    { label: "Leads", href: "/dashboard/leads", icon: "👥" },
    { label: "Payments", href: "/dashboard/orders", icon: "💳" },
    { label: "Settings", href: "/dashboard/settings", icon: "⚙️" },
  ];

  const yourApps = [
    { label: "Store", href: "/dashboard/products", icon: "🏪" },
    { label: "AutoDM", href: "/dashboard/autodm", icon: "📸", isInstagram: true },
    { label: "SuperAds", href: "/dashboard/insights", icon: "📊" },
    { label: "Schedule", href: "/dashboard/builder", icon: "📅" },
  ];

  // 1. Session verification loading state
  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f8fafc",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #0284c7 0%, #0066fe 100%)",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 16px",
              fontSize: "1.3rem",
              fontWeight: 800,
              boxShadow: "0 4px 14px rgba(0, 102, 254, 0.3)",
            }}
          >
            ✦
          </div>
          <div style={{ color: "#0f172a", fontSize: "0.95rem", fontWeight: 700 }}>
            Verifying secure session...
          </div>
          <div style={{ color: "#64748b", fontSize: "0.82rem", marginTop: "4px" }}>
            Checking authenticated creator credentials
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Barrier: Protects private account data in Incognito or logged out sessions
  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0a0e17",
          padding: "20px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: "min(460px, 100%)",
            background: "#ffffff",
            borderRadius: "24px",
            padding: "44px 32px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #0284c7 0%, #0066fe 100%)",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              fontSize: "1.6rem",
              fontWeight: 800,
              margin: "0 auto 18px",
              boxShadow: "0 4px 14px rgba(0, 102, 254, 0.35)",
            }}
          >
            🔒
          </div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "#0f172a",
              margin: "0 0 8px",
              letterSpacing: "-0.02em",
            }}
          >
            Protected Creator Workspace
          </h1>
          <p
            style={{
              fontSize: "0.9rem",
              color: "#64748b",
              margin: "0 0 28px",
              lineHeight: 1.5,
            }}
          >
            This dashboard contains private creator tools, audience leads, and AutoDM rules. Please sign in with your Instagram account to access your workspace.
          </p>

          {detectedAccount ? (
            <div
              style={{
                marginBottom: "20px",
                padding: "16px",
                borderRadius: "14px",
                background: "rgba(2, 132, 199, 0.06)",
                border: "1px solid rgba(2, 132, 199, 0.18)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "6px" }}>
                Connected Instagram Account
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
                @{detectedAccount}
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Link
              href="/login"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "13px 20px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #0284c7 0%, #0066fe 100%)",
                color: "#ffffff",
                fontSize: "0.95rem",
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(0, 102, 254, 0.35)",
              }}
            >
              <span>🔑</span>
              <span>Sign In with Email &amp; Password →</span>
            </Link>

            <Link
              href="/login?mode=register"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px 20px",
                borderRadius: "12px",
                background: "#f8fafc",
                color: "#0f172a",
                border: "1px solid #e2e8f0",
                fontSize: "0.9rem",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <span>✦</span>
              <span>Create Free Creator Account</span>
            </Link>

            {detectedAccount && (
              <button
                type="button"
                disabled={loggingIn}
                onClick={async () => {
                  setLoggingIn(true);
                  try {
                    const res = await fetch("/v1/auth/instagram/session", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ username: detectedAccount }),
                    });
                    if (res.ok) {
                      window.location.reload();
                      return;
                    }
                  } catch {
                    // ignore
                  } finally {
                    setLoggingIn(false);
                  }
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  padding: "11px 20px",
                  borderRadius: "12px",
                  background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                  color: "#ffffff",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  border: "none",
                  cursor: loggingIn ? "wait" : "pointer",
                  boxShadow: "0 3px 10px rgba(220, 39, 67, 0.25)",
                }}
              >
                <span>📸</span>
                <span>{loggingIn ? "Signing In…" : `Quick Access as @${detectedAccount} →`}</span>
              </button>
            )}

            {detectedAccount && (
              <Link
                href={`/${detectedAccount}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 20px",
                  borderRadius: "12px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                View Public Store (hyperprofile.bio/{detectedAccount}) ↗
              </Link>
            )}

            <Link
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 20px",
                borderRadius: "12px",
                background: "transparent",
                color: "#64748b",
                fontSize: "0.85rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              ← Back to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated Session: Render Full Creator Workspace
  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      {/* SuperProfile Left Sidebar */}
      <aside
        style={{
          width: "248px",
          minWidth: "248px",
          background: "#0c1017",
          color: "#94a3b8",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          padding: "20px 14px",
          position: "sticky",
          top: 0,
          height: "100vh",
          boxSizing: "border-box",
          zIndex: 50,
        }}
      >
        {/* Top: Logo & Nav items */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* SuperProfile Logo */}
          <Link
            href="/dashboard/autodm"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
              paddingLeft: "8px",
              paddingTop: "4px",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #0284c7 0%, #0066fe 100%)",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
                fontSize: "0.95rem",
                fontWeight: 800,
                boxShadow: "0 2px 8px rgba(0, 102, 254, 0.4)",
              }}
            >
              ✦
            </div>
            <span
              style={{
                color: "#ffffff",
                fontSize: "1.18rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              SuperProfile
            </span>
          </Link>

          {/* Main Top Nav Links */}
          <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {mainNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "9px 12px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    color: isActive ? "#ffffff" : "#94a3b8",
                    background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                    fontSize: "0.88rem",
                    fontWeight: isActive ? 600 : 500,
                    transition: "all 0.12s ease",
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Section: YOUR APPS */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              style={{
                fontSize: "0.72rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#64748b",
                fontWeight: 700,
                paddingLeft: "12px",
                marginBottom: "4px",
              }}
            >
              YOUR APPS
            </div>

            {yourApps.map((item) => {
              const isActive = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "9px 12px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    color: isActive ? "#ffffff" : "#94a3b8",
                    background: isActive ? "#1e293b" : "transparent",
                    fontSize: "0.88rem",
                    fontWeight: isActive ? 600 : 500,
                    border: isActive ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
                    transition: "all 0.12s ease",
                  }}
                >
                  {item.isInstagram ? (
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "5px",
                        background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "0.7rem",
                        color: "#fff",
                      }}
                    >
                      📷
                    </div>
                  ) : (
                    <span style={{ fontSize: "1rem" }}>{item.icon}</span>
                  )}
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Explore All Apps Button */}
            <Link
              href="/dashboard/insights"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px 12px",
                borderRadius: "10px",
                textDecoration: "none",
                color: "#64748b",
                fontSize: "0.82rem",
                marginTop: "6px",
                border: "1px dashed rgba(255,255,255,0.12)",
              }}
            >
              <span>⚡</span>
              <span>Explore All Apps</span>
            </Link>
          </div>
        </div>

        {/* Bottom Section: User Profile & Connected Account */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* Connected Instagram Account Status */}
          {creatorUser?.username ? (
            <Link
              href="/dashboard/settings"
              style={{
                padding: "8px 12px",
                borderRadius: "10px",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                textDecoration: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981" }} />
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#34d399" }}>
                  @{creatorUser.username}
                </span>
              </div>
              <span style={{ fontSize: "0.7rem", color: "#6ee7b7", background: "rgba(16,185,129,0.2)", padding: "2px 6px", borderRadius: "4px" }}>
                Active
              </span>
            </Link>
          ) : (
            <Link
              href="/connect"
              style={{
                padding: "8px 12px",
                borderRadius: "10px",
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                textDecoration: "none",
                color: "#fbbf24",
                fontSize: "0.78rem",
                fontWeight: 600,
              }}
            >
              <span>📸 Connect Instagram</span>
              <span>➕</span>
            </Link>
          )}

          {/* Connected User Profile Card */}
          <Link
            href="/dashboard/settings"
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.03)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              border: "1px solid rgba(255,255,255,0.06)",
              textDecoration: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Profile Avatar */}
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #0284c7 0%, #0066fe 100%)",
                  padding: "1.5px",
                  display: "grid",
                  placeItems: "center",
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
                    fontSize: "0.85rem",
                    fontWeight: 700,
                  }}
                >
                  {creatorUser?.displayName?.charAt(0).toUpperCase() || "C"}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", maxWidth: "140px", overflow: "hidden" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc", lineHeight: 1.2, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                  {creatorUser?.displayName || "Creator"}
                </span>
                <span style={{ fontSize: "0.7rem", color: "#64748b", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                  {creatorUser?.email || `@${creatorUser?.slug || "creator"}`}
                </span>
              </div>
            </div>

            <span style={{ color: "#64748b", fontSize: "0.8rem" }}>⚙</span>
          </Link>

          {/* Log Out Button */}
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch("/v1/auth/logout", { method: "POST" });
              } catch {}
              window.location.href = "/login";
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "10px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#f87171",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <span>🚪</span>
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main
        className="dashboard-main"
        style={{
          flex: 1,
          background: "#f8fafc",
          color: "#0f172a",
          minHeight: "100vh",
          overflowY: "auto",
          padding: "28px 36px 80px",
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>
    </div>
  );
}
