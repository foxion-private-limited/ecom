import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "mongodb-memory-server", "bcryptjs"],
};

export default nextConfig;
