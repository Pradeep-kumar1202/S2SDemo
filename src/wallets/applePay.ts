import type {
  ApplePaySessionToken,
  WalletPaymentMethodData,
} from "../server/api";
import {
  canMakePaymentsInTopWindow,
  isFramed,
  startApplePayInTopWindow,
} from "./applePayBridge";
import { toCamelCaseKeys, toSnakeCaseKeys } from "./keyCase";

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
 * 3. **It does not run in the checkout's iframe.** The checkout is framed on the
 *    merchant's page, from another domain, so the session runs in the top-level
 *    window instead, through `public/apple-pay-bridge.js` — see
 *    `applePayBridge.ts`. The verified domain is then the merchant page's.
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
    public code: "cancelled" | "failed" | "unavailable",
    message: string,
  ) {
    super(message);
  }
}

/**
 * Safari with a card set up, and nothing else — in this window. Framed, the
 * window that matters is the top one; see `applePayAvailability`.
 */
export function isApplePayAvailable(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.ApplePaySession !== "undefined" &&
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
export async function canPayWithApplePay(
  token: ApplePaySessionToken | undefined,
): Promise<boolean> {
  const session = token?.session_token_data;
  const hasMerchantSession =
    session != null &&
    typeof session === "object" &&
    Object.keys(session).length > 0;
  return (
    hasMerchantSession &&
    token?.payment_request_data != null &&
    (await applePayAvailability())
  );
}

/**
 * Whether Apple Pay can run where the sheet will open: this window, or — when
 * the checkout is framed — the top one, asked through the bridge.
 */
export function applePayAvailability(): Promise<boolean> {
  return isFramed()
    ? canMakePaymentsInTopWindow()
    : Promise.resolve(isApplePayAvailable());
}

/**
 * Apple's PaymentRequest, from the session token.
 *
 * `merchant_identifier` is dropped: it belongs to the merchant session, not to
 * the request, and Apple rejects requests carrying unknown keys.
 *
 * `amount` overrides the token's total, for when the player's amount has moved
 * on and the token minted for it is still on its way.
 */
export function buildPaymentRequest(
  token: ApplePaySessionToken,
  amount?: string,
) {
  const data = token.payment_request_data;
  if (!data) {
    throw new ApplePayError(
      "failed",
      "This payment has no Apple Pay request data",
    );
  }
  const { merchant_identifier: _merchantIdentifier, ...request } = data;
  const total =
    amount === undefined ? request.total : { ...request.total, amount };
  return toCamelCaseKeys<ApplePayJS.ApplePayPaymentRequest>({
    ...request,
    total,
  });
}

/**
 * Presents the Apple Pay sheet and returns the confirm body for the card the
 * player authorised.
 *
 * `merchantSession` is what `onvalidatemerchant` hands Apple. By default it is
 * the token's own `session_token_data`; a caller whose token is being replaced
 * passes a promise of the new one instead. Apple only asks for it once the
 * sheet is already open, so it is free to still be in flight when this starts.
 *
 * Framed, the top window opens the sheet and this only builds the request and
 * reads back the result; the session itself never exists here.
 */
export function payWithApplePay(
  token: ApplePaySessionToken,
  {
    amount,
    merchantSession = Promise.resolve(token.session_token_data),
  }: { amount?: string; merchantSession?: Promise<unknown> } = {},
): Promise<WalletPaymentMethodData> {
  if (isFramed()) {
    // Posted at once, still inside the tap — the top window needs it to be.
    return startApplePayInTopWindow(
      buildPaymentRequest(token, amount),
      merchantSession,
    ).then((outcome) => {
      if (!outcome.ok) {
        throw new ApplePayError(
          outcome.cancelled ? "cancelled" : "failed",
          outcome.message,
        );
      }
      return confirmBodyFor(outcome.payment);
    });
  }

  if (!isApplePayAvailable()) {
    return Promise.reject(
      new ApplePayError("unavailable", "Apple Pay is only available in Safari"),
    );
  }

  // Created here, synchronously, and on no account after an await: Safari only
  // allows an ApplePaySession to be made while it is handling the tap itself.
  const session = new window.ApplePaySession!(
    3,
    buildPaymentRequest(token, amount),
  );

  return new Promise<WalletPaymentMethodData>((resolve, reject) => {
    // The server validates the merchant, never this page, so the session it
    // fetched is handed back to Apple as-is — once it has arrived.
    session.onvalidatemerchant = async () => {
      try {
        const validated = await merchantSession;
        if (!validated) {
          throw new ApplePayError("failed", "No validated merchant session");
        }
        session.completeMerchantValidation(validated);
      } catch (error) {
        // Record the real reason before ending the session: abort() can raise a
        // cancel of its own, and only the first outcome counts. abort() rather
        // than rethrowing, because a throw here tells Apple nothing — the sheet
        // would wait on validation until Safari times it out.
        reject(
          error instanceof ApplePayError
            ? error
            : new ApplePayError("failed", messageOf(error)),
        );
        session.abort();
      }
    };

    session.onpaymentauthorized = (event) => {
      session.completePayment(window.ApplePaySession!.STATUS_SUCCESS);
      resolve(confirmBodyFor(event.payment));
    };

    session.oncancel = () => {
      reject(new ApplePayError("cancelled", "Payment cancelled"));
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
function confirmBodyFor(
  payment: ApplePayJS.ApplePayPayment,
): WalletPaymentMethodData {
  const { paymentData, paymentMethod, transactionIdentifier } = payment.token;

  return {
    payment_method: "wallet",
    payment_method_type: "apple_pay",
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

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
