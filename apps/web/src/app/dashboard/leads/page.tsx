"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string | undefined;
  igUsername?: string | undefined;
  primarySource: "Instagram AutoDM" | "Checkout Purchase" | "VIP Telegram" | "1:1 Consultation" | "Lead Magnet";
  sources: string[];
  productTitles: string[];
  totalSpentPaise: number;
  ordersCount: number;
  status: "subscribed" | "customer" | "consultation_booked" | "vip_member";
  createdAt: string;
  lastActiveAt: string;
  notes?: string | undefined;
}

interface LeadsStats {
  totalLeads: number;
  payingCustomers: number;
  totalLtvPaise: number;
  avgLtvPaise: number;
  autodmCapturedCount: number;
  consultationsCount: number;
  telegramVipCount: number;
  conversionRatePercent: number;
}

export default function LeadsCrmPage() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadsStats | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  async function fetchLeads() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (sourceFilter !== "all") params.set("source", sourceFilter);

      const res = await fetch(`/v1/leads?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load leads");
      const data = await res.json();
      setLeads(data.leads || []);
      setStats(data.stats || null);
    } catch {
      // Default fallback
      setLeads([]);
      setStats({
        totalLeads: 0,
        payingCustomers: 0,
        totalLtvPaise: 0,
        avgLtvPaise: 0,
        autodmCapturedCount: 0,
        consultationsCount: 0,
        telegramVipCount: 0,
        conversionRatePercent: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeads();
  }, [sourceFilter]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchLeads();
  }

  function handleCopyEmail(email: string) {
    navigator.clipboard?.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  }

  function getSourceBadge(source: string) {
    switch (source) {
      case "Instagram AutoDM":
        return { bg: "#fdf4ff", text: "#a21caf", icon: "⚡" };
      case "1:1 Consultation":
        return { bg: "#f0fdf4", text: "#15803d", icon: "📅" };
      case "VIP Telegram":
        return { bg: "#f0f9ff", text: "#0369a1", icon: "✈" };
      case "Checkout Purchase":
        return { bg: "#fffbeb", text: "#b45309", icon: "💳" };
      default:
        return { bg: "#f1f5f9", text: "#475569", icon: "🎁" };
    }
  }

  function getStatusBadge(status: Lead["status"]) {
    switch (status) {
      case "consultation_booked":
        return { label: "Consultation Booked", color: "#15803d", bg: "#dcfce7" };
      case "vip_member":
        return { label: "VIP Member", color: "#0369a1", bg: "#e0f2fe" };
      case "customer":
        return { label: "Customer", color: "#b45309", bg: "#fef3c7" };
      case "subscribed":
      default:
        return { label: "Subscribed", color: "#475569", bg: "#f1f5f9" };
    }
  }

  return (
    <div style={{ maxWidth: "1120px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{ fontSize: "1.5rem" }}>👥</span>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
              Unified Audience Leads & CRM
            </h1>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "3px 10px",
                borderRadius: "20px",
                background: "#dcfce7",
                color: "#15803d",
                fontWeight: 700,
              }}
            >
              Live Sync Active
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "0.92rem", color: "#64748b" }}>
            Audience contacts automatically captured from Instagram AutoDM comments, UPI store checkouts, and 1:1 bookings.
          </p>
        </div>

        <a
          href="/v1/leads/export.csv"
          download="hyperprofile-leads.csv"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            borderRadius: "10px",
            background: "#ffffff",
            color: "#0f172a",
            border: "1px solid #cbd5e1",
            textDecoration: "none",
            fontSize: "0.9rem",
            fontWeight: 700,
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <span>📥</span>
          <span>Download CSV Export</span>
        </a>
      </div>

      {/* KPI Stat Cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "18px 20px" }}>
            <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Audience Leads
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, margin: "6px 0 2px", color: "#0f172a" }}>
              {stats.totalLeads}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: 600 }}>
              ✓ 100% Verified Opt-ins
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "18px 20px" }}>
            <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Paying Customers
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, margin: "6px 0 2px", color: "#0066fe" }}>
              {stats.payingCustomers}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
              {stats.conversionRatePercent}% Lead-to-Paid Conversion
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "18px 20px" }}>
            <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Pipeline Lifetime Value
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, margin: "6px 0 2px", color: "#10b981" }}>
              ₹{(stats.totalLtvPaise / 100).toFixed(2)}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Avg LTV: ₹{(stats.avgLtvPaise / 100).toFixed(2)} per customer
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "18px 20px" }}>
            <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Instagram AutoDM Leads
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, margin: "6px 0 2px", color: "#a21caf" }}>
              {stats.autodmCapturedCount}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Captured via @jinbandhan
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar Card */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "10px" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              type="text"
              placeholder="Search leads by name, email, phone, or Instagram handle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                color: "#0f172a",
                fontSize: "0.92rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              borderRadius: "10px",
              background: "#0066fe",
              color: "#ffffff",
              border: "none",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </form>

        {/* Source Pills */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.82rem", color: "#64748b", marginRight: "4px", fontWeight: 600 }}>
            Source:
          </span>
          {[
            { id: "all", label: "All Contacts" },
            { id: "autodm", label: "⚡ Instagram AutoDM" },
            { id: "consultation", label: "📅 1:1 Consultations" },
            { id: "telegram", label: "✈ VIP Telegram" },
            { id: "checkout", label: "💳 Digital Orders" },
            { id: "magnet", label: "🎁 Free Magnets" },
          ].map((s) => {
            const isSelected = sourceFilter === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSourceFilter(s.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  border: isSelected ? "1px solid #0066fe" : "1px solid #e2e8f0",
                  background: isSelected ? "#eff6ff" : "#ffffff",
                  color: isSelected ? "#0066fe" : "#475569",
                  fontSize: "0.82rem",
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.12s ease",
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Leads Table Card */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "14px 20px", color: "#475569", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase" }}>
                  Contact
                </th>
                <th style={{ padding: "14px 20px", color: "#475569", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase" }}>
                  Source
                </th>
                <th style={{ padding: "14px 20px", color: "#475569", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase" }}>
                  Offers & Touchpoints
                </th>
                <th style={{ padding: "14px 20px", color: "#475569", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase" }}>
                  Lifetime Value
                </th>
                <th style={{ padding: "14px 20px", color: "#475569", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase" }}>
                  Status
                </th>
                <th style={{ padding: "14px 20px", color: "#475569", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase" }}>
                  Acquired
                </th>
                <th style={{ padding: "14px 20px", color: "#475569", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase", textAlign: "right" }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                    Loading leads database...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "50px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: "2.2rem", marginBottom: "10px" }}>👥</div>
                    <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
                      No leads found
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                      Leads will appear here automatically when followers comment on reels or buy digital products.
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const srcBadge = getSourceBadge(lead.primarySource);
                  const statusBadge = getStatusBadge(lead.status);

                  return (
                    <tr
                      key={lead.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 0.12s ease",
                      }}
                    >
                      {/* Contact Info */}
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              background: "#eff6ff",
                              color: "#0066fe",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 800,
                              fontSize: "0.95rem",
                              flexShrink: 0,
                            }}
                          >
                            {lead.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: "#0f172a" }}>{lead.name}</div>
                            <div style={{ fontSize: "0.82rem", color: "#64748b" }}>{lead.email}</div>
                            {lead.igUsername && (
                              <div style={{ fontSize: "0.78rem", color: "#a21caf", fontWeight: 600, marginTop: "2px" }}>
                                @{lead.igUsername}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Primary Source */}
                      <td style={{ padding: "16px 20px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "4px 10px",
                            borderRadius: "20px",
                            background: srcBadge.bg,
                            color: srcBadge.text,
                            fontSize: "0.78rem",
                            fontWeight: 700,
                          }}
                        >
                          <span>{srcBadge.icon}</span>
                          <span>{lead.primarySource}</span>
                        </span>
                      </td>

                      {/* Products / Touchpoints */}
                      <td style={{ padding: "16px 20px", maxWidth: "240px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          {lead.productTitles.map((title, i) => (
                            <div
                              key={i}
                              style={{
                                fontSize: "0.82rem",
                                color: "#334155",
                                textOverflow: "ellipsis",
                                overflow: "hidden",
                                whiteSpace: "nowrap",
                              }}
                              title={title}
                            >
                              • {title}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Lifetime Value */}
                      <td style={{ padding: "16px 20px" }}>
                        <div
                          style={{
                            fontWeight: 800,
                            color: lead.totalSpentPaise > 0 ? "#10b981" : "#0f172a",
                            fontSize: "0.95rem",
                          }}
                        >
                          ₹{(lead.totalSpentPaise / 100).toFixed(2)}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {lead.ordersCount} {lead.ordersCount === 1 ? "order" : "orders"}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "16px 20px" }}>
                        <span
                          style={{
                            padding: "3px 9px",
                            borderRadius: "6px",
                            background: statusBadge.bg,
                            color: statusBadge.color,
                            fontSize: "0.75rem",
                            fontWeight: 700,
                          }}
                        >
                          {statusBadge.label}
                        </span>
                      </td>

                      {/* Acquired Date */}
                      <td style={{ padding: "16px 20px", color: "#64748b", fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                        {new Date(lead.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      {/* Action */}
                      <td style={{ padding: "16px 20px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => handleCopyEmail(lead.email)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            color: copiedEmail === lead.email ? "#10b981" : "#334155",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {copiedEmail === lead.email ? "✓ Copied" : "Copy Email"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
