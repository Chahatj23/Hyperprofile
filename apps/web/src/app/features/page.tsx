import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features | Hyperprofile Creator Commerce & AutoDM",
  description: "Explore all features of Hyperprofile: Meta-verified Instagram AutoDM, 10-second UPI Express Checkout, Digital Storefront, Audience CRM, and Analytics.",
};

export default function FeaturesPage() {
  const featuresList = [
    {
      category: "Instagram Automation",
      title: "Meta-Verified Instagram AutoDM Engine",
      badge: "Real-Time < 3s",
      icon: "📸",
      color: "from-pink-500 to-rose-500",
      description: "Direct official Graph API integration that detects comments on your posts, reels, and carousels, automatically delivering customized private DMs with tracked links.",
      points: [
        "Keyword triggers (e.g. 'LINK', 'WORKBOOK', 'PRICE')",
        "Media-specific or account-wide automation rules",
        "Anti-spam human delays and randomized copy variations",
        "Official Meta webhook delivery in under 3 seconds",
      ],
    },
    {
      category: "Monetization & Checkout",
      title: "10-Second UPI Express Checkout",
      badge: "India-First",
      icon: "⚡",
      color: "from-amber-500 to-orange-500",
      description: "Mobile-optimized checkout designed specifically for Indian buyers. Instant deep-links to GPay, PhonePe, Paytm, or instant Dynamic QR without credit card friction.",
      points: [
        "Zero drop-off mobile deep links directly to UPI apps",
        "Dynamic UPI QR code generation on desktop",
        "Instant digital delivery links via email & WhatsApp",
        "Double-entry cryptographic ledger with full audit trail",
      ],
    },
    {
      category: "Digital Products",
      title: "Storefront & Digital Downloads",
      badge: "0% Fee on Pro",
      icon: "🛍️",
      color: "from-blue-500 to-indigo-500",
      description: "Sell PDF guides, video courses, templates, 1-on-1 consultations, and paid community access directly from your link-in-bio page.",
      points: [
        "Instant tamper-proof signed download URLs",
        "Custom discount coupons with usage limits & expirations",
        "Automated GST invoicing with HSN/SAC compliance",
        "Pay-what-you-want dynamic pricing option",
      ],
    },
    {
      category: "Audience & Growth",
      title: "Unified Audience CRM & Leads",
      badge: "Ownership",
      icon: "👥",
      color: "from-emerald-500 to-teal-500",
      description: "Never lose a customer or fan. Every commenter, buyer, and lead magnet subscriber is aggregated into your sovereign creator database.",
      points: [
        "Automatic enrichment with Instagram handles & customer LTV",
        "One-click CSV/JSON customer export",
        "Transactional email notifications via Brevo / Resend",
        "Full segmentation by purchase history and engagement",
      ],
    },
    {
      category: "Security & Privacy",
      title: "Creator Privacy & Sovereign OAuth",
      badge: "Bank-Grade",
      icon: "🛡️",
      color: "from-violet-500 to-purple-500",
      description: "Strict isolation across creators. No pre-seeded accounts, no shared tokens, and encrypted credentials stored using AES-256-GCM.",
      points: [
        "Dynamic Meta OAuth with encrypted access tokens",
        "Zero-trust session cookies with HTTPOnly + Secure + Lax flags",
        "Multi-tenant isolation backed by Neon PostgreSQL",
        "Instant one-click account unlinking and privacy purging",
      ],
    },
    {
      category: "Analytics & Insights",
      title: "Real-Time Conversion Analytics",
      badge: "Live Telemetry",
      icon: "📈",
      color: "from-cyan-500 to-blue-500",
      description: "Know exactly which reels and keyword rules are driving high-value sales. Track CTR, conversion funnels, and revenue metrics in real time.",
      points: [
        "Automated click-through rate (CTR) tracking on AutoDM links",
        "Real-time revenue charts with gross & net profit breakdown",
        "Top-performing content and hashtag telemetry",
        "Conversion breakdown by mobile UPI app",
      ],
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
            <Link href="/features" style={{ color: "#38bdf8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 700 }}>
              Features
            </Link>
            <Link href="/pricing" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
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
      <section style={{ padding: "80px 24px 40px", maxWidth: "960px", margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 16px",
            borderRadius: "30px",
            background: "rgba(56, 189, 248, 0.12)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            color: "#38bdf8",
            fontSize: "0.85rem",
            fontWeight: 700,
            marginBottom: "20px",
          }}
        >
          <span>✨ Complete Platform Capability</span>
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
          Every Tool You Need to Scale Your Creator Business
        </h1>
        <p style={{ fontSize: "1.15rem", color: "#94a3b8", lineHeight: 1.6, maxWidth: "720px", margin: "0 auto" }}>
          From comment-to-DM automation to 10-second UPI checkouts and audience CRM, Hyperprofile replaces 5 fragmented subscriptions with one high-performance stack.
        </p>
      </section>

      {/* Feature Grid */}
      <section style={{ maxWidth: "1200px", margin: "40px auto 100px", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "28px" }}>
          {featuresList.map((f, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "24px",
                padding: "36px 30px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <div
                    style={{
                      width: "50px",
                      height: "50px",
                      borderRadius: "14px",
                      background: "rgba(255, 255, 255, 0.08)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "1.5rem",
                    }}
                  >
                    {f.icon}
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "4px 10px",
                      borderRadius: "20px",
                      background: "rgba(0, 102, 254, 0.15)",
                      color: "#60a5fa",
                      border: "1px solid rgba(0, 102, 254, 0.3)",
                    }}
                  >
                    {f.badge}
                  </span>
                </div>

                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                  {f.category}
                </div>
                <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#ffffff", margin: "0 0 12px" }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, margin: "0 0 20px" }}>
                  {f.description}
                </p>

                <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {f.points.map((pt, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "0.85rem", color: "#cbd5e1" }}>
                      <span style={{ color: "#38bdf8", fontWeight: 700 }}>✓</span>
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Banner */}
        <div
          style={{
            marginTop: "60px",
            padding: "48px 32px",
            borderRadius: "28px",
            background: "linear-gradient(135deg, rgba(0, 102, 254, 0.15) 0%, rgba(56, 189, 248, 0.1) 100%)",
            border: "1px solid rgba(0, 102, 254, 0.3)",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "#ffffff", margin: "0 0 12px" }}>
            Ready to Connect Your Account & Monetize?
          </h2>
          <p style={{ color: "#94a3b8", fontSize: "1.05rem", margin: "0 auto 28px", maxWidth: "600px" }}>
            Set up your Instagram AutoDM keyword triggers and publish your link-in-bio in less than 2 minutes.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
            <Link
              href="/register"
              style={{
                padding: "14px 32px",
                borderRadius: "12px",
                background: "#0066fe",
                color: "#ffffff",
                fontSize: "1rem",
                fontWeight: 800,
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(0, 102, 254, 0.4)",
              }}
            >
              Get Started Free →
            </Link>
            <Link
              href="/pricing"
              style={{
                padding: "14px 28px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.08)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                fontSize: "1rem",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              View Pricing & Plans
            </Link>
          </div>
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
