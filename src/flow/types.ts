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

/** The result of the confirm step, as the lobby screen reports it. */
export type DepositOutcome =
  | { ok: true; message: string }
  | { ok: false; message: string };
