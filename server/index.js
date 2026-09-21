/**
 * the server — the merchant's own backend, for local development.
 *
 * This file is the merchant server in the deposit sequence diagram:
 * everything that needs the secret API key, which must never reach the app.
 * The app talks only to the routes below.
 *
 *   Step 1  GET  /api/create-payment    create the intent + data to render
 *   Step 2  POST /api/update-payment    put the player's amount on the intent
 *   Step 4  POST /api/confirm-payment   authorize, screen, then confirm
 *   Step 5  GET  /api/payments/:id      reconcile a payment that settled later
 *   opt     POST /api/capture-payment   manual capture
 *
 * Usage:
 *   npm run server
 *
 * Configure via .env (see .env.example).
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

// Comma-separated list of allowed origins; "*" (default) allows all.
const allowedOrigins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.includes("*") ? true : allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());

// Simple request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

const HS_BASE_URL = process.env.HYPERSWITCH_BASE_URL;
const HS_API_KEY = process.env.HYPERSWITCH_API_KEY;
const HS_PUBLISHABLE_KEY = process.env.HYPERSWITCH_PUBLISHABLE_KEY;
const HS_PROFILE_ID = process.env.HYPERSWITCH_PROFILE_ID;
for (const [name, value] of Object.entries({
  HYPERSWITCH_API_KEY: HS_API_KEY,
  HYPERSWITCH_PUBLISHABLE_KEY: HS_PUBLISHABLE_KEY,
  HYPERSWITCH_PROFILE_ID: HS_PROFILE_ID,
})) {
  if (!value) {
    console.warn(`Warning: ${name} is not set; /api/create-payment will fail`);
  }
}

/**
 * Calls Hyperswitch and returns { status, data } with the body parsed when
 * possible. Each caller passes its own auth header: the secret api-key for
 * server-side calls, the publishable key for session tokens, and the base64
 * `authorization` blob for client data.
 */
