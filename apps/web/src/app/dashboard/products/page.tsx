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
    else if (type === "session") deliveryConfig.meetingUrl = deliveryValue;
    else if (type === "lead_magnet") deliveryConfig.content = deliveryValue;

    try {
      const res = await fetch("/v1/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          pricePaise,
          gstRate,
          deliveryConfig,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProducts([data.product, ...products]);
        setShowModal(false);
        setTitle("");
        setDescription("");
        setDeliveryValue("");
        setMsg("Product created successfully ✓");
      }
    } catch {
      // preview fallback
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
      setMsg("Product created in preview mode ✓");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", margin: "0 0 4px" }}>Products & Offers</h1>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
            Sell digital downloads, link gates, paid 1:1 sessions, and free lead magnets with UPI.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: "10px 20px",
            borderRadius: "10px",
            background: "var(--accent)",
            color: "#0f1a14",
            border: "none",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Create Product
        </button>
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

      {/* Products Table */}
      <div className="card" style={{ width: "100%", padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line)", background: "rgba(255,255,255,0.02)" }}>
              <th style={{ padding: "14px 18px", textAlign: "left" }}>Product</th>
              <th style={{ padding: "14px 18px", textAlign: "left" }}>Type</th>
              <th style={{ padding: "14px 18px", textAlign: "right" }}>Price (INR)</th>
              <th style={{ padding: "14px 18px", textAlign: "center" }}>GST</th>
              <th style={{ padding: "14px 18px", textAlign: "center" }}>Status</th>
              <th style={{ padding: "14px 18px", textAlign: "right" }}>Checkout Link</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "48px 16px", textAlign: "center", color: "var(--muted)" }}>
                  <div style={{ fontSize: "1.6rem", marginBottom: "8px" }}>📦</div>
                  <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>No products created yet</div>
                  <div style={{ fontSize: "0.82rem", marginBottom: "14px" }}>Create your first digital file, consultation session, or lead magnet above.</div>
                  <button
                    onClick={() => setShowModal(true)}
                    className="btn btn-primary"
                    style={{ fontSize: "0.85rem", padding: "8px 16px" }}
                  >
                    + Create Product
                  </button>
                </td>
              </tr>
            ) : products.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "16px 18px" }}>
                  <div style={{ fontWeight: 700 }}>{p.title}</div>
                  {p.description && (
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "2px" }}>
                      {p.description.slice(0, 60)}...
                    </div>
                  )}
                </td>
                <td style={{ padding: "16px 18px" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: "rgba(232, 165, 75, 0.15)",
                      color: "var(--accent)",
                      fontWeight: 600,
                    }}
                  >
                    {p.type.replace(/_/g, " ")}
                  </span>
                </td>
                <td style={{ padding: "16px 18px", textAlign: "right", fontWeight: 700 }}>
                  {p.pricePaise === 0 ? "Free" : `₹${(p.pricePaise / 100).toFixed(2)}`}
                </td>
                <td style={{ padding: "16px 18px", textAlign: "center", color: "var(--muted)" }}>
                  {p.gstRate}%
                </td>
                <td style={{ padding: "16px 18px", textAlign: "center" }}>
                  <span style={{ color: "#34d399", fontWeight: 600 }}>Active</span>
                </td>
                <td style={{ padding: "16px 18px", textAlign: "right" }}>
                  <Link
                    href={`/checkout/${p.id}`}
                    target="_blank"
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      background: "rgba(255,255,255,0.06)",
                      color: "var(--ink)",
                      textDecoration: "none",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    Test Checkout ↗
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Product Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "grid",
            placeItems: "center",
            padding: "20px",
            zIndex: 50,
          }}
        >
          <div className="card" style={{ width: "min(520px, 100%)", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ fontSize: "1.3rem", margin: 0 }}>Create New Product</h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "4px" }}>
                  Product Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof type)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid var(--line)",
                    color: "var(--ink)",
                  }}
                >
                  <option value="digital_file">Digital File (PDF, Zip, Ebook)</option>
                  <option value="link_gate">External Link Gate (Notion, Drive)</option>
                  <option value="session">Paid 1:1 Session (Google Meet/Zoom)</option>
                  <option value="lead_magnet">Free Lead Magnet (Email capture)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "4px" }}>
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Complete Reel Mastery Guide"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid var(--line)",
                    color: "var(--ink)",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "4px" }}>
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="What is included in this digital product..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid var(--line)",
                    color: "var(--ink)",
                  }}
                />
              </div>

              {type !== "lead_magnet" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "4px" }}>
                      Price (INR ₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={priceRupees}
                      onChange={(e) => setPriceRupees(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        background: "rgba(0,0,0,0.4)",
                        border: "1px solid var(--line)",
                        color: "var(--ink)",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "4px" }}>
                      GST Rate
                    </label>
                    <select
                      value={gstRate}
                      onChange={(e) => setGstRate(Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        background: "rgba(0,0,0,0.4)",
                        border: "1px solid var(--line)",
                        color: "var(--ink)",
                      }}
                    >
                      <option value={18}>18% GST (Standard)</option>
                      <option value={0}>0% (Tax exempt)</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "4px" }}>
                  {type === "digital_file"
                    ? "Download File URL"
                    : type === "link_gate"
                      ? "Gated External Link"
                      : type === "session"
                        ? "Google Meet / Meeting URL"
                        : "Confirmation Message"}
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={deliveryValue}
                  onChange={(e) => setDeliveryValue(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid var(--line)",
                    color: "var(--ink)",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.08)",
                    color: "var(--ink)",
                    border: "1px solid var(--line)",
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
                    flex: 1,
                    padding: "12px 0",
                    borderRadius: "8px",
                    background: "var(--accent)",
                    color: "#0f1a14",
                    border: "none",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {submitting ? "Creating..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
