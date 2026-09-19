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
npm run server           # the merchant backend, port 5252
npm run dev              # the app, port 3000
```

`.env` needs four values from the Hyperswitch dashboard:

| Variable | What it is |
| --- | --- |
| `HYPERSWITCH_BASE_URL` | `https://app.hyperswitch.io/api` for sandbox (`snd_`) keys |
| `HYPERSWITCH_API_KEY` | **Secret** key. Server only — never reaches the browser |
| `HYPERSWITCH_PUBLISHABLE_KEY` | `pk_snd_…`, used for session tokens and the SDK |
| `HYPERSWITCH_PROFILE_ID` | `pro_…`, the profile the payment is created against |

The browser calls the server at `http://localhost:5252`; override with
`NEXT_PUBLIC_SERVER_URL`. The server must allow that origin (`CORS_ORIGIN`).

> The server is a separate Express process rather than a Next route handler, on
> purpose: it is the same file as the native demo's server, and keeping it
> separate makes the boundary the diagram draws — secret key on one side, app on
> the other — impossible to miss.

---

## Where to look

```
server/index.js            the merchant backend: one route per step of the flow
app/page.tsx               the router: three screens, no logic
src/
  flow/                    THE SEQUENCE — start here
    useDepositFlow.ts        the whole flow, in order, in one file
    createIntent.ts          step 1  create + method list + session tokens
    updateIntent.ts          step 2  put the amount on the intent
    tokenizeCard.ts          step 3a new card / saved-card CVC → token
    payWithWallet.ts         step 3b why wallets are not wired here
    confirmDeposit.ts        step 4  confirm, and step 5 detection
    types.ts                 CollectOutcome / DepositOutcome
  server/                  talking to our own backend: api.ts, config.ts
  cards/                   hosted card fields: session, the two field sets, types
  ui/                      screens and presentation only — no flow logic
  paymentMethods.ts        shaping the method list: ordering, labels, selection
```

---

## The flow, arrow by arrow

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
creates the intent with `amount: 0`, then fetches the method list
(`GET /payments/{id}/client`) and the session tokens
(`POST /payments/session_tokens`) and merges all three into one response. The
vault authorization for the Cards SDK arrives as
`session_tokens.vault_details.vault_data.sdk_authorization`.

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
`PaymentDataRequest` from the session token and opens the sheet. The network
token it returns is confirmed by the server, so the browser never confirms the
payment itself.

*Apple Pay* (`src/wallets/applePay.ts`) opens an `ApplePaySession` from the
token's `payment_request_data`. Because the server fetched a validated merchant
session (`delayed_session_token: false`), `onvalidatemerchant` hands
`session_token_data` straight back to Apple — no round trip of its own.

Two constraints on Apple Pay are Apple's and cannot be worked around:

- **Safari only.** `window.ApplePaySession` does not exist in other browsers, so
  the button is not offered there.
- **The merchant session is issued for one verified domain**, named in
  `session_token_data.domainName`. Served from anywhere else — localhost
  included — Safari refuses to start the session.

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

Only partly implemented: `confirmDeposit.ts` detects a `next_action` and reports
the payment as unfinished rather than claiming success, but nothing presents the
3DS challenge and no webhook is received. Whatever happens, the player returns
to the lobby, which shows the result.

---

## What is not implemented

| Diagram step | What is missing |
| --- | --- |
| Player info + approved limits | The lobby balance is the constant `BALANCE` in `src/ui/money.ts` |
| `/v1/customers` | The create body names an existing `customer_id` directly |
| PAM authorize | Stubbed on the server; always approves |
| Fraud screening | Stubbed on the server; always approves |
| BIN eligibility | Not called |
| Apple Pay from localhost | Wired, but Apple only validates the domain its merchant session was issued for |
| Next action (3DS / redirect) | Detected and reported, never presented |
| Status webhook + sync | Route exists on the server, nothing calls it |
| Manual capture | Route exists; payments capture automatically |

The amount is displayed in GBP while the intent is created in USD, because the
design is a GBP screen and the sandbox profile is USD.

---

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
