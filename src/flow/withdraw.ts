import { createWithdrawal, type PayoutMethod } from '../server/api';
import { toMinorUnits } from './updateIntent';

/**
 * Withdrawal W2 — the payout itself.
 *
 * Sequence:
 *
 *   App             -> Server          : amount + which stored method
 *   Server          -> PAM             : authorize          (stubbed)
 *   Server          -> Fraud screening : screen the payout  (stubbed)
 *   Server          -> Payments API    : /payouts/create
 *
 * The mirror of a deposit's confirm, and the same division of labour: the app
 * names an amount and a stored method, never an account number, and the create
 * call needs the secret key so it happens on the server.
 *
 * Unlike a deposit there is no intent to update first — a payout carries its
 * own amount — so this is the only call the journey makes.
 */
export type WithdrawalOutcome =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function withdraw(
  method: PayoutMethod,
  amount: number,
): Promise<WithdrawalOutcome> {
  const result = await createWithdrawal(toMinorUnits(amount), method.id);

  if (result.error_code || result.error_message) {
    return {
      ok: false,
      message: `${result.error_code ?? 'error'}: ${result.error_message ?? ''}`,
    };
  }

  return {
    ok: true,
    message: `Payout ${result.payout_id ?? ''} · ${result.status ?? 'created'}`.trim(),
  };
}
