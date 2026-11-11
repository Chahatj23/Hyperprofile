"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface BumpOffer {
  enabled: boolean;
  title: string;
  description: string;
  pricePaise: number;
  originalPricePaise?: number;
  badge?: string;
}

interface ProductInfo {
  id: string;
  type: string;
  title: string;
  description: string;
  pricePaise: number;
  currency: string;
  gstRate: number;
  bumpOffer?: BumpOffer | null;
}

interface CreatorInfo {
  id: string;
  slug: string;
  displayName: string;
  theme?: { accentColor?: string };
}

function getOffsetDate(days: number): { dateStr: string; display: string; dayName: string } {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const dateStr = d.toISOString().slice(0, 10);
  const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
  const display = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { dateStr, display, dayName };
}

export default function CheckoutPage({
  params,
}: {
  params?: Promise<{ productId: string }>;
}) {
  const routeParams = useParams();
  const rawId = routeParams?.productId;
  const productId = Array.isArray(rawId) ? rawId[0] : (rawId as string) || "p_session";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [creator, setCreator] = useState<CreatorInfo | null>(null);

  // SuperProfile 1-Click Order Bump state
  const [includeBump, setIncludeBump] = useState(false);

  // SuperProfile 1:1 Consultation Slot state
  const availableDateOptions = [
    { label: "Tomorrow", ...getOffsetDate(1) },
    { label: getOffsetDate(2).dayName, ...getOffsetDate(2) },
    { label: getOffsetDate(3).dayName, ...getOffsetDate(3) },
    { label: getOffsetDate(4).dayName, ...getOffsetDate(4) },
    { label: getOffsetDate(5).dayName, ...getOffsetDate(5) },
  ];
  const [selectedDate, setSelectedDate] = useState(availableDateOptions[0]?.dateStr ?? "");
  const [selectedSlot, setSelectedSlot] = useState("02:00 PM - 02:45 PM");
  const [buyerNotes, setBuyerNotes] = useState("");

  // Form states
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [discountPaise, setDiscountPaise] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState("");

  // Payment states
  const [method, setMethod] = useState<"upi" | "card" | "netbanking">("upi");
  const [processing, setProcessing] = useState(false);
  const [orderData, setOrderData] = useState<{
    orderId: string;
    gatewayOrderId: string;
    amountPaise: number;
    bumpPricePaise?: number;
    bumpIncluded?: boolean;
    bumpTitle?: string;
    gstPaise: number;
    netAmountPaise: number;
    upiIntentUrl?: string;
    qrPayload?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`/v1/public/products/${productId}`);
        if (!res.ok) throw new Error("Product not found");
        const data = await res.json();
        setProduct(data.product);
        setCreator(data.creator);
      } catch (err) {
        // Fallback mock product for preview
        const isTg = productId.toLowerCase().includes("telegram");
        const isSession =
          productId.toLowerCase().includes("session") ||
          productId.toLowerCase().includes("consultation");

        if (isSession) {
          setProduct({
            id: productId,
            type: "session",
            title: "1:1 Creator Growth & Viral Content Strategy Call",
            description:
              "Private 45-minute 1:1 video consultation via Google Meet. Personalized audit of your funnel, reel scripts, and monetization roadmap.",
            pricePaise: 199900,
            currency: "INR",
            gstRate: 18,
            bumpOffer: {
              enabled: true,
              title: "⚡ WhatsApp 7-Day Priority Follow-Up & Voice Q&A Support",
              description:
                "Direct WhatsApp DM & voice note access to ask clarifying questions for 7 days post-call.",
              pricePaise: 49900,
              originalPricePaise: 199900,
              badge: "⚡ 75% OFF ADD-ON",
            },
          });
          setCreator({
            id: "mock_creator",
            slug: "creator",
            displayName: "Hyperprofile Mentor",
            theme: { accentColor: "#10b981" },
          });
        } else {
          setProduct({
            id: productId,
            type: isTg ? "telegram_community" : "digital_file",
            title: isTg
              ? "VIP Creator Alpha & Trading Signals Community (Private Telegram)"
              : "Complete Creator Monetization Guide (PDF)",
            description: isTg
              ? "Instant single-use invite to our private Telegram channel with daily signals and creator masterminds."
              : "Everything you need to scale digital product sales with UPI.",
            pricePaise: isTg ? 99900 : 49900,
            currency: "INR",
            gstRate: 18,
            bumpOffer: {
              enabled: true,
              title: isTg
                ? "Crypto & Creator Tax Masterclass + Notion Vault"
                : "Viral Reel Hooks & 30-Day Content Matrix (Notion + PDF)",
              description: isTg
                ? "Complete tax-saving guide and template vault for high-earning digital creators."
                : "50+ plug-and-play hook templates and viral frameworks used by top creators to generate 10M+ views. Instant Notion duplicate & PDF download.",
              pricePaise: isTg ? 29900 : 19900,
              originalPricePaise: isTg ? 149900 : 99900,
              badge: "⚡ EXCLUSIVE 80% OFF",
            },
          });
          setCreator({
            id: "mock_creator",
            slug: "creator",
            displayName: isTg ? "Hyperprofile Alpha" : "Hyperprofile Coach",
            theme: isTg ? { accentColor: "#2AABEE" } : { accentColor: "#e8a54b" },
          });
        }
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [productId]);

  const bumpOffer = product?.bumpOffer;
  const basePrice = product?.pricePaise ?? 0;
  const bumpPricePaise = includeBump && bumpOffer?.enabled ? bumpOffer.pricePaise : 0;
  const rawSubtotal = basePrice + bumpPricePaise;
  const priceAfterDiscount = Math.max(0, rawSubtotal - discountPaise);
  const gstRate = product?.gstRate ?? 18;
  const gstPaise = gstRate > 0 ? Math.round((priceAfterDiscount * gstRate) / 100) : 0;
  const totalPaise = priceAfterDiscount + gstPaise;

  const accent = creator?.theme?.accentColor ?? "#e8a54b";

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setCouponError("");
    try {
      const res = await fetch("/v1/public/offers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, code: couponCode.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setDiscountPaise(data.discountPaise);
        setCouponApplied(true);
      } else {
        setCouponError(data.message || "Invalid coupon code");
      }
    } catch {
      // Mock coupon logic for preview
      if (couponCode.toUpperCase() === "SAVE20") {
        const disc = Math.round(basePrice * 0.2);
        setDiscountPaise(disc);
        setCouponApplied(true);
      } else {
        setCouponError("Coupon code expired or invalid");
      }
    }
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid email for order delivery");
      return;
    }
    if (!consent) {
      setErrorMessage("Please accept the terms and privacy policy");
      return;
    }

    setProcessing(true);
    setErrorMessage("");

    try {
      // If free product (lead magnet)
      if (totalPaise === 0) {
        const res = await fetch("/v1/checkout/lead-capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId,
            email,
            phone,
            name,
            consentAccepted: consent,
          }),
        });
        const data = await res.json();
        if (data.success) {
          router.push(`/library/${data.entitlementToken}`);
          return;
        }
      }

      // Paid checkout order
      const res = await fetch("/v1/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          buyerEmail: email,
          buyerPhone: phone,
          buyerName: name,
          offerCode: couponApplied ? couponCode : undefined,
          includeBump,
          paymentMethod: method,
          consentAccepted: consent,
          bookingDate: product?.type === "session" ? selectedDate : undefined,
          timeSlot: product?.type === "session" ? selectedSlot : undefined,
          buyerNotes: product?.type === "session" ? buyerNotes : undefined,
        }),
      });

      if (!res.ok) {
        let msg = "Order creation failed";
        try {
          const err = await res.json();
          msg = err.message || msg;
        } catch {
          // If API server is offline, supply fallback order for client-side preview
          const mockOrderId = `ord_preview_${Date.now()}`;
          const mockGatewayId = `order_mock_${Date.now().toString().slice(-8)}`;
          setOrderData({
            orderId: mockOrderId,
            gatewayOrderId: mockGatewayId,
            amountPaise: totalPaise,
            bumpPricePaise,
            bumpIncluded: includeBump,
            bumpTitle: includeBump ? bumpOffer?.title : undefined,
            gstPaise,
            netAmountPaise: priceAfterDiscount,
            upiIntentUrl: `upi://pay?pa=creator@okhdfcbank&pn=Hyperprofile&am=${(totalPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(product?.title ?? "Order")}`,
            qrPayload: `upi://pay?pa=creator@okhdfcbank&pn=Hyperprofile&am=${(totalPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(product?.title ?? "Order")}`,
          });
          return;
        }
        throw new Error(msg);
      }

      const data = await res.json();
      setOrderData(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setProcessing(false);
    }
  }

  // Simulate or complete payment verification
  async function handleConfirmPayment() {
    if (!orderData) return;
    setProcessing(true);
    try {
      const paymentId = `pay_mock_${Date.now()}`;
      const signature = `mock_sig_${orderData.gatewayOrderId}_${paymentId}`;

      const res = await fetch("/v1/checkout/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderData.orderId,
          gatewayOrderId: orderData.gatewayOrderId,
          gatewayPaymentId: paymentId,
          signature,
          paymentMethod: method,
        }),
      });

      const fallbackToken =
        product?.type === "telegram_community"
          ? "preview_telegram_token_vip"
          : product?.type === "session"
          ? "preview_session_token_vip"
          : "preview_token_123";

      let data;
      try {
        data = await res.json();
      } catch {
        // Fallback for client-side preview when API is offline
        data = { success: true, entitlementToken: fallbackToken };
      }
      if (data.success && data.entitlementToken) {
        router.push(`/library/${data.entitlementToken}`);
      } else {
        setErrorMessage("Payment verification failed. Please try again.");
      }
    } catch {
      // Graceful fallback for offline preview
      const fallbackToken =
        product?.type === "telegram_community"
          ? "preview_telegram_token_vip"
          : product?.type === "session"
          ? "preview_session_token_vip"
          : "preview_token_123";
      router.push(`/library/${fallbackToken}`);
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <div style={{ textAlign: "center", color: "var(--muted)" }}>Loading checkout details...</div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="shell">
        <div className="card" style={{ textAlign: "center" }}>
          <h2>Product Not Found</h2>
          <p>The requested digital product is unavailable.</p>
          <Link href="/" className="cta">Return Home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="card" style={{ width: "min(480px, 100%)", padding: "28px 24px" }}>
        {/* Back Link */}
        <div style={{ marginBottom: "16px" }}>
          <Link
            href={creator?.slug ? `/${creator.slug}` : "/"}
            style={{ fontSize: "0.85rem", color: "var(--muted)", textDecoration: "none" }}
          >
            ← Back to {creator?.displayName || "store"}
          </Link>
        </div>

        {/* Order Header */}
        <div
          style={{
            borderBottom: "1px solid var(--line)",
            paddingBottom: "18px",
            marginBottom: "20px",
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              color: accent,
              letterSpacing: "0.05em",
            }}
          >
            Express Checkout
          </span>
          <h1 style={{ fontSize: "1.35rem", margin: "4px 0 8px", lineHeight: 1.3 }}>
            {product.title}
          </h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>
            By <strong>{creator?.displayName}</strong>
          </p>
        </div>

        {/* Step 1: Buyer Details Form */}
        {!orderData ? (
          <form onSubmit={handleCreateOrder} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                Email Address (Digital Delivery) *
              </label>
              <input
                type="email"
                required
                placeholder="you@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                  fontSize: "0.95rem",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid var(--line)",
                    color: "var(--ink)",
                    fontSize: "0.95rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                  WhatsApp / Phone
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid var(--line)",
                    color: "var(--ink)",
                    fontSize: "0.95rem",
                  }}
                />
              </div>
            </div>

            {/* SuperProfile 1:1 Consultation Slot Selection */}
            {product.type === "session" && (
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.05)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  borderRadius: "14px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        color: "#10b981",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>📅</span> Select Consultation Slot
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "2px" }}>
                      45-min private video call via Google Meet
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      background: "rgba(16, 185, 129, 0.2)",
                      color: "#10b981",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      fontWeight: 700,
                      letterSpacing: "0.03em",
                    }}
                  >
                    IST (GMT+5:30)
                  </span>
                </div>

                {/* Date Selector */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--muted)",
                      marginBottom: "6px",
                    }}
                  >
                    Choose Date
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(5, 1fr)",
                      gap: "6px",
                    }}
                  >
                    {availableDateOptions.map((d) => {
                      const isSelected = selectedDate === d.dateStr;
                      return (
                        <button
                          key={d.dateStr}
                          type="button"
                          onClick={() => setSelectedDate(d.dateStr)}
                          style={{
                            padding: "8px 4px",
                            borderRadius: "8px",
                            border: isSelected
                              ? "2px solid #10b981"
                              : "1px solid var(--line)",
                            background: isSelected
                              ? "rgba(16, 185, 129, 0.2)"
                              : "rgba(0,0,0,0.2)",
                            color: isSelected ? "#fff" : "var(--muted)",
                            cursor: "pointer",
                            textAlign: "center",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              color: isSelected ? "#10b981" : "var(--muted)",
                            }}
                          >
                            {d.label}
                          </div>
                          <div
                            style={{
                              fontSize: "0.8rem",
                              fontWeight: 800,
                              marginTop: "2px",
                            }}
                          >
                            {d.display}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time Slots */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--muted)",
                      marginBottom: "6px",
                    }}
                  >
                    Available Time Slots
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                    }}
                  >
                    {[
                      "10:00 AM - 10:45 AM",
                      "02:00 PM - 02:45 PM",
                      "04:30 PM - 05:15 PM",
                      "06:00 PM - 06:45 PM",
                    ].map((slot) => {
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          style={{
                            padding: "10px 8px",
                            borderRadius: "8px",
                            border: isSelected
                              ? "2px solid #10b981"
                              : "1px solid var(--line)",
                            background: isSelected
                              ? "rgba(16, 185, 129, 0.2)"
                              : "rgba(0,0,0,0.2)",
                            color: isSelected ? "#fff" : "var(--ink)",
                            fontSize: "0.82rem",
                            fontWeight: isSelected ? 700 : 500,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <span style={{ color: isSelected ? "#10b981" : "var(--muted)" }}>
                            {isSelected ? "●" : "○"}
                          </span>
                          <span>{slot}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Buyer Discussion Notes */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--muted)",
                      marginBottom: "6px",
                    }}
                  >
                    Topics / Goals For Call (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="E.g. Reviewing my Instagram reel hooks, monetize my audience, funnel audit..."
                    value={buyerNotes}
                    onChange={(e) => setBuyerNotes(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid var(--line)",
                      color: "var(--ink)",
                      fontSize: "0.85rem",
                      resize: "none",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Coupon Code Section */}
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                Discount / Coupon Code
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="e.g. SAVE20"
                  value={couponCode}
                  disabled={couponApplied}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: "10px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid var(--line)",
                    color: "var(--ink)",
                    fontSize: "0.9rem",
                    textTransform: "uppercase",
                  }}
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={couponApplied || !couponCode.trim()}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "10px",
                    background: couponApplied ? "#34d399" : accent,
                    color: "#0f1a14",
                    border: "none",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {couponApplied ? "Applied ✓" : "Apply"}
                </button>
              </div>
              {couponError && (
                <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "4px" }}>
                  {couponError}
                </div>
              )}
            </div>

            {/* SuperProfile-style 1-Click Order Bump Card */}
            {bumpOffer && bumpOffer.enabled && (
              <div
                onClick={() => setIncludeBump((prev) => !prev)}
                style={{
                  border: includeBump
                    ? "2px solid #e8a54b"
                    : "2px dashed rgba(232, 165, 75, 0.45)",
                  background: includeBump
                    ? "rgba(232, 165, 75, 0.12)"
                    : "rgba(232, 165, 75, 0.04)",
                  borderRadius: "14px",
                  padding: "16px 18px",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                  boxShadow: includeBump
                    ? "0 4px 20px rgba(232, 165, 75, 0.18)"
                    : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <span
                    style={{
                      background: "#e8a54b",
                      color: "#0f1a14",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      padding: "3px 9px",
                      borderRadius: "6px",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {bumpOffer.badge || "⚡ EXCLUSIVE 80% OFF ORDER BUMP"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: includeBump ? "#34d399" : "var(--muted)",
                    }}
                  >
                    {includeBump ? "✓ Added to Order" : "1-Click Add-on"}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <input
                    type="checkbox"
                    checked={includeBump}
                    onChange={(e) => {
                      e.stopPropagation();
                      setIncludeBump(e.target.checked);
                    }}
                    style={{
                      width: "18px",
                      height: "18px",
                      marginTop: "3px",
                      accentColor: "#e8a54b",
                      cursor: "pointer",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "0.98rem",
                        fontWeight: 700,
                        color: "var(--ink)",
                        lineHeight: 1.35,
                      }}
                    >
                      {bumpOffer.title}
                    </div>
                    <div
                      style={{
                        fontSize: "0.82rem",
                        color: "var(--muted)",
                        margin: "5px 0 8px",
                        lineHeight: 1.4,
                      }}
                    >
                      {bumpOffer.description}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {bumpOffer.originalPricePaise && (
                        <span
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--muted)",
                            textDecoration: "line-through",
                          }}
                        >
                          ₹{(bumpOffer.originalPricePaise / 100).toFixed(2)}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "1.05rem",
                          fontWeight: 800,
                          color: "#e8a54b",
                        }}
                      >
                        +₹{(bumpOffer.pricePaise / 100).toFixed(2)}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: includeBump ? "#34d399" : "var(--muted)",
                          fontWeight: 600,
                        }}
                      >
                        (Click checkbox to {includeBump ? "remove" : "add"})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Price Itemization */}
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                padding: "14px 16px",
                borderRadius: "12px",
                border: "1px solid var(--line)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                fontSize: "0.9rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Base Item</span>
                <span>₹{(basePrice / 100).toFixed(2)}</span>
              </div>

              {includeBump && bumpOffer && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "#e8a54b",
                    fontWeight: 600,
                  }}
                >
                  <span>⚡ 1-Click Order Bump: {bumpOffer.title.slice(0, 32)}...</span>
                  <span>+₹{(bumpOffer.pricePaise / 100).toFixed(2)}</span>
                </div>
              )}

              {discountPaise > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "#34d399" }}>
                  <span>Discount</span>
                  <span>-₹{(discountPaise / 100).toFixed(2)}</span>
                </div>
              )}

              {gstRate > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                  <span>GST ({gstRate}%)</span>
                  <span>+₹{(gstPaise / 100).toFixed(2)}</span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 700,
                  fontSize: "1.05rem",
                  borderTop: "1px solid var(--line)",
                  paddingTop: "8px",
                  marginTop: "4px",
                }}
              >
                <span>Total to Pay</span>
                <span style={{ color: accent }}>₹{(totalPaise / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* DPDP Consent Checkbox */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                fontSize: "0.8rem",
                color: "var(--muted)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: "2px" }}
              />
              <span>
                I agree to the Terms of Service, Privacy Policy, and consent to receiving purchase details and access links via email.
              </span>
            </label>

            {errorMessage && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#f87171",
                  fontSize: "0.85rem",
                }}
              >
                {errorMessage}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={processing}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: "12px",
                background: accent,
                color: "#0f1a14",
                border: "none",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: processing ? "not-allowed" : "pointer",
                boxShadow: `0 8px 24px rgba(232, 165, 75, 0.35)`,
              }}
            >
              {processing
                ? "Securing Order..."
                : totalPaise === 0
                  ? "Get Free Instant Access →"
                  : `Continue to UPI Payment · ₹${(totalPaise / 100).toFixed(2)}`}
            </button>
          </form>
        ) : (
          /* Step 2: UPI / Payment Execution */
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", textAlign: "center" }}>
            <div
              style={{
                padding: "18px",
                borderRadius: "14px",
                background: "rgba(232, 165, 75, 0.08)",
                border: `1px solid ${accent}`,
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: accent, fontWeight: 700 }}>
                  ORDER SUMMARY
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Order ID: {orderData.gatewayOrderId}
                </span>
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, margin: "6px 0 2px" }}>
                {product.title}
              </div>
              {orderData.bumpIncluded && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    color: "#e8a54b",
                    marginTop: "6px",
                    paddingTop: "6px",
                    borderTop: "1px dashed rgba(232, 165, 75, 0.3)",
                  }}
                >
                  <span>⚡ Add-on: {orderData.bumpTitle || bumpOffer?.title}</span>
                  <span style={{ fontWeight: 700, color: "#34d399" }}>Included ✓</span>
                </div>
              )}
              {product.type === "session" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    marginTop: "8px",
                    fontSize: "0.82rem",
                    color: "#10b981",
                    fontWeight: 600,
                  }}
                >
                  <span>📅</span>
                  <span>
                    Booked Slot: <strong>{selectedDate}</strong> at <strong>{selectedSlot}</strong> (IST)
                  </span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginTop: "12px",
                  paddingTop: "10px",
                  borderTop: "1px solid var(--line)",
                }}
              >
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Total Net Payable:</span>
                <span style={{ fontSize: "1.8rem", fontWeight: 800, color: accent }}>
                  ₹{((orderData.amountPaise || orderData.netAmountPaise) / 100).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Method Switcher */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "8px",
                background: "rgba(0,0,0,0.3)",
                padding: "4px",
                borderRadius: "10px",
              }}
            >
              {(["upi", "card", "netbanking"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  style={{
                    padding: "8px 0",
                    borderRadius: "8px",
                    border: "none",
                    background: method === m ? accent : "transparent",
                    color: method === m ? "#0f1a14" : "var(--muted)",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  {m === "upi" ? "UPI Apps" : m === "card" ? "Cards" : "NetBanking"}
                </button>
              ))}
            </div>

            {/* UPI Option */}
            {method === "upi" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Mobile 1-Tap UPI Intent */}
                {orderData.upiIntentUrl && (
                  <a
                    href={orderData.upiIntentUrl}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "14px 0",
                      borderRadius: "12px",
                      background: "#34d399",
                      color: "#064e3b",
                      textDecoration: "none",
                      fontWeight: 700,
                      fontSize: "1rem",
                      boxShadow: "0 6px 20px rgba(52, 211, 153, 0.3)",
                    }}
                  >
                    ⚡ Open UPI App (GPay / PhonePe / Paytm)
                  </a>
                )}

                {/* Desktop QR Simulator */}
                <div
                  style={{
                    padding: "20px",
                    borderRadius: "12px",
                    background: "#fff",
                    color: "#0f1a14",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#4b5563" }}>
                    SCAN UPI QR CODE TO PAY
                  </div>
                  <div
                    style={{
                      width: "180px",
                      height: "180px",
                      background: "#f3f4f6",
                      border: "2px dashed #9ca3af",
                      borderRadius: "8px",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "0.75rem",
                      textAlign: "center",
                      padding: "10px",
                    }}
                  >
                    <div>
                      <strong>[UPI QR CODE]</strong>
                      <p style={{ margin: "6px 0 0", fontSize: "0.7rem", color: "#6b7280" }}>
                        Scan with any UPI app on phone
                      </p>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                    UPI ID: merchant@hyperprofile
                  </div>
                </div>
              </div>
            )}

            {/* Card & NetBanking Simulation */}
            {method !== "upi" && (
              <div
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--line)",
                  fontSize: "0.9rem",
                  color: "var(--muted)",
                }}
              >
                {method === "card"
                  ? "Enter any test credit/debit card details in gateway overlay."
                  : "Select HDFC, SBI, ICICI, or Axis Bank to authenticate."}
              </div>
            )}

            {errorMessage && (
              <div style={{ color: "#f87171", fontSize: "0.85rem" }}>
                {errorMessage}
              </div>
            )}

            {/* Instant verification button for test mode / development */}
            <button
              type="button"
              onClick={handleConfirmPayment}
              disabled={processing}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: "12px",
                background: accent,
                color: "#0f1a14",
                border: "none",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: processing ? "not-allowed" : "pointer",
              }}
            >
              {processing ? "Verifying Payment..." : "✓ Confirm Payment & Open Library"}
            </button>
          </div>
        )}

        {/* Security Trust Badges */}
        <div
          style={{
            marginTop: "24px",
            borderTop: "1px solid var(--line)",
            paddingTop: "14px",
            display: "flex",
            justifyContent: "space-around",
            fontSize: "0.75rem",
            color: "var(--muted)",
          }}
        >
          <span>🔒 256-Bit SSL Encrypted</span>
          <span>⚡ Instant Digital Delivery</span>
          <span>🇮🇳 100% Indian UPI Ready</span>
        </div>
      </div>
    </main>
  );
}
