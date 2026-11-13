import type { NextConfig } from "next";

const apiOrigin = process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

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
