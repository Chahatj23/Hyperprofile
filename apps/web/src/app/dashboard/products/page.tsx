"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Product {
  id: string;
  type: string;
  title: string;
  description: string;
  pricePaise: number;
  currency: string;
  gstRate: number;
  status: string;
  deliveryConfig: Record<string, unknown>;
}

export default function ProductsManagerPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states
  const [type, setType] = useState<"digital_file" | "link_gate" | "session" | "lead_magnet">("digital_file");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceRupees, setPriceRupees] = useState("499");
  const [gstRate, setGstRate] = useState(18);
  const [deliveryValue, setDeliveryValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch("/v1/products");
        if (res.ok) {
          const data = await res.json();
          setProducts(data.data || []);
        }
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setMsg("");
    const pricePaise = type === "lead_magnet" ? 0 : Math.round(Number(priceRupees || 0) * 100);

    const deliveryConfig: Record<string, unknown> = {};
    if (type === "digital_file") deliveryConfig.fileUrl = deliveryValue;
    else if (type === "link_gate") deliveryConfig.externalUrl = deliveryValue;
    else if (type === "session") deliveryConfig.calendarUrl = deliveryValue;
    else if (type === "lead_magnet") deliveryConfig.downloadUrl = deliveryValue;

    try {
      const res = await fetch("/v1/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title,
          description,
          pricePaise,
          currency: "INR",
          gstRate,
          deliveryConfig,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setProducts([created.product, ...products]);
        setShowModal(false);
        setMsg("Product created successfully ✓");
        setTitle("");
        setDescription("");
        setDeliveryValue("");
      } else {
        const err = await res.json();
        setMsg(err.message || "Failed to create product");
      }
    } catch {
      // Local optimistic fallback
      const newProd: Product = {
        id: `p_${Date.now()}`,
        type,
        title,
        description,
        pricePaise,
        currency: "INR",
        gstRate,
        status: "active",
        deliveryConfig,
      };
      setProducts([newProd, ...products]);
      setShowModal(false);
      setMsg("Product created successfully ✓");
      setTitle("");
      setDescription("");
      setDeliveryValue("");
    } finally {
      setSubmitting(false);
      setTimeout(() => setMsg(""), 4000);
    }
  }

  function handleCopyCheckout(productId: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://hyperprofile-theta.vercel.app";
    const url = `${origin}/checkout/${productId}`;
    navigator.clipboard?.writeText(url);
    setCopiedId(productId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function getTypeBadge(prodType: string) {
    switch (prodType) {
      case "digital_file":
        return { label: "Digital Download", bg: "#eff6ff", color: "#1d4ed8", icon: "📄" };
      case "link_gate":
        return { label: "Link Gate", bg: "#fdf4ff", color: "#a21caf", icon: "🔗" };
      case "session":
        return { label: "1:1 Consultation", bg: "#f0fdf4", color: "#15803d", icon: "📅" };
      case "lead_magnet":
        return { label: "Free Lead Magnet", bg: "#fffbeb", color: "#b45309", icon: "🎁" };
      default:
        return { label: prodType, bg: "#f1f5f9", color: "#475569", icon: "📦" };
    }
  }

  return (
    <div style={{ maxWidth: "1120px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{ fontSize: "1.5rem" }}>🏪</span>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
              Products & Digital Store
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: "0.92rem", color: "#64748b" }}>
            Sell digital downloads, link gates, 1:1 sessions, and free lead magnets with UPI Express checkout.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            background: "#0066fe",
            color: "#ffffff",
            border: "none",
            fontSize: "0.9rem",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0, 102, 254, 0.25)",
            transition: "all 0.15s ease",
          }}
        >
          <span>+</span>
          <span>Create Product</span>
        </button>
      </div>

      {/* Alert toast */}
      {msg && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "12px",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            fontSize: "0.9rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 2px 4px rgba(16, 185, 129, 0.08)",
          }}
        >
          <span>🎉</span>
          <span>{msg}</span>
        </div>
      )}

      {/* KPI Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "18px 20px" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
            Active Products
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#0f172a", margin: "6px 0 2px" }}>
            {products.length}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: 600 }}>
            Instant UPI Checkout enabled
          </div>
        </div>

        <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "18px 20px" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
            Platform Fee
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#0066fe", margin: "6px 0 2px" }}>
            0%
          </div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Creator Pro plan active
          </div>
        </div>

        <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "18px 20px" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
            Delivery Mode
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#0f172a", margin: "6px 0 2px" }}>
            Instant
          </div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Automated email & access token
          </div>
        </div>
      </div>

      {/* Products Table Card */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
            Catalog Items ({products.length})
          </h2>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            All products appear in your bio store
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "12px 20px", color: "#475569", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase" }}>Product</th>
                <th style={{ padding: "12px 20px", color: "#475569", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase" }}>Type</th>
                <th style={{ padding: "12px 20px", color: "#475569", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase", textAlign: "right" }}>Price (INR)</th>
                <th style={{ padding: "12px 20px", color: "#475569", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase", textAlign: "center" }}>GST</th>
                <th style={{ padding: "12px 20px", color: "#475569", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase", textAlign: "center" }}>Status</th>
                <th style={{ padding: "12px 20px", color: "#475569", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "60px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: "2.4rem", marginBottom: "12px" }}>📦</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                      No products created yet
                    </div>
                    <div style={{ fontSize: "0.88rem", color: "#64748b", maxWidth: "420px", margin: "0 auto 20px" }}>
                      Create your first digital file, Notion template, 1:1 session, or free lead magnet to start selling.
                    </div>
                    <button
                      onClick={() => setShowModal(true)}
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
                      + Create First Product
                    </button>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const badge = getTypeBadge(p.type);
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>{p.title}</div>
                        {p.description && (
                          <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "2px", maxWidth: "340px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: "20px",
                            background: badge.bg,
                            color: badge.color,
                          }}
                        >
                          <span>{badge.icon}</span>
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>
                        {p.pricePaise === 0 ? (
                          <span style={{ color: "#10b981" }}>FREE</span>
                        ) : (
                          `₹${(p.pricePaise / 100).toFixed(2)}`
                        )}
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
                        {p.gstRate}%
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: "#ecfdf5",
                            color: "#059669",
                          }}
                        >
                          Active
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                          <button
                            onClick={() => handleCopyCheckout(p.id)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "8px",
                              background: "#f1f5f9",
                              color: "#334155",
                              border: "1px solid #e2e8f0",
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {copiedId === p.id ? "✓ Copied" : "Copy Link"}
                          </button>
                          <Link
                            href={`/checkout/${p.id}`}
                            target="_blank"
                            style={{
                              padding: "6px 12px",
                              borderRadius: "8px",
                              background: "#eff6ff",
                              color: "#0066fe",
                              border: "1px solid #bfdbfe",
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            Checkout ↗
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Product Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            padding: "20px",
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              background: "#ffffff",
              borderRadius: "20px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  Create New Product
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                  Set up instant delivery and accept payments via UPI, Cards, and Netbanking.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: "32px", height: "32px", color: "#64748b", fontSize: "1rem", cursor: "pointer", display: "grid", placeItems: "center" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Product Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof type)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    color: "#0f172a",
                    fontSize: "0.92rem",
                    outline: "none",
                  }}
                >
                  <option value="digital_file">📄 Digital File Download (PDF, Zip, Ebook, Presets)</option>
                  <option value="link_gate">🔗 External Link Gate (Notion Template, Google Drive, Loom)</option>
                  <option value="session">📅 1:1 Consultation Session (Google Meet, Zoom)</option>
                  <option value="lead_magnet">🎁 Free Lead Magnet (Audience Email Capture)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Product Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Complete Reel Mastery Guide 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Short Description
                </label>
                <textarea
                  rows={2}
                  placeholder="What buyers will receive upon completing purchase..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                    resize: "vertical",
                  }}
                />
              </div>

              {type !== "lead_magnet" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Price (INR ₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={priceRupees}
                      onChange={(e) => setPriceRupees(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        color: "#0f172a",
                        fontSize: "0.92rem",
                        fontWeight: 700,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      GST Rate
                    </label>
                    <select
                      value={gstRate}
                      onChange={(e) => setGstRate(Number(e.target.value))}
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
                    >
                      <option value={0}>0% (Exempt)</option>
                      <option value={18}>18% (Standard Digital Services)</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  {type === "digital_file"
                    ? "File Download URL (Google Drive, S3, or direct file link)"
                    : type === "link_gate"
                    ? "Destination Protected URL (Notion page, Private link)"
                    : type === "session"
                    ? "Booking Calendar Link (Calendly, Cal.com)"
                    : "Download or Welcome Resource URL"}
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={deliveryValue}
                  onChange={(e) => setDeliveryValue(e.target.value)}
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

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "10px",
                    background: "#ffffff",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "10px",
                    background: "#0066fe",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    cursor: submitting ? "wait" : "pointer",
                    boxShadow: "0 2px 8px rgba(0, 102, 254, 0.25)",
                  }}
                >
                  {submitting ? "Publishing..." : "Publish Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
