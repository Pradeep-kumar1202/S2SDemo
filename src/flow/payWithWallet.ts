import type { CreatePaymentResponse } from '../server/api';
import {
  ApplePayError,
  canMakePayments,
  isApplePaySupported,
  payWithApplePay,
} from '../wallets/applePay';
import {
  GooglePayError,
  googlePayEnvironment,
  isGooglePaySupported,
  isReadyToPay,
  payWithGooglePay,
} from '../wallets/googlePay';
import { findWalletToken, type WalletName } from '../paymentMethods';
import type { CollectOutcome } from './types';

/**
 * Step 3b — the player pays with Apple Pay or Google Pay.
 *
 * Sequence diagram arrows implemented here:
 *
 *   Player          -> App             : wallet sheet, Deposit
 *   App             -> Server          : payment method data
 *
 * The wallet sheet is native, and what feeds it is the session token the server
 * already fetched in step 1 (and refreshed in step 2). The app does not build
 * the request itself — it hands the token to the platform, which shows the
 * sheet and returns the network token the player authorised.
 *
 * Two things routinely make a wallet unavailable, and both are normal:
 *   - the merchant has no wallet enabled on a connector, so no session token
 *     comes back and there is nothing to show, and
 *   - the device cannot pay (no Play Services, no card in the wallet), which is
 *     what `walletAvailability` reports.
 */

/**
 * Whether each wallet can actually be used right now. Called once after the
 * intent is created, and used to enable or hide the wallet buttons.
 */
export async function walletAvailability(payment: CreatePaymentResponse): Promise<{
  googlePayReady: boolean;
  applePayReady: boolean;
}> {
  let googlePayReady = false;
  let applePayReady = false;

  const googlePayToken = findWalletToken(payment, 'google_pay');
  if (googlePayToken && isGooglePaySupported()) {
    googlePayReady = await isReadyToPay(
      googlePayToken,
      googlePayEnvironment(payment.publishable_key ?? ''),
    );
  }

  const applePayToken = findWalletToken(payment, 'apple_pay');
  if (applePayToken && isApplePaySupported()) {
    applePayReady = await canMakePayments();
  }

  return { googlePayReady, applePayReady };
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
    if (wallet === 'google_pay') {
      const token = findWalletToken(payment, 'google_pay');
      if (!token) {
        return { ok: false, message: 'No Google Pay session token for this payment.' };
      }
      return {
        ok: true,
        body: await payWithGooglePay(
          token,
          googlePayEnvironment(payment.publishable_key ?? ''),
        ),
      };
    }

    const token = findWalletToken(payment, 'apple_pay');
    if (!token) {
      return { ok: false, message: 'No Apple Pay session token for this payment.' };
    }
    return { ok: true, body: await payWithApplePay(token) };
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
