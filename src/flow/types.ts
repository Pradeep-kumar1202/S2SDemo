import type { ConfirmPaymentData } from '../server/api';

/**
 * The result of a "collect" step — the part of the sequence where the player
 * hands over a payment instrument.
 *
 * Both collection paths end here:
 *   - the Cards SDK tokenizing a card (new card or saved-card CVC), and
 *   - a wallet sheet returning its payment data.
 *
 * Neither path throws on a normal failure: a cancelled sheet and an incomplete
 * card field are outcomes the UI reports, not crashes. `body` is what the
 * the server forwards to /payments/confirm.
 */
export type CollectOutcome =
  | { ok: true; body: ConfirmPaymentData }
  | { ok: false; message: string };

/**
 * The result of the confirm step.
 *
 * Done and failed are not the only answers. Two more say the payment is still
 * in flight:
 *
 *   - `redirect` — the issuer or the method wants the player somewhere else
 *     first. The flow sends them, then reconciles when they come back.
 *   - `sync` — nothing is left to present, but the confirm response was not the
 *     end of the story either: the payment's own status is the answer, so it is
 *     read with `force_sync`. Device data collection finishing without a
 *     challenge arrives here.
 */
export type DepositOutcome =
  | { ok: true; message: string }
  | { ok: false; message: string }
  | { redirect: string; paymentId: string; message: string }
  | { sync: string; message: string };
