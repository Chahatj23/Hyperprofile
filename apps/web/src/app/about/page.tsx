import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | Hyperprofile Creator Commerce",
  description: "Learn about Hyperprofile's mission to empower Indian digital creators with automated social commerce, instant UPI payouts, and complete data ownership.",
};

export default function AboutPage() {
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
            <Link href="/pricing" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
              Pricing
            </Link>
            <Link href="/about" style={{ color: "#38bdf8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 700 }}>
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
      <section style={{ padding: "80px 24px 60px", maxWidth: "860px", margin: "0 auto", textAlign: "center" }}>
        <h1
          style={{
            fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            margin: "0 0 20px",
            lineHeight: 1.15,
          }}
        >
          Building the Sovereign Operating System for Indian Creators
        </h1>
        <p style={{ fontSize: "1.15rem", color: "#94a3b8", lineHeight: 1.6, margin: "0 auto 40px" }}>
          Indian creators produce world-class reels, guides, and masterclasses, but lose up to 10% in platform fees and drop-offs from western checkout solutions. We built Hyperprofile to fix that.
        </p>
      </section>

      {/* Pillars */}
      <section style={{ maxWidth: "1080px", margin: "0 auto 100px", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "28px" }}>
          <div style={{ padding: "32px", borderRadius: "20px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "16px" }}>🇮🇳</div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", margin: "0 0 10px" }}>
              India-First Architecture
            </h3>
            <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
              Native integration with UPI deep linking, GPay, PhonePe, and instant GST invoices tailored to Indian business requirements.
            </p>
          </div>

          <div style={{ padding: "32px", borderRadius: "20px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "16px" }}>🔐</div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", margin: "0 0 10px" }}>
              Complete Data Ownership
            </h3>
            <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
              Your followers, leads, and transaction records belong strictly to you. Zero pre-seeded accounts, isolated databases, and instant export capability.
            </p>
          </div>

          <div style={{ padding: "32px", borderRadius: "20px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "16px" }}>⚡</div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", margin: "0 0 10px" }}>
              Sub-3s Meta Automation
            </h3>
            <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
              Officially published Meta Graph API integration handling comment webhooks in real-time without risking Instagram shadowbans or account flags.
            </p>
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
