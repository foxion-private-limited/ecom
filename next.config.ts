import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "mongoose",
    "mongodb-memory-server",
    "bcryptjs",
    "playwright",
    "playwright-core",
  ],
};

export default nextConfig;
