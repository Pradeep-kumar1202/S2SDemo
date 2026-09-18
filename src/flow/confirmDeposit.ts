import {
  confirmPayment,
  type ConfirmPaymentData,
  type ConfirmPaymentResponse,
  type CreatePaymentResponse,
} from '../server/api';
import type { DepositOutcome } from './types';

/**
 * Step 4 — the collected instrument becomes a payment.
 *
 * Sequence diagram arrows implemented here:
 *
 *   App             -> Server          : token / PM data + amount
 *   Server          -> PAM             : authorize   (stubbed)
 *   Server          -> Fraud screening : screen the payment   (stubbed)
 *   Server          -> Payments API    : /payments/confirm
 *   Server          <- Payments API    : next action
 *   App             <- Server          : next action
 *
 * Note what the app sends and what it does not. It sends a token and the
 * amount; it never sends card data, and it never calls /payments/confirm
 * itself — confirm needs the secret key, so it belongs to the server. The
 * authorize and fraud steps sit on the server too, between the player's tap and
 * the money moving; see the stubs in `server/index.js`.
 */
export async function confirmDeposit(
  payment: CreatePaymentResponse,
  body: ConfirmPaymentData,
): Promise<DepositOutcome> {
  const result = await confirmPayment(payment.payment_id, body);

  const nextAction = pendingNextAction(result);
  if (nextAction) {
    return {
      ok: false,
      message: `Payment ${result.payment_id} needs ${result.status} — next action is not handled in this demo.`,
    };
  }

  if (result.error_code || result.error_message) {
    return {
      ok: false,
      message: `${result.error_code ?? 'error'}: ${result.error_message ?? ''}`,
    };
  }

  return { ok: true, message: `Payment ${result.payment_id} · ${result.status}` };
}

/**
 * Step 5 — next action (3DS challenge, redirect, QR).
 *
 * NOT IMPLEMENTED IN THIS DEMO. A confirm does not always end the story: when
 * the issuer wants a 3DS challenge, or the method is a redirect APM, Hyperswitch
 * answers with a status like `requires_customer_action` and a `next_action`
 * object describing what to present.
 *
 * A real integration hands that object to the Hyperswitch SDK to display, waits
 * for the player to finish, and then syncs the payment status (which this demo
 * also leaves out — see `syncPaymentStatus` in `server/index.js`).
 *
 * This function only detects the case so the UI can say so honestly rather than
 * reporting a pending payment as done.
 */
function pendingNextAction(result: ConfirmPaymentResponse): unknown | null {
  return result.next_action ?? null;
}
