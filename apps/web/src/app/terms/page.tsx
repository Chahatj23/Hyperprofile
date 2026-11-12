"use client";

import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <main className="shell">
      <div className="card" style={{ width: "min(680px, 100%)", padding: "36px 32px" }}>
        <Link href="/" style={{ fontSize: "0.85rem", color: "var(--muted)", textDecoration: "none" }}>
          ← Back to Home
        </Link>
        <h1 style={{ fontSize: "1.8rem", margin: "16px 0 8px" }}>Terms of Service</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "24px" }}>
          Last Updated: November 2026. By accessing or using the Hyperprofile platform (&ldquo;Service&rdquo;), you agree to be bound by these Terms of Service.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", fontSize: "0.9rem", color: "var(--ink)", lineHeight: 1.6 }}>
          <div>
            <strong>1. Service Description</strong>
            <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
              Hyperprofile provides creator storefronts, digital product delivery, automated comment reply integration for Instagram Business accounts (AutoDM), and first-party analytics.
            </p>
          </div>

          <div>
            <strong>2. Meta Platform Compliance &amp; Acceptable Use</strong>
            <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
              All Instagram automation features strictly adhere to Meta&apos;s Platform Terms, Instagram Community Guidelines, and Developer Policies. Users may not use AutoDM to distribute spam, unauthorized promotional messages, deceptive links, or prohibited goods. Automated replies must be relevant and user-initiated.
            </p>
          </div>

          <div>
            <strong>3. Digital Products &amp; Payments</strong>
            <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
              Transactions for digital downloads, courses, and 1:1 sessions are processed through certified payment partners via UPI, debit/credit cards, and net banking. Creators are responsible for the content, delivery accuracy, and tax compliance (including GST where applicable) of their offerings.
            </p>
          </div>

          <div>
            <strong>4. Data Ownership &amp; Privacy</strong>
            <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
              Creators own all digital assets and customer relationships. Buyer data is handled strictly under our <Link href="/privacy" style={{ color: "var(--accent)" }}>Privacy Policy</Link> and applicable data protection regulations (including DPDP Act).
            </p>
          </div>

          <div>
            <strong>5. Account Termination &amp; Disconnection</strong>
            <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
              You may disconnect your Instagram account or revoke access at any time through your Meta Business Integrations settings or within our dashboard. All data deletion callbacks will be processed automatically within 24 hours.
            </p>
          </div>

          <div>
            <strong>6. Contact &amp; Support</strong>
            <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
              For support or compliance inquiries, contact us at <code>support@hyperprofile.bio</code>.
            </p>
          </div>
        </div>

        <div style={{ marginTop: "32px", borderTop: "1px solid var(--line)", paddingTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>© 2026 Hyperprofile Inc.</span>
          <div style={{ display: "flex", gap: "16px", fontSize: "0.8rem" }}>
            <Link href="/privacy" style={{ color: "var(--accent)", textDecoration: "none" }}>Privacy Policy</Link>
            <Link href="/report" style={{ color: "var(--muted)", textDecoration: "none" }}>Report Abuse</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

