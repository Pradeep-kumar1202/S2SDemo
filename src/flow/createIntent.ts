import { createPayment, type CreatePaymentResponse } from '../server/api';

/**
 * Step 1 — the player reaches the lobby and asks to deposit.
 *
 * Sequence diagram arrows implemented here:
 *
 *   App             -> Server          : start deposit
 *   Server          -> Payments API    : /payments/create (amount 0)
 *   Server          <- Payments API    : payment_method_list + session_tokens
 *                                      + sdk_authorization
 *   App             <- Server          : data to SDK for rendering
 *
 * Everything above the SDK happens on the server (`server/index.js`), because the
 * secret API key must never reach the app. From here the app only ever talks to
 * the server — one call, one screenful of data:
 *
 *   payment_method_list.payment_methods_enabled  what the merchant accepts
 *   payment_method_list.customer_payment_methods the player's saved cards
 *   session_tokens.session_token                 wallet sheets (Apple/Google)
 *   session_tokens.vault_details                 auth for the Cards SDK
 *
 * The intent is created with amount 0 on purpose: the player has not typed an
 * amount yet. `updateIntent` puts the real amount on it before any payment
 * instrument is collected.
 */
export function createIntent(): Promise<CreatePaymentResponse> {
  return createPayment();
}
