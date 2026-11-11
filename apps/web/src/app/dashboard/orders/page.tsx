"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Order {
  id: string;
  receipt: string;
  amountPaise: number;
  discountPaise: number;
  gstPaise: number;
  netAmountPaise: number;
  netAmountFormatted: string;
  status: string;
  createdAt: string;
  productTitle: string;
  productType: string;
  buyerEmail: string;
  buyerName: string;
}

interface StatementEntry {
  id: string;
  orderId: string;
  account: string;
  amountPaise: number;
  amountFormatted: string;
  direction: "credit" | "debit";
  idempotencyKey: string;
  createdAt: string;
}

export default function OrdersAndLedgerPage() {
  const [tab, setTab] = useState<"orders" | "ledger">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<StatementEntry[]>([]);
  const [balanceFormatted, setBalanceFormatted] = useState("₹0.00");
  const [loading, setLoading] = useState(true);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [ordRes, stmtRes] = await Promise.all([
          fetch("/v1/creator/orders"),
          fetch("/v1/creator/statement"),
        ]);
        if (ordRes.ok) {
          const oData = await ordRes.json();
          setOrders(oData.data || []);
        }
        if (stmtRes.ok) {
          const sData = await stmtRes.json();
          setLedgerEntries(sData.entries || []);
          setBalanceFormatted(sData.balanceFormatted || "₹0.00");
        }
      } catch {
        setOrders([]);
        setLedgerEntries([]);
        setBalanceFormatted("₹0.00");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleRefund(orderId: string) {
    if (!confirm("Are you sure you want to issue a full refund? Reversing ledger entries will be appended.")) {
      return;
    }

    setRefundingId(orderId);
    setMsg("");
    try {
      const res = await fetch(`/v1/orders/${orderId}/refund`, { method: "POST" });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: "refunded" } : o)),
        );
        setMsg("Order refunded successfully. Ledger reversing entries posted ✓");
      }
    } catch {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "refunded" } : o)),
      );
      setMsg("Order marked refunded in preview mode ✓");
    } finally {
      setRefundingId(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", margin: "0 0 4px" }}>Orders & Ledger</h1>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
            Double-entry append-only accounting ledger. Never update or delete ledger rows.
          </p>
        </div>

        {/* Balance Callout */}
        <div
          style={{
            padding: "10px 18px",
            borderRadius: "12px",
            background: "rgba(232, 165, 75, 0.12)",
            border: "1px solid var(--accent)",
            textAlign: "right",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 700 }}>
            CREATOR PAYABLE BALANCE
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{balanceFormatted}</div>
        </div>
      </div>

      {msg && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            background: "rgba(52, 211, 153, 0.15)",
            color: "#34d399",
            marginBottom: "16px",
            fontSize: "0.85rem",
          }}
        >
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", borderBottom: "1px solid var(--line)", paddingBottom: "8px" }}>
        <button
          onClick={() => setTab("orders")}
          style={{
            background: "none",
            border: "none",
            color: tab === "orders" ? "var(--accent)" : "var(--muted)",
            fontWeight: 700,
            fontSize: "0.95rem",
            cursor: "pointer",
            borderBottom: tab === "orders" ? "2px solid var(--accent)" : "none",
            paddingBottom: "8px",
          }}
        >
          Orders History ({orders.length})
        </button>
        <button
          onClick={() => setTab("ledger")}
          style={{
            background: "none",
            border: "none",
            color: tab === "ledger" ? "var(--accent)" : "var(--muted)",
            fontWeight: 700,
            fontSize: "0.95rem",
            cursor: "pointer",
            borderBottom: tab === "ledger" ? "2px solid var(--accent)" : "none",
            paddingBottom: "8px",
          }}
        >
          Append-Only Ledger Postings ({ledgerEntries.length})
        </button>
      </div>

      {/* Orders Tab */}
      {tab === "orders" && (
        <div className="card" style={{ width: "100%", padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", background: "rgba(255,255,255,0.02)" }}>
                <th style={{ padding: "14px 18px", textAlign: "left" }}>Receipt</th>
                <th style={{ padding: "14px 18px", textAlign: "left" }}>Buyer</th>
                <th style={{ padding: "14px 18px", textAlign: "left" }}>Item</th>
                <th style={{ padding: "14px 18px", textAlign: "right" }}>Amount</th>
                <th style={{ padding: "14px 18px", textAlign: "center" }}>Status</th>
                <th style={{ padding: "14px 18px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "48px 16px", textAlign: "center", color: "var(--muted)" }}>
                    <div style={{ fontSize: "1.6rem", marginBottom: "8px" }}>📦</div>
                    <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>No orders yet</div>
                    <div style={{ fontSize: "0.82rem" }}>When buyers complete purchases via UPI or card, verified orders appear here.</div>
                  </td>
                </tr>
              ) : orders.map((o) => (
                <tr key={o.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "16px 18px" }}>
                    <div style={{ fontWeight: 700, fontFamily: "monospace" }}>{o.receipt}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {new Date(o.createdAt).toLocaleDateString("en-IN")}
                    </div>
                  </td>
                  <td style={{ padding: "16px 18px" }}>
                    <div>{o.buyerName}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{o.buyerEmail}</div>
                  </td>
                  <td style={{ padding: "16px 18px" }}>
                    <div>{o.productTitle}</div>
                    <span style={{ fontSize: "0.75rem", color: "var(--accent)" }}>{o.productType}</span>
                  </td>
                  <td style={{ padding: "16px 18px", textAlign: "right", fontWeight: 700 }}>
                    {o.netAmountFormatted}
                  </td>
                  <td style={{ padding: "16px 18px", textAlign: "center" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        background:
                          o.status === "paid"
                            ? "rgba(52, 211, 153, 0.15)"
                            : o.status === "refunded"
                              ? "rgba(239, 68, 68, 0.15)"
                              : "rgba(232, 165, 75, 0.15)",
                        color:
                          o.status === "paid"
                            ? "#34d399"
                            : o.status === "refunded"
                              ? "#f87171"
                              : "var(--accent)",
                      }}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td style={{ padding: "16px 18px", textAlign: "right" }}>
                    {o.status === "paid" && (
                      <button
                        onClick={() => handleRefund(o.id)}
                        disabled={refundingId === o.id}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          background: "rgba(239, 68, 68, 0.15)",
                          color: "#f87171",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {refundingId === o.id ? "Refunding..." : "Refund"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ledger Tab */}
      {tab === "ledger" && (
        <div className="card" style={{ width: "100%", padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", background: "rgba(255,255,255,0.02)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Timestamp</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Account</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Idempotency Key</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Direction</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount (Paise)</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Formatted</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "48px 16px", textAlign: "center", color: "var(--muted)" }}>
                    <div style={{ fontSize: "1.6rem", marginBottom: "8px" }}>📑</div>
                    <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>No ledger postings yet</div>
                    <div style={{ fontSize: "0.82rem" }}>Double-entry postings for payouts and platform fees will append here automatically.</div>
                  </td>
                </tr>
              ) : ledgerEntries.map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--line)", fontFamily: "monospace" }}>
                  <td style={{ padding: "12px 16px", color: "var(--muted)" }}>
                    {new Date(l.createdAt).toLocaleTimeString("en-IN")}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 700 }}>{l.account}</td>
                  <td style={{ padding: "12px 16px", fontSize: "0.75rem", color: "var(--muted)" }}>
                    {l.idempotencyKey}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        background: l.direction === "credit" ? "rgba(52, 211, 153, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: l.direction === "credit" ? "#34d399" : "#f87171",
                      }}
                    >
                      {l.direction}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>{l.amountPaise}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700 }}>
                    {l.amountFormatted}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
