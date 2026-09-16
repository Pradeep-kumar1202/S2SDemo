/**
 * Mock API server for local development.
 *
 * Usage:
 *   npm run server
 *
 * Configure via .env (see .env.example).
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Comma-separated list of allowed origins; "*" (default) allows all.
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ---------------------------------------------------------------------------
// Hyperswitch
// ---------------------------------------------------------------------------

const HS = {
  baseUrl: (process.env.HYPERSWITCH_BASE_URL || 'https://sandbox.hyperswitch.io').replace(/\/+$/, ''),
  apiKey: process.env.HYPERSWITCH_API_KEY,
  publishableKey: process.env.HYPERSWITCH_PUBLISHABLE_KEY,
  profileId: process.env.HYPERSWITCH_PROFILE_ID,
};

// When the profile has no wallet enabled on any connector, session_tokens comes back empty.
// Set MOCK_WALLET_SESSION_TOKENS=true to inject test tokens so the native sheets can be exercised.
// (Confirming with a mocked token will be rejected by Hyperswitch.)
const MOCK_WALLET_SESSION_TOKENS = /^(1|true|yes)$/i.test(process.env.MOCK_WALLET_SESSION_TOKENS || '');
const APPLE_PAY_MERCHANT_ID = process.env.APPLE_PAY_MERCHANT_ID || 'merchant.com.s2sdemo';

for (const key of ['HYPERSWITCH_API_KEY', 'HYPERSWITCH_PUBLISHABLE_KEY', 'HYPERSWITCH_PROFILE_ID']) {
  if (!process.env[key]) {
    console.warn(`Warning: ${key} is not set; /api/create-payment will fail`);
  }
}

// Default payment-create payload; overridden by whatever the caller sends.
const DEFAULT_PAYMENT = {
  amount: 6500,
  currency: 'USD',
  order_details: [{ product_name: 'Apple iphone 15', quantity: 1, amount: 6500 }],
  confirm: false,
  capture_method: 'automatic',
  authentication_type: 'three_ds',
  setup_future_usage: 'on_session',
  request_external_three_ds_authentication: false,
  email: 'user@gmail.com',
  description: 'Hello this is description',
  customer_id: 'hyperswitch_sdk_demo_id',
  shipping: {
    address: {
      state: 'California',
      city: 'Banglore',
      country: 'US',
      line1: 'sdsdfsdf',
      line2: 'hsgdbhd',
      line3: 'alsksoe',
      zip: '571201',
      first_name: 'John',
      last_name: 'Doe',
    },
    phone: { number: '123456789', country_code: '+1' },
  },
  billing: {
    address: {
      line1: '1467',
      line2: 'Harrison Street',
      line3: 'Harrison Street',
      city: 'San Fransico',
      state: 'California',
      zip: '94122',
      country: 'US',
      first_name: 'joseph',
      last_name: 'Doe',
    },
    phone: { number: '8056594427', country_code: '+91' },
  },
  connector_metadata: { noon: { order_category: 'applepay' } },
  metadata: { udf1: 'value1', new_customer: 'true', login_date: '2019-09-10T10:11:12Z' },
};

class HyperswitchError extends Error {
  constructor(step, status, body) {
    super(`Hyperswitch ${step} failed with status ${status}`);
    this.step = step;
    this.status = status;
    this.body = body;
  }
}

async function hsRequest(step, path, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(`${HS.baseUrl}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
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
  if (!res.ok) {
    throw new HyperswitchError(step, res.status, data);
  }
  return data;
}

// Step 1: create the payment intent (secret api-key).
function createPayment(overrides) {
  return hsRequest('create_payment', '/payments', {
    method: 'POST',
    headers: { 'api-key': HS.apiKey },
    body: { ...DEFAULT_PAYMENT, profile_id: HS.profileId, ...overrides },
  });
}

// Step 2: fetch client-side payment data (enabled payment methods, saved
// methods, intent data). Authenticated with a base64 "k=v,k=v" header.
function getPaymentClientData(payment) {
  const authorization = Buffer.from(
    [
      `profile_id=${payment.profile_id || HS.profileId}`,
      `publishable_key=${HS.publishableKey}`,
      `client_secret=${payment.client_secret}`,
      `customer_id=${payment.customer_id}`,
      `payment_id=${payment.payment_id}`,
    ].join(','),
  ).toString('base64');

  return hsRequest('get_client_data', `/payments/${payment.payment_id}/client`, {
    headers: { authorization },
  });
}

// Step 3: fetch wallet session tokens (publishable key).
function getSessionTokens(payment, wallets = []) {
  return hsRequest('session_tokens', '/payments/session_tokens', {
    method: 'POST',
    headers: { 'api-key': HS.publishableKey },
    body: {
      payment_id: payment.payment_id,
      client_secret: payment.client_secret,
      wallets,
    },
  });
}

// Step 4: confirm the payment with the wallet token collected on the device (secret api-key).
function confirmPayment(paymentId, body) {
  return hsRequest('confirm_payment', `/payments/${encodeURIComponent(paymentId)}/confirm`, {
    method: 'POST',
    headers: { 'api-key': HS.apiKey },
    body,
  });
}

function retrievePayment(paymentId) {
  return hsRequest('retrieve_payment', `/payments/${encodeURIComponent(paymentId)}?force_sync=true`, {
    headers: { 'api-key': HS.apiKey },
  });
}

// Test-only session tokens in the same shape Hyperswitch returns.
function mockWalletSessionTokens(payment) {
  const amountMajor = (payment.amount / 100).toFixed(2);
  return [
    {
      mock: true,
      wallet_name: 'google_pay',
      connector: 'mock',
      delayed_session_token: false,
      sdk_next_action: { next_action: 'confirm' },
      merchant_info: { merchant_name: 'S2S Demo' },
      allowed_payment_methods: [
        {
          type: 'CARD',
          parameters: {
            allowed_auth_methods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
            allowed_card_networks: ['AMEX', 'DISCOVER', 'JCB', 'MASTERCARD', 'VISA'],
          },
          tokenization_specification: {
            type: 'PAYMENT_GATEWAY',
            parameters: { gateway: 'example', gateway_merchant_id: 'exampleGatewayMerchantId' },
          },
        },
      ],
      transaction_info: {
        country_code: 'US',
        currency_code: payment.currency,
        total_price_status: 'Final',
        total_price: amountMajor,
      },
    },
    {
      mock: true,
      wallet_name: 'apple_pay',
      connector: 'mock',
      delayed_session_token: false,
      sdk_next_action: { next_action: 'confirm' },
      payment_request_data: {
        country_code: 'US',
        currency_code: payment.currency,
        total: { label: 'S2S Demo', type: 'final', amount: amountMajor },
        merchant_capabilities: ['supports3DS'],
        supported_networks: ['visa', 'masterCard', 'amex', 'discover'],
        merchant_identifier: APPLE_PAY_MERCHANT_ID,
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

/**
 * POST /api/create-payment
 *
 * Body (optional): any /payments create fields to override the defaults,
 * plus an optional `wallets` array forwarded to /payments/session_tokens.
 *
 * Creates a payment, then fetches client data and session tokens for it,
 * and returns everything to the caller.
 */
