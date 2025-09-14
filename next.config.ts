import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // 👈 disables ESLint checks on Vercel
  },
};

export default nextConfig;
