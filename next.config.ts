import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: `next build` emits plain HTML/CSS/JS into `out/`.
  // Note: `next start` doesn't serve static exports — use any static file server.
  output: "export",
};

export default nextConfig;
