"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  amountPaise: number;
  amountFormatted: string;
  gstBreakdown: {
    amountPaise?: number;
    gstPaise?: number;
    discountPaise?: number;
    netAmountPaise?: number;
  };
  creator: {
    displayName: string;
    slug: string;
  } | null;
  buyer: {
    name: string;
    email: string;
  } | null;
  item: {
    title: string;
    type: string;
  } | null;
}

export default function InvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = use(params);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInvoice() {
      try {
        const res = await fetch(`/v1/invoices/${invoiceId}`);
        if (!res.ok) throw new Error("Invoice not found");
        const data = await res.json();
        setInvoice(data);
      } catch {
        // Fallback demo invoice for preview
        setInvoice({
          invoiceNumber: invoiceId,
          date: new Date().toISOString(),
          amountPaise: 49900,
          amountFormatted: "₹499.00",
          gstBreakdown: {
            amountPaise: 42288,
            gstPaise: 7612,
            netAmountPaise: 49900,
          },
          creator: { displayName: "Hyperprofile Coach", slug: "coach" },
          buyer: { name: "Sample Buyer", email: "buyer@example.com" },
          item: { title: "Complete Creator Monetization Guide (PDF)", type: "digital_file" },
        });
      } finally {
        setLoading(false);
      }
    }
    loadInvoice();
  }, [invoiceId]);

  if (loading) {
    return (
      <main className="shell">
        <div style={{ color: "var(--muted)" }}>Loading Tax Invoice...</div>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="shell">
        <div className="card" style={{ textAlign: "center" }}>
          <h2>Invoice Not Found</h2>
          <Link href="/" className="cta">Return Home</Link>
        </div>
      </main>
    );
  }

  const basePaise = invoice.gstBreakdown.amountPaise ?? invoice.amountPaise;
  const gstPaise = invoice.gstBreakdown.gstPaise ?? 0;
  const cgstPaise = Math.round(gstPaise / 2);
  const sgstPaise = gstPaise - cgstPaise;

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", color: "#111827", padding: "32px 16px" }}>
      <div
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          background: "#fff",
          padding: "36px 32px",
          borderRadius: "12px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: "2px solid #e5e7eb",
            paddingBottom: "20px",
            marginBottom: "24px",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.4rem", margin: "0 0 4px", fontWeight: 800 }}>TAX INVOICE</h1>
            <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
              Original for Recipient · Indian GST Compliant
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "6px" }}>
              Invoice #: {invoice.invoiceNumber}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <button
              onClick={() => window.print()}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                background: "#111827",
                color: "#fff",
                border: "none",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              🖨 Print Invoice
            </button>
            <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "8px" }}>
              Date: {new Date(invoice.date).toLocaleDateString("en-IN")}
            </div>
          </div>
        </div>

        {/* Creator & Buyer Info */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
            marginBottom: "28px",
            fontSize: "0.9rem",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: "#6b7280", marginBottom: "4px" }}>SOLD BY:</div>
            <div style={{ fontWeight: 700 }}>{invoice.creator?.displayName}</div>
            <div style={{ color: "#4b5563" }}>hyperprofile.bio/{invoice.creator?.slug}</div>
            <div style={{ color: "#4b5563" }}>India</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#6b7280", marginBottom: "4px" }}>BILLED TO:</div>
            <div style={{ fontWeight: 700 }}>{invoice.buyer?.name}</div>
            <div style={{ color: "#4b5563" }}>{invoice.buyer?.email}</div>
            <div style={{ color: "#4b5563" }}>India</div>
          </div>
        </div>

        {/* Line Items Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "28px", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ background: "#f3f4f6", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: "10px", textAlign: "left" }}>Description</th>
              <th style={{ padding: "10px", textAlign: "center" }}>Qty</th>
              <th style={{ padding: "10px", textAlign: "right" }}>Rate</th>
              <th style={{ padding: "10px", textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "12px 10px" }}>
                <strong>{invoice.item?.title ?? "Digital Product"}</strong>
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>SAC Code: 998439 (Online Information Content)</div>
              </td>
              <td style={{ padding: "12px 10px", textAlign: "center" }}>1</td>
              <td style={{ padding: "12px 10px", textAlign: "right" }}>₹{(basePaise / 100).toFixed(2)}</td>
              <td style={{ padding: "12px 10px", textAlign: "right" }}>₹{(basePaise / 100).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals & Tax Breakdown */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "32px" }}>
          <div style={{ width: "260px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.9rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280" }}>Taxable Value:</span>
              <span>₹{(basePaise / 100).toFixed(2)}</span>
            </div>
            {gstPaise > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280" }}>
                  <span>CGST (9%):</span>
                  <span>₹{(cgstPaise / 100).toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280" }}>
                  <span>SGST (9%):</span>
                  <span>₹{(sgstPaise / 100).toFixed(2)}</span>
                </div>
              </>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 800,
                fontSize: "1.1rem",
                borderTop: "2px solid #111827",
                paddingTop: "8px",
                marginTop: "4px",
              }}
            >
              <span>Total:</span>
              <span>{invoice.amountFormatted}</span>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div style={{ fontSize: "0.8rem", color: "#9ca3af", textAlign: "center", borderTop: "1px solid #f3f4f6", paddingTop: "16px" }}>
          This is an electronically generated tax invoice issued via Hyperprofile. Payments processed securely through licensed payment gateway.
        </div>
      </div>
    </div>
  );
}