async function hsFetch(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${HS_BASE_URL}${path}`, {
    method,
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

/** Server-to-server call with the secret key. */
const hsSecret = (path, options = {}) =>
  hsFetch(path, { ...options, headers: { "api-key": HS_API_KEY } });

/**
 * The payment method list the SDK renders: enabled methods, the customer's
 * saved methods and the intent data. Authenticated with a base64 "k=v,k=v" blob
 * rather than a key.
 *
 * Until `X-Integration-Type: server` returns this inline on create, it is
 * fetched here with a second call.
 */
function fetchPaymentMethodList(payment) {
  const authorization = Buffer.from(
    [
      `profile_id=${payment.profile_id || HS_PROFILE_ID}`,
      `publishable_key=${HS_PUBLISHABLE_KEY}`,
      `client_secret=${payment.client_secret}`,
      `customer_id=${payment.customer_id}`,
      `payment_id=${payment.payment_id}`,
    ].join(","),
  ).toString("base64");

  return hsFetch(`/payments/${payment.payment_id}/client`, {
    headers: { authorization },
  });
}

/** Wallet session tokens + vault details, fetched with the publishable key. */
function fetchSessionTokens(payment, wallets = []) {
  return hsFetch("/payments/session_tokens", {
    method: "POST",
    headers: { "api-key": HS_PUBLISHABLE_KEY },
    body: {
      payment_id: payment.payment_id,
      client_secret: payment.client_secret,
      wallets,
    },
  });
}

/** Both of the above, in parallel, for a payment that was just created or updated. */
async function fetchSdkData(payment) {
  const [list, tokens] = await Promise.all([
    fetchPaymentMethodList(payment),
    fetchSessionTokens(payment),
  ]);
  return {
    payment_method_list: list.data,
    session_tokens: tokens.data,
  };
}

// ---------------------------------------------------------------------------
// Steps this demo does not implement
//
// These are real arrows in the sequence diagram, stubbed here at exactly the
// point they would be called so the shape of the flow stays honest. A merchant
// replaces each body with their own system.
// ---------------------------------------------------------------------------

/**
 * Server          -> PAM             : authorize / get player info + limits
 *
 * The wallet of record. Before money moves, the player's own balance and
 * deposit limits are checked, and afterwards their balance is updated with the
 * result. This demo has no PAM, so the lobby's balance is a constant in
 * `src/money.ts` and every deposit is treated as authorized.
 */
async function authorizeWithPam(payment) {
  return { approved: true, payment_id: payment.payment_id };
}

/**
 * Server          -> Fraud screening : screen the payment
 *
 * Runs between authorization and confirm, and again with the final status. A
 * decline here stops the payment before Hyperswitch is ever called.
 */
async function screenForFraud(payment) {
  return { approved: true, payment_id: payment.payment_id };
}

/**
 * Server          <- Payments API    : payment status webhook
 * Server          -> Payments API    : payment status sync
 *
 * Confirm is not the end of a payment: 3DS challenges, redirects and async
 * methods all settle later. A real integration exposes a webhook endpoint and
 * reconciles with a sync call (GET /payments/{id}?force_sync=true), then tells
 * PAM and the fraud provider how it ended. Without this, a payment that needs a
 * challenge is simply never heard from again.
 */
async function syncPaymentStatus(paymentId) {
  return hsSecret(`/payments/${encodeURIComponent(paymentId)}?force_sync=true`);
}

/**
 * Server          -> Payments API    : capture
 *
 * Only for merchants who authorize now and capture later. This demo creates
 * payments with the profile's default capture method, so capture is automatic.
 */
async function capturePayment(paymentId) {
  return hsSecret(`/payments/${encodeURIComponent(paymentId)}/capture`, {
    method: "POST",
    body: {},
  });
}

// ---------------------------------------------------------------------------
// Routes — one per step of the sequence
// ---------------------------------------------------------------------------

/**
 * Step 1 — GET /api/create-payment
 *
 *   Server          -> Payments API    : /payments/create (amount 0)
 *   Server          -> Payments API    : payment method list + session tokens
 *
 * The intent is created with amount 0 because the player has not chosen one
 * yet; `/api/update-payment` puts the real amount on it. The response is
 * everything the SDK needs to render: enabled methods, the player's saved
 * cards, wallet session tokens and the vault authorization.
 */
app.get("/api/create-payment", async (req, res, next) => {
  if (!HS_API_KEY) {
    return res
      .status(500)
      .json({ error: "HYPERSWITCH_API_KEY is not configured" });
  }

  const amount = 0;
  const currency = "USD";
  const profile_id = process.env.HYPERSWITCH_PROFILE_ID;

  try {
    const { status, data } = await hsSecret("/payments", {
      method: "POST",
      body: {
        amount,
        currency,
        profile_id,
        customer_id: "hyperswitch_sdk_demo_id",
        billing: {
          address: {
            line1: "1467",
            line2: "Harrison Street",
            line3: "Harrison Street",
            city: "San Fransico",
            state: "California",
            zip: "94122",
            country: "US",
            first_name: "joseph",
            last_name: "Doe",
          },
          phone: {
            number: "8056594427",
            country_code: "+91",
          },
        },
        // routing: {
        //   "type": "single",
        //   "data": {
        //     "connector": "checkout"
        //   }
        // }
      },
    });
    if (status >= 400) {
      return res.status(status).json(data);
    }
    res.status(status).json({
      ...data,
      publishable_key: HS_PUBLISHABLE_KEY,
      ...(await fetchSdkData(data)),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Step 2 — POST /api/update-payment  { payment_id, amount }
 *
 *   Server          -> Payments API    : update payment intent
 *   Server          <- Payments API    : updated session tokens + sdk_authorization
 *
 * Called before the player can pick an instrument, so wallet sheets quote the
 * right price and the vault session belongs to the right amount. Returns the
 * same shape as create: the SDK swaps its whole payment object for it.
 */
app.post("/api/update-payment", async (req, res, next) => {
  if (!HS_API_KEY) {
    return res
      .status(500)
      .json({ error: "HYPERSWITCH_API_KEY is not configured" });
  }

  const { payment_id: paymentId, amount } = req.body || {};
  if (!paymentId) {
    return res.status(400).json({ error: "payment_id is required" });
  }

  try {
    const { status, data } = await hsSecret(
      `/payments/${encodeURIComponent(paymentId)}`,
      { method: "POST", body: { amount } },
    );
    if (status >= 400) {
      return res.status(status).json(data);
    }
    res.status(status).json({
      ...data,
      publishable_key: HS_PUBLISHABLE_KEY,
      ...(await fetchSdkData(data)),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Step 4 — POST /api/confirm-payment  { payment_id, ...instrument }
 *
 *   Server          -> PAM             : authorize   (stubbed above)
 *   Server          -> Fraud screening : screen the payment   (stubbed above)
 *   Server          -> Payments API    : /payments/confirm
 *
 * The instrument is a token — a vault token for cards, a network token for
 * wallets — never card data. Confirm needs the secret key, which is why it
 * happens here and not in the app.
 */
app.post("/api/confirm-payment", async (req, res, next) => {
  if (!HS_API_KEY) {
    return res
      .status(500)
      .json({ error: "HYPERSWITCH_API_KEY is not configured" });
  }

  const { payment_id: paymentId, ...body } = req.body || {};
  if (!paymentId) {
    return res.status(400).json({ error: "payment_id is required" });
  }

  try {
    // The two checks a real deposit passes before any money moves.
    const authorization = await authorizeWithPam({ payment_id: paymentId });
    if (!authorization.approved) {
      return res.status(402).json({ error: "Declined by PAM" });
    }
    const screening = await screenForFraud({ payment_id: paymentId });
    if (!screening.approved) {
      return res.status(402).json({ error: "Declined by fraud screening" });
    }

    const { status, data } = await hsSecret(
      `/payments/${encodeURIComponent(paymentId)}/confirm`,
      { method: "POST", body },
    );

    // Step 5 lives here in a real integration: if `data.next_action` is set the
    // payment is not finished, and the status is reconciled later by webhook or
    // by GET /api/payments/:id below.
    res.status(status).json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * Step 5 — GET /api/payments/:id
 *
 *   Server          -> Payments API    : payment status sync
 *   App             <- Server          : payment status
 *
 * How a payment that needed a 3DS challenge or a redirect is reconciled. The
 * app does not call this yet — it reports the confirm response and stops — so
 * this route is here to show where the sync belongs.
 */
app.get("/api/payments/:id", async (req, res, next) => {
  try {
    const { status, data } = await syncPaymentStatus(req.params.id);
    res.status(status).json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * Optional — POST /api/capture-payment  { payment_id }
 *
 *   Server          -> Payments API    : capture
 *
 * Only for merchants who authorize now and capture later. Unused by this demo,
 * whose payments capture automatically.
 */
app.post("/api/capture-payment", async (req, res, next) => {
  const { payment_id: paymentId } = req.body || {};
  if (!paymentId) {
    return res.status(400).json({ error: "payment_id is required" });
  }
  try {
    const { status, data } = await capturePayment(paymentId);
    res.status(status).json(data);
  } catch (err) {
    next(err);
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal Server Error" });
});

app
  .listen(PORT, HOST, () => {
    console.log(`Mock server listening on http://${HOST}:${PORT}`);
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`❌ Port ${PORT} is already in use!`);
      process.exit(1);
    } else {
      console.log("Server error:", err);
      process.exit(1);
    }
  });