app.post('/api/create-payment', async (req, res, next) => {
  if (!HS.apiKey || !HS.publishableKey || !HS.profileId) {
    return res.status(500).json({ error: 'Hyperswitch env vars are not configured' });
  }

  const { wallets = [], ...paymentOverrides } = req.body || {};

  try {
    const payment = await createPayment(paymentOverrides);
    const [client, sessionTokens] = await Promise.all([
      getPaymentClientData(payment),
      getSessionTokens(payment, wallets),
    ]);

    if (MOCK_WALLET_SESSION_TOKENS && sessionTokens.session_token.length === 0) {
      sessionTokens.session_token = mockWalletSessionTokens(payment);
    }

    res.json({
      payment_id: payment.payment_id,
      client_secret: payment.client_secret,
      publishable_key: HS.publishableKey,
      profile_id: payment.profile_id || HS.profileId,
      customer_id: payment.customer_id,
      payment,
      client,
      session_tokens: sessionTokens,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/confirm-payment
 *
 * Body: { payment_id, payment_method, payment_method_type, payment_method_data, ... }
 * e.g. for Google Pay:
 *   { payment_id, payment_method: "wallet", payment_method_type: "google_pay",
 *     payment_method_data: { wallet: { google_pay: { type, description, info, tokenization_data } } } }
 * for Apple Pay:
 *   { payment_id, payment_method: "wallet", payment_method_type: "apple_pay",
 *     payment_method_data: { wallet: { apple_pay: { payment_data, payment_method, transaction_identifier } } } }
 *
 * Forwards to Hyperswitch /payments/{id}/confirm and returns the response.
 */
app.post('/api/confirm-payment', async (req, res, next) => {
  if (!HS.apiKey) {
    return res.status(500).json({ error: 'Hyperswitch env vars are not configured' });
  }
  const { payment_id: paymentId, ...body } = req.body || {};
  if (!paymentId) {
    return res.status(400).json({ error: 'payment_id is required' });
  }
  try {
    res.json(await confirmPayment(paymentId, body));
  } catch (err) {
    next(err);
  }
});

/** GET /api/payments/:id — current state of a payment. */
app.get('/api/payments/:id', async (req, res, next) => {
  if (!HS.apiKey) {
    return res.status(500).json({ error: 'Hyperswitch env vars are not configured' });
  }
  try {
    res.json(await retrievePayment(req.params.id));
  } catch (err) {
    next(err);
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});

// Error handler
app.use((err, _req, res, _next) => {
  if (err instanceof HyperswitchError) {
    console.error(`${err.message}:`, JSON.stringify(err.body));
    return res.status(502).json({
      error: err.message,
      step: err.step,
      status: err.status,
      details: err.body,
    });
  }
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, HOST, () => {
  console.log(`Mock server listening on http://${HOST}:${PORT}`);
});
