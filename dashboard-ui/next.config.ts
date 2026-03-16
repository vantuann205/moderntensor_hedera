import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  experimental: {
    turbo: undefined,
  },
};

export default nextConfig;
