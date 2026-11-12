import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Block {
  id: string;
  type: "link" | "social" | "product" | "lead_form" | "embed" | "text" | "divider";
  title?: string;
  subtitle?: string;
  url?: string;
  productId?: string;
  content?: string;
  icon?: string;
  order: number;
}

interface IgPost {
  id: string;
  caption: string | null;
  mediaType: string | null;
  mediaProductType?: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  likeCount?: number | null;
  commentsCount?: number | null;
  timestamp?: string | null;
}

interface PageData {
  creator: {
    id: string;
    slug: string;
    displayName: string;
    bio: string | null;
    theme: {
      accentColor?: string;
      darkMode?: boolean;
      buttonStyle?: "rounded" | "pill" | "sharp";
    };
    plan: string;
  };
  page: {
    title?: string;
    bio?: string;
    theme?: {
      accentColor?: string;
      darkMode?: boolean;
      buttonStyle?: "rounded" | "pill" | "sharp";
    };
    blocks: Block[];
  };
  products: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    pricePaise: number;
    currency: string;
    gstRate: number;
  }>;
  instagram?: {
    username: string;
    igUserId: string;
  } | null;
  posts?: IgPost[];
}

async function getPageData(slug: string): Promise<PageData | null> {
  const apiOrigin = process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${apiOrigin}/v1/public/pages/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as PageData;
  } catch {
    // Fallback sample data for offline / preview
    const isJinbandhan = slug.toLowerCase() === "jinbandhan";
    return {
      creator: {
        id: isJinbandhan ? "efe13582-a855-441a-a9ce-eac814b4e06b" : "sample_id",
        slug,
        displayName: isJinbandhan ? "Jinbandhan" : slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        bio: isJinbandhan
          ? "Verified Jain Matrimony & Community Profiles"
          : "Indian Creator & Coach · Hindi / English Courses · 1:1 Sessions",
        theme: { accentColor: "#e8a54b", darkMode: true, buttonStyle: "rounded" },
        plan: "creator",
      },
      page: {
        title: isJinbandhan ? "Jinbandhan" : slug.replace(/-/g, " "),
        bio: isJinbandhan ? "Verified Jain Matrimony & Community Profiles" : "Creator Commerce · UPI First",
        blocks: [
          {
            id: "b_1",
            type: "text",
            title: isJinbandhan ? "नमस्ते! Welcome to Jinbandhan" : "नमस्ते! Welcome to my store",
            content: isJinbandhan
              ? "Discover verified Jain matrimonial profiles with shared cultural and dietary values."
              : "Exclusive digital resources, coaching sessions, and guides.",
            order: 0,
          },
          {
            id: "b_2",
            type: "link",
            title: "Join Community on Telegram (Free)",
            url: "https://t.me",
            order: 1,
          },
        ],
      },
      instagram: isJinbandhan
        ? {
            username: "jinbandhan",
            igUserId: "17841453478293915",
          }
        : null,
      posts: isJinbandhan
        ? [
            {
              id: "18115631537116911",
              caption:
                "Jai Jinendra 🙏\n\nJab baat jeevan saathi chunne ki aati hai, tab sanskaar aur values sabse pehle aate hain. Jinbandhan par aapko milte hain verified Jain profiles, jahan aap community, lifestyle, aur satvik food habits ke according partner choose kar sakte hain.\n\nChahe aap Bharat mein ho ya abroad, aapka perfect match dhoondhna ab hua aasan aur surakshit. Aaj hi judiye aur shuru kijiye ek naya safar.",
              mediaType: "IMAGE",
              mediaProductType: "FEED",
              mediaUrl:
                "https://scontent.cdninstagram.com/v/t51.82787-15/902591685_18018037013782610_3825906834077676673_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiRkVFRC5iZXN0X2ltYWdlX3VybGdlbi5DMyJ9&_nc_ohc=YWyMBzNr_-kQ7kNvwHbRL2s&_nc_oc=Adr02nhgiZ33xVLZr5RKSSrfdLq-gd6mSqsRSnIOEaRbu6l_id-9_NSfcyM_krHHypQ&_nc_zt=23&_nc_ht=scontent.cdninstagram.com&edm=AFF3FJ0EAAAA&_nc_gid=4XRv3cmDVo0gDV8OGIMZeA&_nc_ct=RQosPBUKFQIAAAA&oh=00_AQT1oeYgSJ8qmt0WGOr3KthAUwLyS5L9Og7Zxx7xaRZK-A&oe=6AFBF554",
              thumbnailUrl: null,
              permalink: "https://www.instagram.com/p/Dfkh9m4saaK/",
              timestamp: "2026-11-10T18:18:07+0000",
              likeCount: 0,
              commentsCount: 10,
            },
          ]
        : [],
      products: [
        {
          id: "prod_sample_1",
          type: "digital_file",
          title: "Complete Creator Monetization Guide (PDF)",
          description: "Everything you need to launch digital products and scale UPI sales in India.",
          pricePaise: 49900,
          currency: "INR",
          gstRate: 18,
        },
        {
          id: "prod_sample_2",
          type: "session",
          title: "1:1 Strategy Coaching (45 Mins)",
          description: "Direct video session to optimize your Instagram funnel and revenue.",
          pricePaise: 199900,
          currency: "INR",
          gstRate: 18,
        },
        {
          id: "prod_sample_3",
          type: "lead_magnet",
          title: "Free Checklist: 10 Instagram Hooks That Convert",
          description: "Instant download checklist for viral Reels and comment triggers.",
          pricePaise: 0,
          currency: "INR",
          gstRate: 0,
        },
      ],
    };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPageData(slug);
  const title = data ? `${data.creator.displayName} | Hyperprofile` : "Creator Page";
  const description = data?.creator.bio ?? "Creator commerce link-in-bio";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      locale: "en_IN",
    },
  };
}

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPageData(slug);
  if (!data) notFound();

  const { creator, page, products: productList, instagram, posts } = data;
  const accent = page.theme?.accentColor ?? creator.theme?.accentColor ?? "#e8a54b";
  const isDark = page.theme?.darkMode ?? creator.theme?.darkMode ?? true;
  const buttonStyle = page.theme?.buttonStyle ?? "rounded";
  const btnRadius = buttonStyle === "pill" ? "9999px" : buttonStyle === "sharp" ? "4px" : "12px";

  const blocks = page.blocks.sort((a, b) => a.order - b.order);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: isDark
          ? "radial-gradient(1000px 500px at 50% 0%, rgba(232, 165, 75, 0.12), transparent 50%), #0d1611"
          : "#faf8f5",
        color: isDark ? "#f4efe6" : "#1a2e24",
        padding: "32px 16px 64px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "460px" }}>
        {/* Creator Header */}
        <header style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              width: "88px",
              height: "88px",
              borderRadius: "50%",
              margin: "0 auto 14px",
              background: `linear-gradient(135deg, ${accent}, #1a2e24)`,
              display: "grid",
              placeItems: "center",
              fontSize: "2rem",
              fontWeight: 700,
              color: "#fff",
              border: `3px solid ${accent}`,
              boxShadow: `0 8px 24px rgba(0,0,0,0.3)`,
            }}
          >
            {creator.displayName.charAt(0)}
          </div>
          <h1
            style={{
              margin: "0 0 6px",
              fontSize: "1.6rem",
              fontFamily: "var(--font-display, serif)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            {creator.displayName}
            <span
              title="Verified Creator"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: accent,
                color: "#0f1a14",
                fontSize: "12px",
                fontWeight: "bold",
              }}
            >
              ✓
            </span>
          </h1>
          {creator.bio && (
            <p
              style={{
                margin: "0 0 12px",
                fontSize: "0.95rem",
                color: isDark ? "rgba(244, 239, 230, 0.75)" : "#4a5d52",
                lineHeight: 1.5,
              }}
            >
              {creator.bio}
            </p>
          )}
          <span
            style={{
              fontSize: "0.8rem",
              padding: "4px 10px",
              borderRadius: "20px",
              background: "rgba(232, 165, 75, 0.15)",
              color: accent,
              fontWeight: 600,
            }}
          >
            hyperprofile.bio/{creator.slug}
          </span>
        </header>

        {/* Content Blocks */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {blocks.map((block) => {
            if (block.type === "text") {
              return (
                <div
                  key={block.id}
                  style={{
                    padding: "16px 20px",
                    borderRadius: btnRadius,
                    background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
                    border: "1px solid rgba(244, 239, 230, 0.08)",
                    textAlign: "center",
                  }}
                >
                  {block.title && <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem" }}>{block.title}</h3>}
                  {block.content && (
                    <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.85, lineHeight: 1.4 }}>
                      {block.content}
                    </p>
                  )}
                </div>
              );
            }

            if (block.type === "link") {
              return (
                <a
                  key={block.id}
                  href={block.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    borderRadius: btnRadius,
                    background: isDark ? "rgba(255, 255, 255, 0.06)" : "#fff",
                    border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.12)" : "#e2ddd5"}`,
                    color: "inherit",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: "0.98rem",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    transition: "transform 0.15s, border-color 0.15s",
                  }}
                >
                  <span>{block.title}</span>
                  <span style={{ color: accent, fontSize: "1.1rem" }}>→</span>
                </a>
              );
            }

            if (block.type === "divider") {
              return (
                <hr
                  key={block.id}
                  style={{
                    border: "none",
                    borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#ddd"}`,
                    margin: "8px 0",
                  }}
                />
              );
            }

            return null;
          })}

          {/* Instagram Posts & Reels Feed */}
          {posts && posts.length > 0 && (
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 4px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "6px",
                      background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                      display: "grid",
                      placeItems: "center",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    📸
                  </span>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "1.15rem",
                      fontFamily: "var(--font-display, serif)",
                      fontWeight: 700,
                    }}
                  >
                    Instagram Posts &amp; Reels
                  </h2>
                </div>
                {instagram?.username && (
                  <a
                    href={`https://www.instagram.com/${instagram.username}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: "0.8rem",
                      color: accent,
                      fontWeight: 600,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    @{instagram.username} ↗
                  </a>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {posts.map((post) => {
                  const cover = post.mediaUrl || post.thumbnailUrl;
                  const isReel = post.mediaType === "VIDEO" || post.mediaProductType === "REELS";
                  return (
                    <a
                      key={post.id}
                      href={post.permalink || `https://www.instagram.com/p/${post.id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block",
                        borderRadius: btnRadius,
                        overflow: "hidden",
                        background: isDark
                          ? "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))"
                          : "#fff",
                        border: `1px solid ${isDark ? "rgba(255,255,255,0.14)" : "#e2ddd5"}`,
                        boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                        textDecoration: "none",
                        color: "inherit",
                        transition: "transform 0.2s ease, box-shadow 0.2s ease",
                      }}
                    >
                      {cover && (
                        <div style={{ position: "relative", width: "100%", height: "260px", background: "#000" }}>
                          <img
                            src={cover}
                            alt={post.caption?.slice(0, 50) || "Instagram post"}
                            referrerPolicy="no-referrer"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              top: "10px",
                              right: "10px",
                              background: "rgba(0,0,0,0.75)",
                              backdropFilter: "blur(4px)",
                              color: "#fff",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              padding: "4px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            {isReel ? "🎬 Reel" : "📸 Post"}
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              bottom: "10px",
                              left: "10px",
                              display: "flex",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={{
                                background: "rgba(0,0,0,0.75)",
                                backdropFilter: "blur(4px)",
                                color: "#fff",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: "6px",
                              }}
                            >
                              💬 {post.commentsCount ?? 0} comments
                            </span>
                            {(post.likeCount ?? 0) > 0 && (
                              <span
                                style={{
                                  background: "rgba(0,0,0,0.75)",
                                  backdropFilter: "blur(4px)",
                                  color: "#fff",
                                  fontSize: "0.72rem",
                                  fontWeight: 700,
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                }}
                              >
                                ❤️ {post.likeCount}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div style={{ padding: "16px" }}>
                        {post.caption && (
                          <p
                            style={{
                              margin: "0 0 12px",
                              fontSize: "0.88rem",
                              lineHeight: 1.5,
                              color: isDark ? "rgba(244, 239, 230, 0.9)" : "#2d3748",
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {post.caption}
                          </p>
                        )}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            color: accent,
                          }}
                        >
                          <span>Comment on Instagram for Instant DM →</span>
                          <span style={{ fontSize: "1rem" }}>↗</span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Featured Digital Products Section */}
          {productList.length > 0 && (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 4px",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: "1.15rem",
                    fontFamily: "var(--font-display, serif)",
                  }}
                >
                  Featured Store
                </h2>
                <span style={{ fontSize: "0.8rem", color: accent, fontWeight: 600 }}>
                  ⚡ Instant UPI Checkout
                </span>
              </div>

              {productList.map((prod) => {
                const isFree = prod.pricePaise === 0;
                const formattedPrice = isFree ? "Free" : `₹${(prod.pricePaise / 100).toFixed(0)}`;
                const typeLabel =
                  prod.type === "digital_file"
                    ? "Digital File"
                    : prod.type === "session"
                      ? "1:1 Session"
                      : prod.type === "lead_magnet"
                        ? "Free Resource"
                        : "Access Pass";

                return (
                  <div
                    key={prod.id}
                    style={{
                      padding: "18px 20px",
                      borderRadius: btnRadius,
                      background: isDark
                        ? "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))"
                        : "#fff",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.14)" : "#e2ddd5"}`,
                      boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: accent,
                        }}
                      >
                        {typeLabel}
                      </span>
                      <span style={{ fontSize: "1.15rem", fontWeight: 700, color: accent }}>
                        {formattedPrice}
                      </span>
                    </div>

                    <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem", lineHeight: 1.35 }}>
                      {prod.title}
                    </h3>

                    {prod.description && (
                      <p
                        style={{
                          margin: "0 0 16px",
                          fontSize: "0.85rem",
                          opacity: 0.8,
                          lineHeight: 1.45,
                        }}
                      >
                        {prod.description}
                      </p>
                    )}

                    <Link
                      href={`/checkout/${prod.id}`}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "12px 0",
                        textAlign: "center",
                        borderRadius: btnRadius,
                        background: accent,
                        color: "#0f1a14",
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        boxShadow: `0 4px 14px rgba(232, 165, 75, 0.35)`,
                      }}
                    >
                      {isFree ? "Get Free Access →" : `Buy with UPI · ${formattedPrice}`}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={{ marginTop: "48px", textAlign: "center" }}>
          <Link
            href="/"
            style={{
              fontSize: "0.85rem",
              color: isDark ? "rgba(244, 239, 230, 0.6)" : "#6a7b72",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            Powered by <strong>Hyperprofile</strong> · Made for Indian Creators
          </Link>
          <div style={{ marginTop: "10px", fontSize: "0.75rem", opacity: 0.6 }}>
            <Link href="/privacy" style={{ marginRight: 12 }}>
              Privacy & DPDP
            </Link>
            <Link href="/report">Report Abuse</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
