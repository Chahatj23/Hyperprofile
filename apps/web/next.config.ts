import type { NextConfig } from "next";

const apiOrigin =
  process.env.API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://hyperprofile-api.onrender.com";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://*.cdninstagram.com https://*.fbcdn.net https://images.unsplash.com https://*.rzp.io",
              "font-src 'self' https://fonts.gstatic.com data:",
              "connect-src 'self' http://127.0.0.1:4000 http://localhost:4000 https://hyperprofile-api.onrender.com https://api.razorpay.com https://lumberjack.razorpay.com https://graph.facebook.com",
              "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
      { source: "/v1/:path*", destination: `${apiOrigin}/v1/:path*` },
      { source: "/webhooks/:path*", destination: `${apiOrigin}/webhooks/:path*` },
      { source: "/r/:id", destination: `${apiOrigin}/r/:id` },
      { source: "/instagram/:path*", destination: `${apiOrigin}/instagram/:path*` },
      { source: "/health", destination: `${apiOrigin}/health` },
      { source: "/healthz", destination: `${apiOrigin}/health` },
    ];
  },
};

export default nextConfig;
