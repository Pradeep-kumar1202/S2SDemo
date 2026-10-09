import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: `next build` emits plain HTML/CSS/JS into `out/`.
  // Note: `next start` doesn't serve static exports — use any static file server.
  // On only when NEXT_OUTPUT=export, as netlify.toml sets for the deploy.
  output: process.env.NEXT_OUTPUT === "export" ? "export" : undefined,
};

export default nextConfig;
