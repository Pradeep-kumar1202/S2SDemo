import { updatePayment, type CreatePaymentResponse } from '../server/api';

/** Hyperswitch amounts are in minor units: £10.50 is 1050. */
export const toMinorUnits = (amount: number): number => Math.round(amount * 100);

/**
 * Step 2 — the player has typed the amount they want to deposit.
 *
 * Sequence diagram arrows implemented here:
 *
 *   App             -> Server          : update amount
 *   Server          -> Payments API    : update payment intent
 *   Server          <- Payments API    : updated session tokens
 *                                      + sdk_authorization
 *   App             <- Server          : refreshed data to SDK
 *
 * Why it matters, and why it runs before collection rather than at confirm:
 * the wallet sheets quote a price that is baked into the session token, and the
 * vault session is minted for this intent. Collecting an instrument against a
 * stale amount means the player authorises one number and gets charged another.
 *
 * The demo calls this at two moments, both of them just before the player can
 * pick an instrument:
 *   - opening the payment sheet, and
 *   - pressing Deposit (or a wallet button) on the deposit screen.
 *
 * The response has the same shape as create, so the caller replaces its whole
 * payment object with it — new session tokens, new vault details and all.
 */
export function updateIntent(
  payment: CreatePaymentResponse,
  amount: number,
): Promise<CreatePaymentResponse> {
  return updatePayment(payment.payment_id, toMinorUnits(amount));
}
