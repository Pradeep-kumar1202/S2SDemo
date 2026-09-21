import type { ApplePaySessionToken, WalletPaymentMethodData } from '../server/api';
import { toCamelCaseKeys, toSnakeCaseKeys } from './keyCase';

/**
 * Apple Pay on the web.
 *
 * Two things make this different from Google Pay, and both come from Apple:
 *
 * 1. **The merchant domain must be registered and verified with Apple**, and the
 *    merchant session is issued *for that domain*. `session_token_data.domainName`
 *    names it. Served from anywhere else — localhost included — Safari refuses
 *    to start the session. There is no test mode around this.
 * 2. **Only Safari implements Apple Pay JS.** `window.ApplePaySession` does not
 *    exist in Chrome or Firefox, so the button is simply not offered there.
 *
 * Like Google Pay, everything here comes from the session token: the request
 * is built from `payment_request_data`, and the merchant is validated with
 * `session_token_data` — the session the server already fetched — handed
 * straight to `completeMerchantValidation`. This demo never validates the
 * merchant itself, so a token without `session_token_data` (a delayed token, or
 * a profile with no verified domain) leaves nothing to validate with, and Apple
 * Pay is not offered at all. See `canPayWithApplePay`.
 */

/** Thrown for a cancelled or failed sheet, mirroring the Google Pay path. */
export class ApplePayError extends Error {
  constructor(
    public code: 'cancelled' | 'failed' | 'unavailable',
    message: string,
  ) {
    super(message);
  }
}

/** Safari with a card set up, and nothing else. */
export function isApplePayAvailable(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.ApplePaySession !== 'undefined' &&
      window.ApplePaySession.canMakePayments()
    );
  } catch {
    return false;
  }
}

/**
 * Whether Apple Pay can actually run for this payment, in this browser.
 *
 * The button is offered only when all of these hold, because without any one
 * of them the sheet can only fail:
 *   - `session_token_data`, the validated merchant session to hand Apple;
 *   - `payment_request_data`, to build the request from;
 *   - a browser that runs Apple Pay JS with a card set up.
 *
 * The browser check cannot be dropped in favour of the token alone: the server
 * fetches the token server to server, so it looks the same whichever browser
 * the player is in. Only the browser can say it is Safari.
 */
export function canPayWithApplePay(
  token: ApplePaySessionToken | undefined,
): boolean {
  const session = token?.session_token_data;
  const hasMerchantSession =
    session != null && typeof session === 'object' && Object.keys(session).length > 0;
  return hasMerchantSession && token?.payment_request_data != null && isApplePayAvailable();
}

/**
 * Apple's PaymentRequest, from the session token.
 *
 * `merchant_identifier` is dropped: it belongs to the merchant session, not to
 * the request, and Apple rejects requests carrying unknown keys.
 */
export function buildPaymentRequest(token: ApplePaySessionToken) {
  const data = token.payment_request_data;
  if (!data) {
    throw new ApplePayError('failed', 'This payment has no Apple Pay request data');
  }
  const { merchant_identifier: _merchantIdentifier, ...request } = data;
  return toCamelCaseKeys<ApplePayJS.ApplePayPaymentRequest>(request);
}

/**
 * Presents the Apple Pay sheet and returns the confirm body for the card the
 * player authorised.
 */
export function payWithApplePay(
  token: ApplePaySessionToken,
): Promise<WalletPaymentMethodData> {
  if (!isApplePayAvailable()) {
    return Promise.reject(
      new ApplePayError('unavailable', 'Apple Pay is only available in Safari'),
    );
  }

  const session = new window.ApplePaySession!(3, buildPaymentRequest(token));

  return new Promise<WalletPaymentMethodData>((resolve, reject) => {
    // The server already validated the merchant, so the session it fetched is
    // handed back to Apple as-is.
    session.onvalidatemerchant = () => {
      const merchantSession = token.session_token_data;
      if (!merchantSession) {
        session.abort();
        reject(new ApplePayError('failed', 'No validated merchant session'));
        return;
      }
      session.completeMerchantValidation(merchantSession);
    };

    session.onpaymentauthorized = event => {
      session.completePayment(window.ApplePaySession!.STATUS_SUCCESS);
      resolve(confirmBodyFor(event.payment));
    };

    session.oncancel = () => {
      reject(new ApplePayError('cancelled', 'Payment cancelled'));
    };

    session.begin();
  });
}

/**
 * The confirm body, in the shape the native demo sends.
 *
 * `paymentData` is the encrypted payload Apple returns; Hyperswitch takes it
 * base64-encoded, which is what the web checkout SDK sends too.
 */
function confirmBodyFor(payment: ApplePayJS.ApplePayPayment): WalletPaymentMethodData {
  const { paymentData, paymentMethod, transactionIdentifier } = payment.token;

  return {
    payment_method: 'wallet',
    payment_method_type: 'apple_pay',
    payment_method_data: {
      wallet: {
        apple_pay: {
          payment_data: btoa(JSON.stringify(paymentData)),
          payment_method: toSnakeCaseKeys(paymentMethod),
          transaction_identifier: transactionIdentifier,
        },
      },
    },
  };
}
