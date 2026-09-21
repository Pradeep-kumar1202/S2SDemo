import {
  tokenizeError,
  vaultTokenOf,
  type CardFormHandle,
} from '../cards/types';

import type { ConfirmPaymentData, CustomerPaymentMethod } from '../server/api';
import type { CollectOutcome } from './types';

/**
 * Step 3a — the player pays with a card, new or saved.
 *
 * Sequence diagram arrows implemented here:
 *
 *   App             -> Cards SDK       : tokenize()
 *   Cards SDK       -> Payments API    : tokenize
 *   Cards SDK       <- Payments API    : token
 *   App             <- Cards SDK       : vault token
 *
 * The one rule that shapes this whole file: **the app never sees card data.**
 * The PAN, expiry and CVC live inside the Cards SDK's secure fields; the only
 * thing that crosses back is a token. So there is no card state here to read,
 * validate or log — just a handle to the mounted form and the token it returns.
 *
 * The same call covers both branches of the diagram's `alt`:
 *   - "New cards"   — the form has number/expiry/CVC mounted; the token stands
 *                     for a card the player just typed.
 *   - "Saved cards" — the form has only the CVC field mounted, named with the
 *                     stored card's `payment_token`; the token refreshes that
 *                     card's CVC. Pass `paymentToken` for this case.
 *
 * `tokenize()` never throws: every outcome, including validation failures, is a
 * result. That is why this returns a CollectOutcome rather than raising.
 *
 * The two branches confirm with different bodies, because the vault token means
 * different things. For a new card it *is* the instrument, so it goes in
 * `payment_token`. For a saved card the instrument is already in the locker, so
 * `payment_token` names the stored card and the vault token carries just the
 * CVC. See `newCardConfirmBody` and `savedCardConfirmBody` below.
 */
export async function tokenizeCard(
  form: CardFormHandle | null,
  {
    paymentMethodType,
    paymentToken,
  }: { paymentMethodType: string; paymentToken?: string },
): Promise<CollectOutcome> {
  if (!form) {
    return { ok: false, message: 'Card fields are not ready yet.' };
  }

  const result = await form.tokenize();

  // There is no `status` to check. A failure carries an `error` object; a
  // success is the vault's own response, passed straight through.
  const failure = tokenizeError(result);
  if (failure) {
    // code is what to branch on (session_expired, validation_error, …);
    // message is written for the player to read.
    return { ok: false, message: `${failure.code}: ${failure.message}` };
  }

  // Succeeded, so the response carries the token the confirm needs. Missing it
  // is not something the player can act on, but it must not be sent as "".
  const vaultToken = vaultTokenOf(result);
  if (!vaultToken) {
    return { ok: false, message: 'The vault returned no token for this card.' };
  }

  return {
    ok: true,
    body: paymentToken
      ? savedCardConfirmBody({ paymentMethodType, paymentToken, vaultToken })
      : newCardConfirmBody({ paymentMethodType, vaultToken }),
  };
}

/**
 * A stored card the merchant does not re-ask the CVC for. Nothing is collected,
 * so nothing is tokenized: the stored `payment_token` alone is the instrument.
 */
export function savedCardWithoutCvc(
  method: CustomerPaymentMethod,
): CollectOutcome {
  return {
    ok: true,
    body: {
      payment_method: 'card',
      payment_method_type: method.payment_method_type,
      payment_token: method.payment_token,
    },
  };
}

/**
 * New card — the vault token IS the instrument, so it travels as
 * `payment_token`:
 *
 *   { payment_method: "card", payment_method_type: "debit",
 *     payment_token: "token_…" }
 */
function newCardConfirmBody({
  paymentMethodType,
  vaultToken,
}: {
  paymentMethodType: string;
  vaultToken: string;
}): ConfirmPaymentData {
  return {
    payment_method: 'card',
    payment_method_type: paymentMethodType,
    payment_token: vaultToken,
  };
}

/**
 * Saved card — the instrument is the card already in the locker, so
 * `payment_token` names *that* card and the vault token carries only the freshly
 * collected CVC:
 *
 *   { payment_method: "card", payment_method_type: "debit",
 *     payment_token: "<stored card>",
 *     payment_method_data: { card_token: { card_cvc_token: "token_…" } } }
 */
function savedCardConfirmBody({
  paymentMethodType,
  paymentToken,
  vaultToken,
}: {
  paymentMethodType: string;
  paymentToken: string;
  vaultToken: string;
}): ConfirmPaymentData {
  return {
    payment_method: 'card',
    payment_method_type: paymentMethodType,
    payment_token: paymentToken,
    payment_method_data: {
      card_token: { card_cvc_token: vaultToken },
    },
  };
}

