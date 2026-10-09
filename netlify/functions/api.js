/**
 * The merchant server (server/index.js) as a Netlify function.
 *
 * netlify.toml sends every /api/* request here, so the checkout reaches the
 * same routes it does locally, on its own domain.
 *
 * Configure in the Netlify UI (Site settings -> Environment variables) with the
 * same HYPERSWITCH_* variables as .env; the secret key stays in the function.
 */

const serverless = require("serverless-http");

const { app } = require("../../server/index.js");

const handler = serverless(app, {
  // serverless-http hands the app the body as a raw Buffer on `req.body`, and
  // express.json() leaves a body that is already set alone — so routes would
  // see bytes, not `{ payment_id, ... }`. Parsed here instead. A body that is
  // not valid JSON becomes `{}`, and the route reports what it is missing.
  request(req) {
    if (!Buffer.isBuffer(req.body)) {
      return;
    }
    const text = req.body.toString("utf8");
    const isJson = /json/i.test(req.headers["content-type"] || "");
    try {
      req.body = isJson && text ? JSON.parse(text) : {};
    } catch {
      req.body = {};
    }
  },
});

exports.handler = (event, context) => {
  // Reached through the redirect, the path is usually the original /api/...;
  // called by its own URL it is /.netlify/functions/api/... instead. The app's
  // routes are under /api, so both are mapped there.
  const path = event.path.replace(/^\/\.netlify\/functions\/api(?=\/|$)/, "/api");
  return handler({ ...event, path }, context);
};
