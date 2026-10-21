import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable streaming metadata to avoid MetadataWrapper hydration mismatches in Next 16.
  htmlLimitedBots: /.*/,
};

// Next 16 production builds use Turbopack, so `@next/bundle-analyzer` (webpack)
// is not wired. `ANALYZE=true npm run build && npm run analyze` lists chunk sizes.
if (process.env.ANALYZE === "true") {
  console.info(
    "[analyze] Turbopack build: run `npm run analyze` after this command to list chunk sizes.",
  );
}

export default nextConfig;
