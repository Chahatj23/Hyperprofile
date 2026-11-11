"use client";

import { useState } from "react";
import Link from "next/link";

export default function ReportAbusePage() {
  const [url, setUrl] = useState("");
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url || !reason) return;
    setLoading(true);
    try {
      await fetch("/v1/compliance/report-abuse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: url, reason, reporterEmail: email }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <div className="card" style={{ width: "min(520px, 100%)", padding: "32px 28px" }}>
        <Link href="/" style={{ fontSize: "0.85rem", color: "var(--muted)", textDecoration: "none" }}>
          ← Back to Home
        </Link>
        <h1 style={{ fontSize: "1.6rem", margin: "16px 0 8px" }}>Report Abuse or Content Policy Violation</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.5, marginBottom: "20px" }}>
          We strictly prohibit unauthorized intellectual property distribution, fraudulent digital offerings, and prohibited goods. Reports are investigated by our trust & safety team within 24 hours.
        </p>

        {submitted ? (
          <div
            style={{
              padding: "20px",
              borderRadius: "12px",
              background: "rgba(52, 211, 153, 0.15)",
              color: "#34d399",
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            ✓ Report received. Thank you for helping keep our creator community safe.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "4px" }}>
                Target URL or Creator Page *
              </label>
              <input
                type="text"
                required
                placeholder="https://hyperprofile.bio/slug"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "4px" }}>
                Reason for Report *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Describe why this content violates policy (e.g. copyright infringement, scam, harassment)..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "4px" }}>
                Your Email (Optional, for investigation updates)
              </label>
              <input
                type="email"
                placeholder="reporter@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 0",
                borderRadius: "8px",
                background: "var(--accent)",
                color: "#0f1a14",
                border: "none",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: "pointer",
                marginTop: "6px",
              }}
            >
              {loading ? "Submitting..." : "Submit Report"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
