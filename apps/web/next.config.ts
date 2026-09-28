import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
  },
  async rewrites() {
    return [
      {
        source: "/webhooks/:path*",
        destination: "/api/webhooks/:path*",
      },
      {
        source: "/webhook/:path*",
        destination: "/api/webhooks/:path*",
      },
    ];
  },
};

export default nextConfig;
