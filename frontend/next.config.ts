import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel-only: API routes live inside Next.js.
  // Optional: set BACKEND_URL to proxy to a local FastAPI during development.
  async rewrites() {
    const backend = process.env.BACKEND_URL;
    if (!backend) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
