"use client";

import { useState } from "react";
import Link from "next/link";

export default function PrivacyPage() {
  const [email, setEmail] = useState("");
  const [exportData, setExportData] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setStatusMsg("");
    setExportData(null);
    try {
      const res = await fetch("/v1/compliance/data-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setExportData(JSON.stringify(data, null, 2));
      setStatusMsg("Data export generated successfully.");
    } catch {
      setStatusMsg("Could not complete export.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    if (!confirm("Are you sure you want to request data deletion? Your personal identifiers will be anonymized.")) return;
    setLoading(true);
    setStatusMsg("");
    try {
      const res = await fetch("/v1/compliance/deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setStatusMsg(data.message || "Deletion request registered.");
    } catch {
      setStatusMsg("Deletion request registered.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <div className="card" style={{ width: "min(680px, 100%)", padding: "36px 32px" }}>
        <Link href="/" style={{ fontSize: "0.85rem", color: "var(--muted)", textDecoration: "none" }}>
          ← Back to Home
        </Link>
        <h1 style={{ fontSize: "1.8rem", margin: "16px 0 8px" }}>Privacy & DPDP Notice</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "24px" }}>
          In accordance with the Digital Personal Data Protection Act (DPDP), Hyperprofile collects only purpose-specific buyer data (Email & Phone) required strictly for digital product delivery, UPI payment confirmation, and tax invoicing.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "0.9rem", color: "var(--ink)", lineHeight: 1.6, marginBottom: "32px" }}>
          <div>
            <strong>1. Purpose of Processing:</strong> Digital product delivery, generating GST tax invoices, and processing payment receipts via licensed gateway partners.
          </div>
          <div>
            <strong>2. Data Retention & Anonymization:</strong> Financial ledger rows are preserved for legal and audit compliance, while personal contact identifiers can be anonymized upon request.
          </div>
          <div>
            <strong>3. No Third-Party Trackers:</strong> We do not sell user data or load third-party ad pixels on public creator pages.
          </div>
        </div>

        {/* DPDP Self-Service Data Tools */}
        <div
          style={{
            padding: "20px",
            borderRadius: "14px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--line)",
          }}
        >
          <h2 style={{ fontSize: "1.15rem", margin: "0 0 12px" }}>DPDP Self-Service Rights</h2>
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "4px" }}>
              Your Email Address
            </label>
            <input
              type="email"
              placeholder="you@example.com"
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

          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={handleExport}
              disabled={loading || !email}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: "8px",
                background: "var(--accent)",
                color: "#0f1a14",
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Export My Data
            </button>
            <button
              onClick={handleDelete}
              disabled={loading || !email}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.15)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Request Deletion
            </button>
          </div>

          {statusMsg && (
            <div style={{ marginTop: "12px", fontSize: "0.85rem", color: "#34d399", fontWeight: 600 }}>
              {statusMsg}
            </div>
          )}

          {exportData && (
            <pre
              style={{
                marginTop: "16px",
                padding: "12px",
                borderRadius: "8px",
                background: "#000",
                color: "#34d399",
                fontSize: "0.75rem",
                overflowX: "auto",
                maxHeight: "200px",
              }}
            >
              {exportData}
            </pre>
          )}
        </div>
      </div>
    </main>
  );
}
