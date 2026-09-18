/**
 * Base URL of the merchant server (`server/index.js`).
 *
 * The browser and the server run on the same machine in this demo, so this is
 * localhost. Point it at your own host when deploying; the server must allow
 * that origin via CORS_ORIGIN.
 */
export const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:5252';
