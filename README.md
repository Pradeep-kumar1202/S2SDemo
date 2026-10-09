# Deposit demo (React) — server-to-server payments

A React/Next.js demo of a deposit flow built on Hyperswitch, written to be read.
It implements the **Deposit — Server to Server (Payments)** sequence diagram:
create an intent, put the player's amount on it, collect a card without ever
touching card data, and confirm.

This is the web twin of the React Native demo. The flow modules, the screens and
the server are deliberately the same shape, so the two can be read side by side.

| Diagram column | Here |
| --- | --- |
| Client / App | the Next.js app — `app/`, `src/` |
| Server | `server/index.js` — everything needing the secret API key |
| Payments API / Cards SDK | Hyperswitch, `@juspay-tech/react-hyper-js`, `@juspay-tech/hyper-js` |
| PAM, Fraud screening | stubbed — see [What is not implemented](#what-is-not-implemented) |

---

## Running it

```sh
npm install
cp .env.example .env     # then fill in your keys
npm run server           # the merchant backend, port 5300
npm run dev              # the app (the checkout), port 3000
npm run merchant         # the merchant site, port 3001 — frames the app
npm run logs             # optional: the log server and dashboard, port 4000
```

Open http://localhost:3001 to see the checkout as a merchant embeds it: in an
iframe, from another origin. http://localhost:3000 is the checkout on its own.

`.env` needs four values from the Hyperswitch dashboard:

| Variable | What it is |
| --- | --- |
| `HYPERSWITCH_BASE_URL` | `https://app.hyperswitch.io/api` for sandbox (`snd_`) keys |
| `HYPERSWITCH_API_KEY` | **Secret** key. Server only — never reaches the browser |
| `HYPERSWITCH_PUBLISHABLE_KEY` | `pk_snd_…`, used for session tokens and the SDK |
| `HYPERSWITCH_PROFILE_ID` | `pro_…`, the profile the payment is created against |
| `HYPERSWITCH_CUG_USER` | Optional. `true` sends the `x-cug-user` header on every call |
| `MERCHANT_DOMAIN` | Optional. The merchant site's domain, which Apple Pay's merchant session is issued for (default `s2s-web-demo.netlify.app`) |
| `CHECKOUT_URL` | Optional. Where the merchant site loads the checkout from (default `http://localhost:3000`) |

The browser calls the server at `http://localhost:5300`; override with
`NEXT_PUBLIC_SERVER_URL`. The server must allow that origin (`CORS_ORIGIN`).

> The server is a separate Express process rather than a Next route handler, on
> purpose: it is the same file as the native demo's server, and keeping it
> separate makes the boundary the diagram draws — secret key on one side, app on
> the other — impossible to miss.

---

## Where to look

```
server/index.js            the merchant backend: one route per step of the flow
netlify/functions/api.js   the same backend, deployed as a Netlify function
merchant/                  the merchant site: frames the checkout, mounts the Apple Pay bridge
public/apple-pay-bridge.js the bridge itself, run on the merchant page
app/page.tsx               the router: three screens, no logic
src/
  flow/                    THE SEQUENCE — start here
    useDepositFlow.ts        the whole flow, in order, in one file
    createIntent.ts          step 1  create + method list + session tokens
    updateIntent.ts          step 2  put the amount on the intent
    tokenizeCard.ts          step 3a new card / saved-card CVC → token
    payWithWallet.ts         step 3b why wallets are not wired here
    confirmDeposit.ts        step 4  confirm, and step 5 detection
    collectDeviceData.ts     step 5a hidden-iframe device data collection
    types.ts                 CollectOutcome / DepositOutcome
  server/                  talking to our own backend: api.ts, config.ts
  cards/                   hosted card fields: session, the two field sets, types
  ui/                      screens and presentation only — no flow logic
  wallets/                 Google Pay, Apple Pay, and the iframe side of the Apple Pay bridge
  paymentMethods.ts        shaping the method list: ordering, labels, selection
```

---

## The flow, arrow by arrow

### Step 0 — The player becomes a customer

```
Server        -> Payments API  : POST /v1/customers
Server        <- Payments API  : customer (id + merchant_reference_id)
```

`ensureCustomer()` in `server/index.js`. Saved cards hang off a customer, so the
player has to be one before an intent can name them. The player's own id goes in
as `merchant_reference_id`, and that is what every later call uses as
`customer_id` — the API's `0a_cus_…` id is never needed, and `/payments` rejects
it with `IR_06`.

The player is written into the two requests that need them — `player_demo_001`
with an email and name; a real integration takes them from whoever is signed in.

Two things about this endpoint are unlike the rest of the API, and both are why
it does not go through `hsFetch`:

- it is under `/v1` on the same host, where the payments calls are not, and
- it authenticates with `Authorization: api-key=…`, not the `api-key` header.

The call runs on every deposit: a player who already exists answers `IR_12`,
which this treats as success. Any other failure is logged and the flow
continues, since the payment names the player by id either way.

### Step 1 — Player reaches the lobby

```
Player        -> Client        : reaches lobby
App           -> Server        : start deposit
Server        -> Payments API  : /payments (amount 0)
Server        <- Payments API  : payment_method_list + session_tokens
                                 + sdk_authorization
App           <- Server        : data to render
```

`src/flow/createIntent.ts` · `server/index.js` → `GET /api/create-payment`

Nothing is created until the player asks: no network call on load. The server
creates the intent with `amount: 0`, sending `X-Integration-Type: server` —
which is what makes this one call rather than three: the method list, the wallet
session tokens and `sdk_authorization` come back inline. Without that header the
server would have to follow up with `GET /payments/{id}/client` and
`POST /payments/session_tokens` itself.

The Cards SDK is handed `session_tokens.vault_details` as its `vaultDetails`,
which names the vault outright so the SDK performs no lookup of its own.
`src/cards/vault.ts` falls back to the top-level `sdk_authorization` when a
response carries only that.

Saved methods are ordered most-recently-used first, and the top one leads on
both screens.

### Step 2 — Player enters the amount

```
App           -> Server        : update amount
Server        -> Payments API  : update payment intent
Server        <- Payments API  : updated session tokens + sdk_authorization
```

`src/flow/updateIntent.ts` · `POST /api/update-payment`

The amount goes in minor units (£10.50 → `1050`), and the update runs just
before the player can pick an instrument — opening the sheet, or pressing
Deposit. Collect against a stale amount and the player authorises one number
while another is charged.

### Step 3 — Player picks how to pay

**New card** — `src/cards/NewCardFields.tsx` mounts `CardNumberField`,
`CardExpiryField` and `CardCVCField` inside a `CardForm`, wrapped in
`HyperPaymentMethodSession` (`src/cards/CardSession.tsx`). The PAN, expiry and
CVC live in the SDK's iframes; only a token crosses back.

**Saved card** — `src/cards/SavedCardCvcField.tsx` mounts *only* the CVC field,
naming the stored card via `options.savedCard`, so `tokenize()` refreshes that
card's CVC rather than collecting a new card. A CVC field with `savedCard` must
be the only field in its form.

**Wallets** — `src/flow/payWithWallet.ts`, with one module per wallet.

*Google Pay* (`src/wallets/googlePay.ts`) loads Google's `pay.js`, builds the
`PaymentDataRequest` from the session token and opens the sheet. Only network
tokens are accepted: the session's auth methods are cut to `CRYPTOGRAM_3DS`, and a
session that allows only `PAN_ONLY` means Google Pay is not offered. The network
token it returns is confirmed by the server, so the browser never confirms the
payment itself.

On a sandbox key (`pk_snd_`) the button appears whenever the session allows
network tokens, and Google's `isReadyToPay` is not called: asking it would hide
the button on any browser with no card tokenized in Google Pay, which is most of
them. Google's own sheet may then open and report that it has nothing to offer —
that is Google answering, not the demo failing. A production key (`pk_prd_`)
asks the browser as before.

*Apple Pay* (`src/wallets/applePay.ts`) opens an `ApplePaySession` from the
token's `payment_request_data`. Because the server fetched a validated merchant
session (`delayed_session_token: false`), `onvalidatemerchant` hands
`session_token_data` straight back to Apple — no round trip of its own. A token
without `session_token_data` leaves nothing to validate with, so Apple Pay is
not offered at all.

Two constraints on Apple Pay are Apple's and cannot be worked around:

- **Safari only.** `window.ApplePaySession` does not exist in other browsers, so
  the button is not offered there.
- **The merchant session is issued for one verified domain**, named in
  `session_token_data.domainName`. Served from anywhere else — localhost
  included — Safari refuses to start the session. The server asks for it with
  the `x-merchant-domain` header (`MERCHANT_DOMAIN`).

**Apple Pay from inside the iframe.** A merchant embeds this checkout in an
iframe on another domain, and Apple Pay does not run there. So, as
hyperswitch-web does, the merchant page mounts `public/apple-pay-bridge.js` from
the checkout's domain, and the session runs in the top-level window:
`src/wallets/applePayBridge.ts` sends it the payment request on the tap, hands
over the merchant session when Apple asks, and gets the token back by
`postMessage`. The verified domain is therefore the merchant page's. Opened on
its own, the checkout runs Apple Pay itself. Google Pay needs no bridge — the
iframe's `allow="payment"` is enough.

### Step 4 — Confirm

```
App           -> Server        : token + amount
Server        -> PAM           : authorize          (stubbed)
Server        -> Fraud screening : screen           (stubbed)
Server        -> Payments API  : /payments/confirm
```

`src/flow/confirmDeposit.ts` · `POST /api/confirm-payment`

The body differs by card path, because the vault token means different things.

A **new card** — the token *is* the instrument:

```jsonc
{ "payment_id": "pay_…", "payment_method": "card",
  "payment_method_type": "debit", "payment_token": "token_…" }
```

A **saved card** — the instrument is already in the locker, so the token carries
only the re-collected CVC:

```jsonc
{ "payment_id": "pay_…", "payment_method": "card",
  "payment_method_type": "debit", "payment_token": "<stored card>",
  "payment_method_data": { "card_token": { "card_cvc_token": "token_…" } } }
```

Confirm needs the secret key, so it happens on the server, never in the browser.

### Step 5 — Next action, and settling

A confirm does not always end the story. Two `next_action` shapes are handled:

- **`redirect_to_url`** — the payment id is written to `sessionStorage`, the page
  navigates to the issuer, and on the way back the lobby reads the payment with
  `force_sync` (`useDepositFlow.ts`). The redirect replaces the page, so there is
  no state to return to; the id on disk is the whole handover.
- **`invoke_ddc`** — device data collection, in `collectDeviceData.ts`. Before
  deciding whether to challenge, the issuer wants to see the device, and it
  insists on reading the browser itself: it sends a URL, the page loads it in a
  **hidden** 1×1 iframe, and that page posts a `next_action` back. The reply is
  an ordinary `redirect_to_url`, so the flow rejoins the case above — unless its
  `redirect_mode` is `if_required`, which means no challenge is needed, nothing
  is presented, and the payment's own status is read instead. The wait is
  `ddc_data.timeout_ms`, or 30s when it is null, after which the deposit fails;
  the iframe and its listener are removed on every path, or a retry would
  resolve on the previous attempt's message.

Everything else Hyperswitch can send — `display_qr_code`, `invoke_sdk_client`,
`third_party_sdk_session_token` — is reported rather than presented, so a pending
payment is never shown as done. No webhook is received. Whatever happens, the
player returns to the lobby, which shows the result.

---

## What is not implemented

| Diagram step | What is missing |
| --- | --- |
| Player info + approved limits | The lobby balance is the constant `BALANCE` in `src/ui/money.ts` |
| PAM authorize | Stubbed on the server; always approves |
| Fraud screening | Stubbed on the server; always approves |
| BIN eligibility | Not called |
| Apple Pay from localhost | Wired, but Apple only validates the domain its merchant session was issued for |
| Next action: QR, SDK client, third-party session | Detected and reported, never presented |
| Status webhook + sync | Route exists on the server, nothing calls it |
| Manual capture | Route exists; payments capture automatically |

The amount is displayed in GBP while the intent is created in CAD, because the
design is a GBP screen and the sandbox profile is CAD.

---

## Deploying

`netlify.toml` deploys the checkout as a static export, with the merchant
backend as a Netlify function under `/api` on the same site — set the
`HYPERSWITCH_*` variables on that site. The merchant site is a second site:
`merchant/index.html`, with `%CHECKOUT_URL%` replaced by the checkout's URL,
plus `public/.well-known/` for Apple's domain verification.

## Notes for integrators

- **The secret key never reaches the browser.** Create, update and confirm all
  run on the server; the app holds only the publishable key and short-lived
  tokens.
- **The app never sees card data.** There is no card state to read, validate or
  log — the fields are the SDK's, and only tokens cross back.
- **`tokenize()` never throws.** Every outcome, validation failures included, is
  a result with a `code` to branch on and a `message` safe to show.
- **Google's button styles collide with common class names.** `pay.js` injects
  rules for `.gpay-button`, so the container here is `.wallet-button` — reusing
  Google's name lets their stylesheet size your layout.
- **`@juspay-tech/react-hyper-js` ships no TypeScript types.** The components
  this demo uses are declared in `src/cards/declarations.d.ts`; anything else is
  importable but untyped.
