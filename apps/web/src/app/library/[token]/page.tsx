"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface BumpOfferUnlocked {
  title: string;
  description?: string;
  fileUrl?: string;
  notionUrl?: string;
}

interface EntitlementData {
  entitlement: {
    id: string;
    downloadCount: number;
    maxDownloads: number;
    expiresAt: string | null;
  };
  product: {
    id: string;
    title: string;
    type: string;
    description: string;
  } | null;
  creator: {
    displayName: string;
    slug: string;
  } | null;
  delivery: {
    type?: string;
    fileUrl?: string | null;
    gatedLink?: string | null;
    sessionDetails?: {
      meetingUrl: string;
      durationMinutes: number;
      bookingDate?: string;
      timeSlot?: string;
      calendarEventUrl?: string | null;
      status?: string;
      slots?: string[];
    } | null;
    leadMagnetContent?: string | null;
    telegramAccess?: {
      channelName: string;
      inviteLink: string;
      singleUse: boolean;
      status: string;
      expiresAt: string | null;
    } | null;
  };
  bumpOffer?: BumpOfferUnlocked | null;
  order: {
    receipt: string;
    amountFormatted: string;
    createdAt: string;
  } | null;
}

export default function BuyerLibraryPage({
  params,
}: {
  params?: Promise<{ token: string }>;
}) {
  const routeParams = useParams();
  const rawToken = routeParams?.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : (rawToken as string) || "preview_token_123";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EntitlementData | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadCount, setDownloadCount] = useState(0);
  const [copiedTg, setCopiedTg] = useState(false);

  useEffect(() => {
    async function loadLibrary() {
      try {
        const res = await fetch(`/v1/library/${token}`);
        if (!res.ok) throw new Error("Entitlement not found");
        const json = await res.json();
        setData(json);
        setDownloadCount(json.entitlement.downloadCount);
      } catch (err) {
        // Fallback demo entitlement for preview
        const isTelegram = token.toLowerCase().includes("telegram");
        const isSession =
          token.toLowerCase().includes("session") ||
          token.toLowerCase().includes("consultation") ||
          token.toLowerCase().includes("booking");

        if (isSession) {
          const bookingDate = new Date(Date.now() + 86400 * 1000).toISOString().slice(0, 10);
          const timeSlot = "02:00 PM - 02:45 PM";
          const meetingUrl = "https://meet.google.com/hpr-call-789";
          const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=1%3A1+Creator+Growth+Strategy+Call&details=Google+Meet+Consultation%3A+${encodeURIComponent(meetingUrl)}&location=${encodeURIComponent(meetingUrl)}`;

          setData({
            entitlement: {
              id: "ent_session_vip",
              downloadCount: 1,
              maxDownloads: 10,
              expiresAt: null,
            },
            product: {
              id: "p_session_vip",
              title: "1:1 Creator Growth & Viral Content Strategy Call",
              type: "session",
              description:
                "Private 45-minute 1:1 strategy consultation via Google Meet with recording and custom action plan.",
            },
            creator: {
              displayName: "Hyperprofile Mentor",
              slug: "creator",
            },
            delivery: {
              type: "session",
              sessionDetails: {
                meetingUrl,
                durationMinutes: 45,
                bookingDate,
                timeSlot,
                calendarEventUrl: gcalUrl,
                status: "confirmed",
                slots: [
                  "10:00 AM - 10:45 AM",
                  "02:00 PM - 02:45 PM",
                  "04:30 PM - 05:15 PM",
                  "06:00 PM - 06:45 PM",
                ],
              },
            },
            order: {
              receipt: "rcpt_session_441",
              amountFormatted: "₹2,358.82",
              createdAt: new Date().toISOString(),
            },
            bumpOffer: {
              title: "WhatsApp 7-Day Priority Follow-Up & Voice Q&A Support",
              description:
                "Direct WhatsApp DM & voice note access to ask clarifying questions for 7 days post-call.",
              notionUrl: "https://chat.whatsapp.com/preview_mentor_vip",
            },
          });
          setDownloadCount(1);
          return;
        }

        setData({
          entitlement: {
            id: isTelegram ? "ent_tg_vip" : "ent_demo",
            downloadCount: 1,
            maxDownloads: 10,
            expiresAt: null,
          },
          product: {
            id: isTelegram ? "prod_telegram_vip" : "prod_demo",
            title: isTelegram
              ? "VIP Creator Alpha & Trading Signals Community"
              : "Complete Creator Monetization Guide (PDF)",
            type: isTelegram ? "telegram_community" : "digital_file",
            description: isTelegram
              ? "Exclusive private Telegram community with daily alpha, trade alerts, and networking."
              : "Instant download of your creator monetization blueprint.",
          },
          creator: {
            displayName: isTelegram ? "Hyperprofile Alpha" : "Hyperprofile Coach",
            slug: "creator",
          },
          delivery: {
            type: isTelegram ? "telegram_community" : "digital_file",
            fileUrl: isTelegram ? null : "https://hyperprofile.local/files/monetization-guide.pdf",
            telegramAccess: isTelegram
              ? {
                  channelName: "VIP Creator Alpha & Trading Signals Community",
                  inviteLink: `https://t.me/+hyper_vip_${token.slice(-6)}`,
                  singleUse: true,
                  status: "active",
                  expiresAt: new Date(Date.now() + 86400 * 30 * 1000).toISOString(),
                }
              : null,
          },
          order: {
            receipt: "rcpt_demo_123",
            amountFormatted: isTelegram ? "₹999.00" : "₹698.00",
            createdAt: new Date().toISOString(),
          },
          bumpOffer: {
            title: "Viral Reel Hooks & 30-Day Content Matrix (Notion + PDF)",
            description:
              "50+ plug-and-play hook templates and viral frameworks used by top creators to generate 10M+ views. Instant Notion duplicate & PDF download.",
            fileUrl: `/v1/library/${token}/download?file=Viral-Reel-Hooks-Content-Matrix.pdf`,
            notionUrl: "https://notion.so/templates/viral-reel-hooks-30-day-matrix",
          },
        });
        setDownloadCount(1);
      } finally {
        setLoading(false);
      }
    }
    loadLibrary();
  }, [token]);

  async function handleDownload() {
    setDownloading(true);
    try {
      await fetch(`/v1/library/${token}/download`, { method: "POST" });
      setDownloadCount((prev) => prev + 1);
      // Trigger download
      window.open(data?.delivery.fileUrl ?? "#", "_blank");
    } catch {
      // Fallback open
      window.open("#", "_blank");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <div style={{ color: "var(--muted)" }}>Loading your digital library...</div>
      </main>
    );
  }

  if (!data || !data.product) {
    return (
      <main className="shell">
        <div className="card" style={{ textAlign: "center" }}>
          <h2>Access Expired or Invalid</h2>
          <p>This digital entitlement could not be found or has expired.</p>
          <Link href="/" className="cta">Return Home</Link>
        </div>
      </main>
    );
  }

  const { product, creator, delivery, order } = data;

  return (
    <main className="shell">
      <div className="card" style={{ width: "min(520px, 100%)", padding: "32px 28px" }}>
        {/* Success Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "rgba(52, 211, 153, 0.15)",
              color: "#34d399",
              display: "grid",
              placeItems: "center",
              fontSize: "28px",
              margin: "0 auto 12px",
            }}
          >
            ✓
          </div>
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "#34d399",
              letterSpacing: "0.05em",
            }}
          >
            Order Confirmed & Access Unlocked
          </span>
          <h1 style={{ fontSize: "1.4rem", margin: "6px 0 8px" }}>{product.title}</h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>
            By <strong>{creator?.displayName}</strong>
          </p>
        </div>

        {/* Delivery Content Box */}
        <div
          style={{
            padding: "20px",
            borderRadius: "14px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--line)",
            marginBottom: "24px",
          }}
        >
          {/* Digital File Delivery */}
          {product.type === "digital_file" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
                Your signed download link is active. You have used{" "}
                <strong>{downloadCount}</strong> of <strong>{data.entitlement.maxDownloads}</strong> downloads.
              </div>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: "12px",
                  background: "var(--accent)",
                  color: "#0f1a14",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "1rem",
                  cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(232, 165, 75, 0.35)",
                }}
              >
                {downloading ? "Preparing File..." : "⬇ Download Digital File (PDF/Zip)"}
              </button>
            </div>
          )}

          {/* Link Gate Delivery */}
          {product.type === "link_gate" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>
                Your exclusive access link is unlocked below:
              </p>
              <a
                href={delivery.gatedLink ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: "12px",
                  background: "var(--accent)",
                  color: "#0f1a14",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: "1rem",
                }}
              >
                🚀 Access Private Resource →
              </a>
            </div>
          )}

          {/* 1:1 Session Delivery (SuperProfile Phase 5) */}
          {product.type === "session" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  padding: "20px 18px",
                  borderRadius: "14px",
                  background:
                    "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      background: "#10b981",
                      color: "#06281e",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      padding: "4px 10px",
                      borderRadius: "6px",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    📅 1:1 CONSULTATION CONFIRMED
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.78rem",
                      color: "#34d399",
                      fontWeight: 700,
                    }}
                  >
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
                    Active Booking
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--ink)", lineHeight: 1.25 }}>
                    {delivery.sessionDetails?.bookingDate
                      ? new Date(delivery.sessionDetails.bookingDate).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Scheduled Session"}
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, color: "#10b981", marginTop: "4px" }}>
                    ⏰ {delivery.sessionDetails?.timeSlot ?? "02:00 PM - 02:45 PM"} (IST)
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    background: "rgba(0,0,0,0.25)",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    fontSize: "0.82rem",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--muted)", display: "block" }}>Host</span>
                    <strong style={{ color: "var(--ink)" }}>{creator?.displayName ?? "Mentor"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)", display: "block" }}>Duration & Format</span>
                    <strong style={{ color: "var(--ink)" }}>
                      {delivery.sessionDetails?.durationMinutes ?? 45} Min · Google Meet
                    </strong>
                  </div>
                </div>

                {/* Primary CTA: Google Meet Video Link */}
                <a
                  href={delivery.sessionDetails?.meetingUrl ?? "https://meet.google.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "14px 0",
                    textAlign: "center",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#052017",
                    textDecoration: "none",
                    fontWeight: 800,
                    fontSize: "1.02rem",
                    boxShadow: "0 6px 20px rgba(16, 185, 129, 0.35)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  🎥 Join Google Meet Video Call →
                </a>

                {/* Secondary CTA: Add to Calendar */}
                {delivery.sessionDetails?.calendarEventUrl && (
                  <a
                    href={delivery.sessionDetails.calendarEventUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "11px 0",
                      textAlign: "center",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "var(--ink)",
                      textDecoration: "none",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                    }}
                  >
                    📅 Add to Google Calendar (.ics sync)
                  </a>
                )}
              </div>

              {/* Consultation Call Protocol Box */}
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--line)",
                  borderRadius: "12px",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  fontSize: "0.82rem",
                  color: "var(--muted)",
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--ink)" }}>📋 Session Guidelines</div>
                <div>• Please join 5 minutes early to test your camera and microphone.</div>
                <div>• The meeting link will admit you automatically at the scheduled time.</div>
                <div>• Full session recording and personalized action notes will be archived here.</div>
              </div>
            </div>
          )}

          {/* Lead Magnet Delivery */}
          {product.type === "lead_magnet" && (
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 12px", fontSize: "0.95rem" }}>
                {delivery.leadMagnetContent}
              </p>
              <button
                type="button"
                onClick={handleDownload}
                style={{
                  padding: "12px 24px",
                  borderRadius: "10px",
                  background: "var(--accent)",
                  color: "#0f1a14",
                  border: "none",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Download Resource
              </button>
            </div>
          )}

          {/* Telegram Community Delivery (SuperProfile Phase 4) */}
          {product.type === "telegram_community" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "center" }}>
              <div
                style={{
                  padding: "18px 16px",
                  borderRadius: "12px",
                  background:
                    "linear-gradient(135deg, rgba(42, 171, 238, 0.15) 0%, rgba(34, 158, 217, 0.05) 100%)",
                  border: "1px solid rgba(42, 171, 238, 0.4)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      background: "#2AABEE",
                      color: "#fff",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: "6px",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    ✈ VIP Telegram Community
                  </span>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "#34d399",
                    }}
                  >
                    ● {delivery.telegramAccess?.status === "active" ? "Active Member" : "Access Granted"}
                  </span>
                </div>

                <h3 style={{ fontSize: "1.15rem", margin: "4px 0 2px" }}>
                  {delivery.telegramAccess?.channelName || product.title}
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)", maxWidth: "420px" }}>
                  Your secure 1-tap single-use invite link has been generated. Tap below to join the private community immediately.
                </p>

                {/* Single-use invite button */}
                <a
                  href={delivery.telegramAccess?.inviteLink || "https://t.me"}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "14px 0",
                    marginTop: "6px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)",
                    color: "#fff",
                    textDecoration: "none",
                    fontWeight: 800,
                    fontSize: "1rem",
                    boxShadow: "0 6px 20px rgba(42, 171, 238, 0.4)",
                  }}
                >
                  <span>✈</span>
                  <span>Open Telegram &amp; Join Community →</span>
                </a>

                {/* Invite link copy box */}
                <div
                  style={{
                    width: "100%",
                    marginTop: "6px",
                    background: "rgba(0,0,0,0.3)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.78rem",
                    color: "var(--muted)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {delivery.telegramAccess?.inviteLink || "https://t.me/+hyper_vip_join"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (delivery.telegramAccess?.inviteLink) {
                        navigator.clipboard.writeText(delivery.telegramAccess.inviteLink);
                        setCopiedTg(true);
                        setTimeout(() => setCopiedTg(false), 2000);
                      }
                    }}
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      border: "none",
                      color: "var(--ink)",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      marginLeft: "8px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {copiedTg ? "Copied ✓" : "Copy Link"}
                  </button>
                </div>

                <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "2px" }}>
                  🔒 Anti-Leak Protected · Single-use link expires automatically after joining.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bump Offer Unlocked Asset Card */}
        {data.bumpOffer && (
          <div
            style={{
              padding: "20px",
              borderRadius: "14px",
              background: "rgba(232, 165, 75, 0.08)",
              border: "1px solid rgba(232, 165, 75, 0.4)",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <span
                style={{
                  background: "#e8a54b",
                  color: "#0f1a14",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Order Bump Unlocked
              </span>
              <span style={{ fontSize: "0.85rem", color: "#34d399", fontWeight: 700 }}>
                ✓ Access Granted
              </span>
            </div>
            <h3 style={{ fontSize: "1.05rem", margin: "4px 0 6px" }}>{data.bumpOffer.title}</h3>
            <p style={{ margin: "0 0 14px", fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.4 }}>
              {data.bumpOffer.description ??
                "Exclusive access templates and framework package included with your purchase."}
            </p>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <a
                href={
                  data.bumpOffer.fileUrl ??
                  `/v1/library/${token}/download?file=Viral-Reel-Hooks-Content-Matrix.pdf`
                }
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  minWidth: "160px",
                  padding: "10px 16px",
                  textAlign: "center",
                  borderRadius: "10px",
                  background: "var(--accent)",
                  color: "#0f1a14",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  textDecoration: "none",
                }}
              >
                ⬇ Download Matrix (PDF)
              </a>
              {data.bumpOffer.notionUrl && (
                <a
                  href={data.bumpOffer.notionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    minWidth: "160px",
                    padding: "10px 16px",
                    textAlign: "center",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.08)",
                    color: "var(--ink)",
                    border: "1px solid var(--line)",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    textDecoration: "none",
                  }}
                >
                  ↗ Open in Notion
                </a>
              )}
            </div>
          </div>
        )}

        {/* Order Receipt Details */}
        {order && (
          <div
            style={{
              fontSize: "0.85rem",
              color: "var(--muted)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              borderTop: "1px solid var(--line)",
              paddingTop: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Receipt Number:</span>
              <span style={{ color: "var(--ink)" }}>{order.receipt}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Amount Paid:</span>
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                {order.amountFormatted}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Date:</span>
              <span>{new Date(order.createdAt).toLocaleDateString("en-IN")}</span>
            </div>
          </div>
        )}

        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <Link
            href={creator?.slug ? `/${creator.slug}` : "/"}
            style={{ fontSize: "0.85rem", color: "var(--muted)", textDecoration: "none" }}
          >
            ← Back to Creator Store
          </Link>
        </div>
      </div>
    </main>
  );
}
