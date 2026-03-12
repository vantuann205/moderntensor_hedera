import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: ['hashconnect', '@hashgraph/sdk', '@hashgraph/proto'],
  turbopack: {},
  webpack: (config) => {
    config.resolve.fallback = { 
      fs: false, 
      net: false, 
      tls: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
