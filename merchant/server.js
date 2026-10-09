/**
 * The merchant's site, for local development: one page that frames the
 * checkout (the Next app) from another origin. See merchant/index.html.
 *
 * Usage:
 *   npm run merchant        # http://localhost:3001, framing CHECKOUT_URL
 *
 * Configure via .env (see .env.example): MERCHANT_PORT, CHECKOUT_URL.
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");

const PORT = Number(process.env.MERCHANT_PORT) || 3001;
const CHECKOUT_URL = (process.env.CHECKOUT_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);

const page = fs
  .readFileSync(path.join(__dirname, "index.html"), "utf8")
  .replaceAll("%CHECKOUT_URL%", CHECKOUT_URL);

const app = express();

app.get("/", (_req, res) => {
  res.type("html").send(page);
});

// Apple verifies the top-level domain, so its association file is served here.
app.use(
  "/.well-known",
  express.static(path.join(__dirname, "..", "public", ".well-known")),
);

app
  .listen(PORT, () => {
    console.log(
      `Merchant site on http://localhost:${PORT}, framing ${CHECKOUT_URL}`,
    );
  })
  .on("error", (err) => {
    console.log(
      err.code === "EADDRINUSE" ? `❌ Port ${PORT} is already in use!` : err,
    );
    process.exit(1);
  });
