import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable streaming metadata to avoid MetadataWrapper hydration mismatches in Next 16.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
