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

  const redirect = redirectUrlOf(result);
  if (redirect) {
    return {
      redirect,
      paymentId: result.payment_id,
      message: 'Finishing authentication…',
    };
  }

  const nextAction = pendingNextAction(result);
  if (nextAction) {
    return {
      ok: false,
      message: `Payment ${result.payment_id} needs ${
        result.status
      } — ${describeNextAction(nextAction)} is not handled in this demo.`,
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
 * Step 5 — next action.
 *
 * A confirm does not always end the story. When the issuer wants a 3DS
 * challenge, or the method is a redirect APM, the response carries a
 * `next_action` describing what to present:
 *
 *   { "type": "redirect_to_url", "redirect_to_url": "https://…" }
 *
 * `redirect_to_url` is handled: the flow opens that URL and reconciles the
 * payment when the player returns. The other shapes Hyperswitch can send —
 * `display_qr_code`, `invoke_sdk_client`, `third_party_sdk_session_token` —
 * are reported rather than presented, so a pending payment is never shown as
 * done.
 */
function redirectUrlOf(result: ConfirmPaymentResponse): string | null {
  const action = result.next_action as
    | { type?: string; redirect_to_url?: string }
    | null
    | undefined;
  return action?.type === 'redirect_to_url' && action.redirect_to_url
    ? action.redirect_to_url
    : null;
}

function pendingNextAction(result: ConfirmPaymentResponse): unknown | null {
  return result.next_action ?? null;
}

/** The action's own name, so the message says which one was not handled. */
function describeNextAction(action: unknown): string {
  const type = (action as { type?: string } | null)?.type;
  return type ? `\`${type}\`` : 'that next action';
}
