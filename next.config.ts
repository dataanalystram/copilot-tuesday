import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Allow streaming agent responses through the App Router
    serverActions: { bodySizeLimit: "5mb" },
  },
  // three.js ships ESM; Next 16 handles it but transpilePackages is safer
  transpilePackages: ["three"],
};

export default config;
