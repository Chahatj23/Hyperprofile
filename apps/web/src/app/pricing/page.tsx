import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing & Plans | Hyperprofile Creator Commerce",
  description: "Transparent, creator-friendly pricing for Indian creators. 0% platform transaction fee on Pro.",
};

export default function PricingPage() {
  const plans = [
    {
      id: "starter",
      name: "Starter",
      badge: "Free Forever",
      price: "₹0",
      period: "forever",
      description: "Ideal for new creators starting to build their audience and test Instagram DM automation.",
      fee: "4% platform transaction fee",
      features: [
        "1 Active Instagram AutoDM Keyword Rule",
        "Unlimited Digital File Downloads",
        "UPI Express Checkout (GPay, PhonePe, Paytm)",
        "Double-entry cryptographic ledger",
        "Standard Creator Bio Link",
        "Basic Audience CRM",
      ],
      cta: "Start Free",
      href: "/register",
      highlighted: false,
    },
    {
      id: "creator",
      name: "Creator Pro",
      badge: "MOST POPULAR",
      price: "₹399",
      period: "/month",
      description: "Everything you need to automate your reels and maximize revenue with zero platform fees.",
      fee: "0% platform fee on all sales",
      features: [
        "0% Platform Transaction Fee (Keep 100%)",
        "Unlimited Instagram AutoDM Rules",
        "Instant Private DM Delivery (< 3s)",
        "Direct UPI Deep Linking",
        "Remove Hyperprofile Branding",
        "Custom Themes, Colors & Fonts",
        "Audience CRM with CSV/JSON Export",
        "Priority Email & Chat Support",
      ],
      cta: "Get Creator Pro",
      href: "/register?plan=creator",
      highlighted: true,
    },
    {
      id: "studio",
      name: "Studio Agency",
      badge: "Scale & Teams",
      price: "₹1,499",
      period: "/month",
      description: "For agencies and top creators managing multi-account Instagram brands and high volume.",
      fee: "0% platform fee on all sales",
      features: [
        "Everything in Creator Pro",
        "Connect up to 5 Instagram Accounts",
        "Custom Domain Support (yourbrand.com)",
        "Priority WhatsApp & Phone Support",
        "Multi-member Agency Role Access",
        "Webhook Streaming & API Access",
        "Dedicated Account Strategist",
      ],
      cta: "Get Studio Agency",
      href: "/register?plan=studio",
      highlighted: false,
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e17", color: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(10, 14, 23, 0.8)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #0284c7 0%, #0066fe 100%)",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
                fontSize: "1.1rem",
                fontWeight: 800,
                boxShadow: "0 2px 10px rgba(0, 102, 254, 0.4)",
              }}
            >
              ✦
            </div>
            <span style={{ color: "#ffffff", fontSize: "1.3rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
              Hyperprofile
            </span>
          </Link>

          <nav style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <Link href="/features" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
              Features
            </Link>
            <Link href="/pricing" style={{ color: "#38bdf8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 700 }}>
              Pricing
            </Link>
            <Link href="/about" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
              About
            </Link>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link
              href="/login"
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                color: "#cbd5e1",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                fontSize: "0.88rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign In
            </Link>
            <Link
              href="/register"
              style={{
                padding: "9px 20px",
                borderRadius: "10px",
                background: "#0066fe",
                color: "#ffffff",
                fontSize: "0.88rem",
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 2px 10px rgba(0, 102, 254, 0.35)",
              }}
            >
              Get Started Free →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ padding: "80px 24px 30px", maxWidth: "960px", margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 16px",
            borderRadius: "30px",
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            color: "#34d399",
            fontSize: "0.85rem",
            fontWeight: 700,
            marginBottom: "20px",
          }}
        >
          <span>💎 Transparent & Predictable Pricing</span>
        </div>
        <h1
          style={{
            fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            margin: "0 0 20px",
            lineHeight: 1.15,
          }}
        >
          Keep 100% of Your Earnings.
        </h1>
        <p style={{ fontSize: "1.15rem", color: "#94a3b8", lineHeight: 1.6, maxWidth: "680px", margin: "0 auto" }}>
          No hidden charges. Upgrade to Creator Pro and enjoy 0% platform transaction fees on every single sale.
        </p>
      </section>

      {/* Pricing Cards */}
      <section style={{ maxWidth: "1200px", margin: "40px auto 100px", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "28px", alignItems: "stretch" }}>
          {plans.map((p) => (
            <div
              key={p.id}
              style={{
                borderRadius: "24px",
                background: p.highlighted
                  ? "linear-gradient(180deg, rgba(0, 102, 254, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)"
                  : "rgba(255, 255, 255, 0.03)",
                border: p.highlighted
                  ? "2px solid #0066fe"
                  : "1px solid rgba(255, 255, 255, 0.08)",
                padding: "36px 30px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                boxShadow: p.highlighted ? "0 20px 40px -15px rgba(0, 102, 254, 0.4)" : "none",
              }}
            >
              {p.highlighted && (
                <div
                  style={{
                    position: "absolute",
                    top: "-14px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "linear-gradient(135deg, #0284c7 0%, #0066fe 100%)",
                    color: "#ffffff",
                    padding: "4px 14px",
                    borderRadius: "20px",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    boxShadow: "0 4px 12px rgba(0, 102, 254, 0.4)",
                  }}
                >
                  {p.badge}
                </div>
              )}

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                    {p.name}
                  </h3>
                  {!p.highlighted && (
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 700, padding: "3px 8px", borderRadius: "12px", background: "rgba(255, 255, 255, 0.06)" }}>
                      {p.badge}
                    </span>
                  )}
                </div>

                <p style={{ fontSize: "0.88rem", color: "#94a3b8", lineHeight: 1.5, margin: "0 0 24px" }}>
                  {p.description}
                </p>

                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "2.8rem", fontWeight: 900, color: "#ffffff", letterSpacing: "-0.03em" }}>
                    {p.price}
                  </span>
                  <span style={{ fontSize: "0.95rem", color: "#94a3b8" }}>{p.period}</span>
                </div>

                <div
                  style={{
                    display: "inline-block",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: p.highlighted ? "#38bdf8" : "#a7f3d0",
                    background: p.highlighted ? "rgba(56, 189, 248, 0.12)" : "rgba(16, 185, 129, 0.12)",
                    padding: "4px 10px",
                    borderRadius: "8px",
                    marginBottom: "28px",
                  }}
                >
                  {p.fee}
                </div>

                <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  {p.features.map((feat, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem", color: "#cbd5e1" }}>
                      <span style={{ color: p.highlighted ? "#38bdf8" : "#34d399", fontWeight: 800 }}>✓</span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: "36px" }}>
                <Link
                  href={p.href}
                  style={{
                    display: "block",
                    textAlign: "center",
                    width: "100%",
                    padding: "13px 20px",
                    borderRadius: "12px",
                    background: p.highlighted ? "#0066fe" : "rgba(255, 255, 255, 0.08)",
                    color: "#ffffff",
                    fontSize: "0.95rem",
                    fontWeight: 800,
                    textDecoration: "none",
                    border: p.highlighted ? "none" : "1px solid rgba(255, 255, 255, 0.15)",
                    boxShadow: p.highlighted ? "0 4px 16px rgba(0, 102, 254, 0.4)" : "none",
                    boxSizing: "border-box",
                  }}
                >
                  {p.cta} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(10, 14, 23, 0.95)", padding: "40px 24px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "#0066fe", display: "grid", placeItems: "center", color: "#ffffff", fontSize: "0.8rem", fontWeight: 800 }}>
              ✦
            </div>
            <span style={{ fontWeight: 700, color: "#ffffff" }}>Hyperprofile</span>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>· Creator Commerce for India</span>
          </div>

          <div style={{ display: "flex", gap: "24px", fontSize: "0.85rem", color: "#94a3b8" }}>
            <Link href="/features" style={{ color: "inherit", textDecoration: "none" }}>Features</Link>
            <Link href="/pricing" style={{ color: "inherit", textDecoration: "none" }}>Pricing</Link>
            <Link href="/about" style={{ color: "inherit", textDecoration: "none" }}>About</Link>
            <Link href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>Privacy</Link>
            <Link href="/terms" style={{ color: "inherit", textDecoration: "none" }}>Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
