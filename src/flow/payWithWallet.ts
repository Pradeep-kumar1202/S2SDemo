import type { CreatePaymentResponse } from '../server/api';
import { findWalletToken, type WalletName } from '../paymentMethods';
import {
  ApplePayError,
  canPayWithApplePay,
  payWithApplePay,
} from '../wallets/applePay';
import {
  GooglePayError,
  googlePayEnvironment,
  isReadyToPay,
  payWithGooglePay,
} from '../wallets/googlePay';
import type { CollectOutcome } from './types';

/**
 * Step 3b — the player pays with a wallet.
 *
 * Sequence diagram arrows implemented here:
 *
 *   Player        -> App           : wallet sheet, Deposit
 *   App           -> Server        : payment method data
 *
 * Google Pay is driven by the session token the server fetched in step 1 (and
 * refreshed in step 2): the app hands it to Google's pay.js, which shows the
 * sheet and returns a network token. That token goes to the merchant server,
 * which confirms it — the browser never confirms the payment itself, so the
 * authorization and fraud checks stay in front of every payment.
 *
 * Apple Pay works the same way, and is offered only when the token carries a
 * validated merchant session and the browser is Safari. One constraint is
 * Apple's and cannot be worked around: that session is issued for a specific,
 * verified domain (`session_token_data.domainName`), and Safari refuses to
 * start it anywhere else. See `src/wallets/applePay.ts`.
 */

/** Whether each wallet can be used right now: a token, and a device that can pay. */
export async function walletAvailability(payment: CreatePaymentResponse): Promise<{
  googlePayReady: boolean;
  applePayReady: boolean;
}> {
  const googlePayToken = findWalletToken(payment, 'google_pay');
  const googlePayReady = googlePayToken
    ? await isReadyToPay(
        googlePayToken,
        googlePayEnvironment(payment.publishable_key ?? ''),
      )
    : false;

  const applePayReady = canPayWithApplePay(findWalletToken(payment, 'apple_pay'));

  return { googlePayReady, applePayReady };
}

/** Which wallets the server returned session tokens for, if any. */
export function walletsWithTokens(payment: CreatePaymentResponse): WalletName[] {
  return (['google_pay', 'apple_pay'] as const).filter(wallet =>
    Boolean(findWalletToken(payment, wallet)),
  );
}

/**
 * Presents the wallet sheet and returns the confirm body for what the player
 * authorised. A cancelled sheet is an outcome, not an error.
 */
export async function collectWalletPayment(
  payment: CreatePaymentResponse,
  wallet: WalletName,
): Promise<CollectOutcome> {
  try {
    // Each wallet is looked up by its own name so its token type is known.
    if (wallet === 'apple_pay') {
      const token = findWalletToken(payment, 'apple_pay');
      return token
        ? { ok: true, body: await payWithApplePay(token) }
        : { ok: false, message: 'No apple_pay session token for this payment.' };
    }

    const token = findWalletToken(payment, 'google_pay');
    if (!token) {
      return { ok: false, message: 'No google_pay session token for this payment.' };
    }
    return {
      ok: true,
      body: await payWithGooglePay(
        token,
        googlePayEnvironment(payment.publishable_key ?? ''),
      ),
    };
  } catch (error) {
    if (
      (error instanceof GooglePayError || error instanceof ApplePayError) &&
      error.code === 'cancelled'
    ) {
      return { ok: false, message: 'Payment cancelled' };
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
