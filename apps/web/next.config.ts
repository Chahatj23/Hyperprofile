import type { NextConfig } from "next";

const apiOrigin = process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
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
