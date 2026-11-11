"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [appsOpen, setAppsOpen] = useState(true);

  const mainNav = [
    { label: "Getting Started", href: "/dashboard/autodm", icon: "✨" },
    { label: "Leads", href: "/dashboard/leads", icon: "👥" },
    { label: "Payments", href: "/dashboard/orders", icon: "💳" },
  ];

  const yourApps = [
    { label: "Store", href: "/dashboard/products", icon: "🏪" },
    { label: "AutoDM", href: "/dashboard/autodm", icon: "📸", isInstagram: true },
    { label: "SuperAds", href: "/dashboard/insights", icon: "📊" },
    { label: "Schedule", href: "/dashboard/builder", icon: "📅" },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      {/* SuperProfile Left Sidebar matching Screenshot 2 */}
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
          {/* SuperProfile Logo matching Screenshot 2 */}
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

        {/* Bottom Section: AI Apps & User Profile matching Screenshot 2 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Use with your AI apps badge */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.78rem",
              color: "#e2e8f0",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "6px",
                background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
                display: "grid",
                placeItems: "center",
                fontSize: "0.65rem",
                color: "#fff",
              }}
            >
              ✦
            </div>
            <span>Use with your AI apps</span>
          </div>

          {/* Connected User Profile Card */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.03)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Profile Avatar */}
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #f09433 0%, #bc1888 100%)",
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
                  J
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc", lineHeight: 1.2 }}>
                  jinbandhan
                </span>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  @jinbandhan
                </span>
              </div>
            </div>

            <span style={{ color: "#64748b", fontSize: "0.8rem" }}>^</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          background: "#f8fafc",
          minHeight: "100vh",
          overflowY: "auto",
          padding: "24px 32px 80px",
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>
    </div>
  );
}
