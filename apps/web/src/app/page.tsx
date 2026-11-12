import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0e17", color: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      {/* Top Navbar */}
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
          {/* Brand Logo */}
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
            }}
          >
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
            <span
              style={{
                color: "#ffffff",
                fontSize: "1.3rem",
                fontWeight: 800,
                letterSpacing: "-0.03em",
              }}
            >
              Hyperprofile
            </span>
          </Link>

          {/* Navigation Links */}
          <nav style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <Link
              href="/dashboard/autodm"
              style={{
                color: "#94a3b8",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: 600,
                transition: "color 0.15s ease",
              }}
            >
              AutoDM
            </Link>
            <Link
              href="/dashboard/products"
              style={{
                color: "#94a3b8",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: 600,
                transition: "color 0.15s ease",
              }}
            >
              Digital Store
            </Link>
            <Link
              href="/dashboard/leads"
              style={{
                color: "#94a3b8",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: 600,
                transition: "color 0.15s ease",
              }}
            >
              Leads CRM
            </Link>
            <Link
              href="/dashboard/settings"
              style={{
                color: "#94a3b8",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: 600,
                transition: "color 0.15s ease",
              }}
            >
              Pricing
            </Link>
          </nav>

          {/* Right Action CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link
              href="/jinbandhan"
              target="_blank"
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                color: "#cbd5e1",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                fontSize: "0.88rem",
                fontWeight: 600,
                textDecoration: "none",
                transition: "background 0.15s ease",
              }}
            >
              Sample Store ↗
            </Link>
            <Link
              href="/dashboard/autodm"
              style={{
                padding: "9px 20px",
                borderRadius: "10px",
                background: "#0066fe",
                color: "#ffffff",
                fontSize: "0.88rem",
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 2px 10px rgba(0, 102, 254, 0.35)",
                transition: "background 0.15s ease",
              }}
            >
              Open Dashboard ✨
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: "80px 24px 60px", maxWidth: "1120px", margin: "0 auto", textAlign: "center" }}>
        {/* Eyebrow Tag */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 16px",
            borderRadius: "30px",
            background: "rgba(0, 102, 254, 0.12)",
            border: "1px solid rgba(0, 102, 254, 0.3)",
            color: "#60a5fa",
            fontSize: "0.85rem",
            fontWeight: 700,
            marginBottom: "24px",
          }}
        >
          <span>📸</span>
          <span>Meta-Verified Instagram AutoDM & UPI Commerce for India</span>
        </div>

        {/* Hero Title */}
        <h1
          style={{
            fontSize: "clamp(2.4rem, 6vw, 4.2rem)",
            fontWeight: 900,
            lineHeight: 1.12,
            letterSpacing: "-0.03em",
            maxWidth: "920px",
            margin: "0 auto 24px",
            color: "#ffffff",
          }}
        >
          Turn Your Instagram Comments Into{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #38bdf8 0%, #0066fe 50%, #c084fc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Instant UPI Sales.
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p
          style={{
            fontSize: "clamp(1.05rem, 2vw, 1.25rem)",
            color: "#94a3b8",
            maxWidth: "700px",
            margin: "0 auto 36px",
            lineHeight: 1.6,
          }}
        >
          Automate instant private DMs whenever followers comment on your reels, sell digital downloads with 10-second UPI Express checkout, and keep 100% of your earnings with 0% platform fees.
        </p>

        {/* Action CTAs */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "48px" }}>
          <Link
            href="/dashboard/autodm"
            style={{
              padding: "14px 32px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #0066fe 0%, #0284c7 100%)",
              color: "#ffffff",
              fontSize: "1rem",
              fontWeight: 800,
              textDecoration: "none",
              boxShadow: "0 4px 20px rgba(0, 102, 254, 0.4)",
            }}
          >
            Launch AutoDM Dashboard →
          </Link>
          <Link
            href="/jinbandhan"
            target="_blank"
            style={{
              padding: "14px 28px",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.05)",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              fontSize: "1rem",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Preview Creator Store ↗
          </Link>
        </div>

        {/* Live Metrics Trust Bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
            padding: "24px",
            borderRadius: "20px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            maxWidth: "880px",
            margin: "0 auto",
          }}
        >
          <div>
            <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#38bdf8" }}>0%</div>
            <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: "2px" }}>Platform Fee on Pro</div>
          </div>
          <div>
            <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#34d399" }}>&lt; 3s</div>
            <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: "2px" }}>Instant AutoDM Delivery</div>
          </div>
          <div>
            <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#facc15" }}>UPI-First</div>
            <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: "2px" }}>GPay, PhonePe, Paytm QR</div>
          </div>
          <div>
            <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#c084fc" }}>Meta Live</div>
            <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: "2px" }}>Official Graph API Published</div>
          </div>
        </div>
      </section>

      {/* Feature Bento Grid */}
      <section style={{ maxWidth: "1120px", margin: "40px auto 80px", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <h2 style={{ fontSize: "2.2rem", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em", margin: "0 0 12px" }}>
            Engineered For High-Converting Indian Creators
          </h2>
          <p style={{ fontSize: "1rem", color: "#94a3b8", maxWidth: "600px", margin: "0 auto" }}>
            Everything you need to automate your audience engagement and monetize your followers in one unified platform.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          {/* Card 1: AutoDM */}
          <div
            style={{
              padding: "32px 28px",
              borderRadius: "20px",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "1.3rem",
                  marginBottom: "20px",
                }}
              >
                📸
              </div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", margin: "0 0 10px" }}>
                Instagram AutoDM Engine
              </h3>
              <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
                Set up keyword triggers for your reels, posts, and carousels. Followers comment words like &ldquo;LINK&rdquo; or &ldquo;INFO&rdquo; and receive private DMs in under 3 seconds.
              </p>
            </div>
            <Link
              href="/dashboard/autodm"
              style={{
                marginTop: "24px",
                color: "#60a5fa",
                fontSize: "0.88rem",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              Configure AutoDM Rules →
            </Link>
          </div>

          {/* Card 2: UPI Express Checkout */}
          <div
            style={{
              padding: "32px 28px",
              borderRadius: "20px",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "1.3rem",
                  marginBottom: "20px",
                }}
              >
                💳
              </div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", margin: "0 0 10px" }}>
                UPI Express Checkout
              </h3>
              <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
                Frictionless 1-click payments designed for mobile. Indian buyers pay with Google Pay, PhonePe, Paytm, or direct QR code without entering credit card details.
              </p>
            </div>
            <Link
              href="/dashboard/products"
              style={{
                marginTop: "24px",
                color: "#34d399",
                fontSize: "0.88rem",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              Manage Products & Pricing →
            </Link>
          </div>

          {/* Card 3: Leads CRM */}
          <div
            style={{
              padding: "32px 28px",
              borderRadius: "20px",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #0284c7 0%, #0066fe 100%)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "1.3rem",
                  marginBottom: "20px",
                }}
              >
                👥
              </div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", margin: "0 0 10px" }}>
                Unified Audience CRM
              </h3>
              <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
                Every comment, purchase, and lead magnet opt-in creates a verified customer record. Export your customer database anytime with lifetime revenue analytics.
              </p>
            </div>
            <Link
              href="/dashboard/leads"
              style={{
                marginTop: "24px",
                color: "#38bdf8",
                fontSize: "0.88rem",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              Explore CRM Leads →
            </Link>
          </div>
        </div>
      </section>

      {/* Modern Footer */}
      <footer
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(10, 14, 23, 0.95)",
          padding: "40px 24px",
        }}
      >
        <div
          style={{
            maxWidth: "1120px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "6px",
                background: "#0066fe",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
                fontSize: "0.8rem",
                fontWeight: 800,
              }}
            >
              ✦
            </div>
            <span style={{ fontWeight: 700, color: "#ffffff" }}>Hyperprofile</span>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>· Creator Commerce for India</span>
          </div>

          <div style={{ display: "flex", gap: "24px", fontSize: "0.85rem", color: "#94a3b8" }}>
            <Link href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>
              Privacy Policy
            </Link>
            <Link href="/terms" style={{ color: "inherit", textDecoration: "none" }}>
              Terms of Service
            </Link>
            <Link href="/report" style={{ color: "inherit", textDecoration: "none" }}>
              Report Abuse
            </Link>
            <Link href="/dashboard/settings" style={{ color: "inherit", textDecoration: "none" }}>
              Settings & Plans
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
