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
      setLeads([]);
      setStats(null);
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
        return { bg: "rgba(168, 85, 247, 0.15)", text: "#c084fc", icon: "⚡" };
      case "1:1 Consultation":
        return { bg: "rgba(16, 185, 129, 0.15)", text: "#34d399", icon: "📅" };
      case "VIP Telegram":
        return { bg: "rgba(42, 171, 238, 0.15)", text: "#38bdf8", icon: "✈" };
      case "Checkout Purchase":
        return { bg: "rgba(232, 165, 75, 0.15)", text: "#fbbf24", icon: "💳" };
      default:
        return { bg: "rgba(156, 163, 175, 0.15)", text: "#9ca3af", icon: "🎁" };
    }
  }

  function getStatusBadge(status: Lead["status"]) {
    switch (status) {
      case "consultation_booked":
        return { label: "Consultation Booked", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" };
      case "vip_member":
        return { label: "VIP Member", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.15)" };
      case "customer":
        return { label: "Customer", color: "#e8a54b", bg: "rgba(232, 165, 75, 0.15)" };
      case "subscribed":
      default:
        return { label: "Subscribed", color: "#a1a1aa", bg: "rgba(161, 161, 170, 0.12)" };
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.6rem" }}>👥</span>
            <h1 style={{ fontSize: "1.75rem", margin: 0, fontWeight: 800 }}>Unified Leads CRM</h1>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "3px 9px",
                borderRadius: "12px",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                fontWeight: 700,
              }}
            >
              SuperProfile OS v2.0
            </span>
          </div>
          <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: "0.92rem" }}>
            Real-time customer directory consolidating leads across Instagram AutoDM, Express Checkout, VIP Telegram, and 1:1 Consultations.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={fetchLeads}
            style={{
              padding: "10px 16px",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
              fontSize: "0.88rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🔄 Refresh
          </button>
          <a
            href="/v1/leads/export.csv"
            download="hyperprofile-leads.csv"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "10px",
              background: "var(--accent)",
              color: "#0f1a14",
              textDecoration: "none",
              fontSize: "0.9rem",
              fontWeight: 800,
              boxShadow: "0 4px 16px rgba(232, 165, 75, 0.25)",
            }}
          >
            <span>📥</span> Download CSV Export
          </a>
        </div>
      </div>

      {/* KPI Stat Cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px" }}>
          <div className="card" style={{ padding: "18px" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>
              Total Audience Leads
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, margin: "6px 0 2px", color: "var(--ink)" }}>
              {stats.totalLeads}
            </div>
            <div style={{ fontSize: "0.78rem", color: "#34d399", fontWeight: 600 }}>
              ✓ 100% Verified Opt-ins
            </div>
          </div>

          <div className="card" style={{ padding: "18px" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>
              Paying Customers
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, margin: "6px 0 2px", color: "#e8a54b" }}>
              {stats.payingCustomers}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              {stats.conversionRatePercent}% Lead-to-Paid Conversion
            </div>
          </div>

          <div className="card" style={{ padding: "18px" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>
              Pipeline Lifetime Value
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, margin: "6px 0 2px", color: "#10b981" }}>
              ₹{(stats.totalLtvPaise / 100).toFixed(2)}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              Avg LTV: ₹{(stats.avgLtvPaise / 100).toFixed(2)} per customer
            </div>
          </div>

          <div className="card" style={{ padding: "18px" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>
              Instagram AutoDM Leads
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, margin: "6px 0 2px", color: "#c084fc" }}>
              {stats.autodmCapturedCount}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              Captured via @jinbandhan automation
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "10px" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              type="text"
              placeholder="🔍 Search leads by name, email, phone, or Instagram handle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
                fontSize: "0.92rem",
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: "12px 20px",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
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
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", marginRight: "4px", fontWeight: 600 }}>
            Source:
          </span>
          {[
            { id: "all", label: "All Contacts" },
            { id: "autodm", label: "⚡ Instagram AutoDM" },
            { id: "consultation", label: "📅 1:1 Consultations" },
            { id: "telegram", label: "✈ VIP Telegram" },
            { id: "checkout", label: "💳 Digital Orders" },
            { id: "magnet", label: "🎁 Free Magnets" },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSourceFilter(s.id)}
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                border: sourceFilter === s.id ? "1px solid var(--accent)" : "1px solid var(--line)",
                background: sourceFilter === s.id ? "rgba(232, 165, 75, 0.2)" : "rgba(0,0,0,0.2)",
                color: sourceFilter === s.id ? "var(--accent)" : "var(--muted)",
                fontSize: "0.82rem",
                fontWeight: sourceFilter === s.id ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leads CRM Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", background: "rgba(255,255,255,0.02)" }}>
                <th style={{ padding: "14px 18px", color: "var(--muted)", fontWeight: 700, fontSize: "0.78rem" }}>
                  CONTACT
                </th>
                <th style={{ padding: "14px 18px", color: "var(--muted)", fontWeight: 700, fontSize: "0.78rem" }}>
                  PRIMARY SOURCE
                </th>
                <th style={{ padding: "14px 18px", color: "var(--muted)", fontWeight: 700, fontSize: "0.78rem" }}>
                  OFFERS / TOUCHPOINTS
                </th>
                <th style={{ padding: "14px 18px", color: "var(--muted)", fontWeight: 700, fontSize: "0.78rem" }}>
                  LIFETIME VALUE (INR)
                </th>
                <th style={{ padding: "14px 18px", color: "var(--muted)", fontWeight: 700, fontSize: "0.78rem" }}>
                  STATUS
                </th>
                <th style={{ padding: "14px 18px", color: "var(--muted)", fontWeight: 700, fontSize: "0.78rem" }}>
                  ACQUIRED
                </th>
                <th style={{ padding: "14px 18px", color: "var(--muted)", fontWeight: 700, fontSize: "0.78rem", textAlign: "right" }}>
                  ACTION
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: "36px", textAlign: "center", color: "var(--muted)" }}>
                    Loading leads database...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
                    No leads found matching query. Try clearing filters.
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
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Contact Info */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              background: "rgba(232, 165, 75, 0.15)",
                              color: "var(--accent)",
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
                            <div style={{ fontWeight: 700, color: "var(--ink)" }}>{lead.name}</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{lead.email}</div>
                            {lead.phone && (
                              <div style={{ fontSize: "0.75rem", color: "#a1a1aa", marginTop: "1px" }}>
                                📞 {lead.phone}
                              </div>
                            )}
                            {lead.igUsername && (
                              <div style={{ fontSize: "0.75rem", color: "#c084fc", marginTop: "1px" }}>
                                📸 @{lead.igUsername}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Primary Source */}
                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            background: srcBadge.bg,
                            color: srcBadge.text,
                            fontSize: "0.78rem",
                            fontWeight: 700,
                          }}
                        >
                          <span>{srcBadge.icon}</span>
                          <span>{lead.primarySource}</span>
                        </span>
                        {lead.sources.length > 1 && (
                          <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "4px" }}>
                            +{lead.sources.length - 1} more touchpoint
                          </div>
                        )}
                      </td>

                      {/* Products / Touchpoints */}
                      <td style={{ padding: "14px 18px", maxWidth: "240px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {lead.productTitles.map((title, i) => (
                            <div
                              key={i}
                              style={{
                                fontSize: "0.78rem",
                                color: "var(--ink)",
                                textOverflow: "ellipsis",
                                overflow: "hidden",
                                whiteSpace: "nowrap",
                              }}
                              title={title}
                            >
                              • {title}
                            </div>
                          ))}
                          {lead.notes && (
                            <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontStyle: "italic", marginTop: "2px" }}>
                              Note: {lead.notes}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Lifetime Value */}
                      <td style={{ padding: "14px 18px" }}>
                        <div
                          style={{
                            fontWeight: 800,
                            color: lead.totalSpentPaise > 0 ? "#10b981" : "var(--muted)",
                            fontSize: "0.95rem",
                          }}
                        >
                          ₹{(lead.totalSpentPaise / 100).toFixed(2)}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                          {lead.ordersCount} {lead.ordersCount === 1 ? "order" : "orders"}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 18px" }}>
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
                      <td style={{ padding: "14px 18px", color: "var(--muted)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        {new Date(lead.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      {/* Copy Action */}
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => handleCopyEmail(lead.email)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid var(--line)",
                            color: copiedEmail === lead.email ? "#34d399" : "var(--ink)",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {copiedEmail === lead.email ? "Copied ✓" : "Copy Email"}
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

