/**
 * Base URL of the merchant server (`server/index.js`).
 *
 * The browser and the server run on the same machine in this demo, so this is
 * localhost. Point it at your own host when deploying; the server must allow
 * that origin via CORS_ORIGIN. Empty, the calls go to this site's own /api —
 * which is how netlify.toml deploys it, with the server as a function.
 */
export const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:5300';
