import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="card" style={{ width: "min(560px, 100%)" }}>
        <h1 className="brand">Hyperprofile</h1>
        <p className="lede">
          Creator commerce platform for Indian creators — fast mobile link-in-bio, UPI-first checkout, digital products, and Meta-compliant Instagram AutoDM.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "20px 0" }}>
          <Link className="cta" href="/dashboard/builder">
            🎨 Open Page Builder
          </Link>
          <Link
            href="/sample-creator"
            style={{
              display: "block",
              width: "100%",
              padding: "12px 0",
              textAlign: "center",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.08)",
              color: "var(--ink)",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "0.95rem",
              border: "1px solid var(--line)",
            }}
          >
            📱 View Live Sample Creator Store ↗
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
            marginBottom: "24px",
            fontSize: "0.85rem",
          }}
        >
          <Link
            href="/dashboard/products"
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "rgba(0,0,0,0.25)",
              border: "1px solid var(--line)",
              textDecoration: "none",
              color: "var(--ink)",
            }}
          >
            <strong>📦 Products & Offers</strong>
            <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "2px" }}>
              Digital files, link gates, sessions
            </div>
          </Link>

          <Link
            href="/dashboard/orders"
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "rgba(0,0,0,0.25)",
              border: "1px solid var(--line)",
              textDecoration: "none",
              color: "var(--ink)",
            }}
          >
            <strong>💳 Orders & Ledger</strong>
            <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "2px" }}>
              Double-entry append-only ledger
            </div>
          </Link>

          <Link
            href="/dashboard/autodm"
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "rgba(0,0,0,0.25)",
              border: "1px solid var(--line)",
              textDecoration: "none",
              color: "var(--ink)",
            }}
          >
            <strong>⚡ Instagram AutoDM</strong>
            <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "2px" }}>
              Rule builder & delivery logs
            </div>
          </Link>

          <Link
            href="/dashboard/analytics"
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "rgba(0,0,0,0.25)",
              border: "1px solid var(--line)",
              textDecoration: "none",
              color: "var(--ink)",
            }}
          >
            <strong>📈 Analytics</strong>
            <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "2px" }}>
              Zero-tracker first-party metrics
            </div>
          </Link>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "14px", borderTop: "1px solid var(--line)" }}>
          <Link href="/connect" style={{ color: "var(--accent)", fontSize: "0.85rem", textDecoration: "none" }}>
            Instagram Connect →
          </Link>
          <Link href="/insights" style={{ color: "var(--muted)", fontSize: "0.85rem", textDecoration: "none" }}>
            View Insights →
          </Link>
          <Link href="/privacy" style={{ color: "var(--muted)", fontSize: "0.85rem", textDecoration: "none" }}>
            DPDP Privacy →
          </Link>
        </div>

        <p className="meta" style={{ marginTop: "16px", textAlign: "center" }}>
          English · हिन्दी · Built for India
        </p>
      </section>
    </main>
  );
}
