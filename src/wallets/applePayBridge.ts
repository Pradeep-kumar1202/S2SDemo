/**
 * The checkout's side of the Apple Pay bridge.
 *
 * Framed on the merchant's page, the checkout cannot run Apple Pay itself: the
 * session has to live in the top-level window. The merchant page mounts
 * `public/apple-pay-bridge.js` from this domain, and everything here talks to
 * it — the message protocol is described there.
 *
 * Opened on its own, the checkout is the top-level window, and none of this is
 * used; see `isFramed`.
 */

/** What the sheet ended with, once the top window reports it. */
export type TopWindowOutcome =
  | { ok: true; payment: ApplePayJS.ApplePayPayment }
  | { ok: false; cancelled: boolean; message: string };

type BridgeMessage = Record<string, unknown> & { requestId?: unknown };

/** How long to wait for the bridge to answer before taking it as absent. */
const BRIDGE_TIMEOUT_MS = 3000;
/** The bridge may still be loading when first asked, so the question repeats. */
const BRIDGE_RETRY_MS = 300;

/** Whether this page is inside another, so Apple Pay must run in the top window. */
export function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Reading `top` only throws when it is cross-origin — framed, then.
    return true;
  }
}

/**
 * The top window's origin, which every message is sent to and checked against.
 *
 * `ancestorOrigins` names it outright, and Safari — the only browser Apple Pay
 * runs in — has it. Elsewhere the referrer stands in, which is right whenever
 * the checkout is framed directly by the top-level page.
 */
function topOrigin(): string | null {
  const ancestors = window.location.ancestorOrigins;
  if (ancestors && ancestors.length > 0) {
    return ancestors[ancestors.length - 1];
  }
  try {
    return new URL(document.referrer).origin;
  } catch {
    return null;
  }
}

function newRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Sends to the top window, and only if it is still on the expected origin. */
function post(message: BridgeMessage): boolean {
  const origin = topOrigin();
  if (!origin || !window.top) {
    return false;
  }
  window.top.postMessage(message, origin);
  return true;
}

/** Listens for the bridge's replies to one request. Returns the unsubscribe. */
function listen(
  requestId: string,
  handler: (data: BridgeMessage) => void,
): () => void {
  const origin = topOrigin();
  const onMessage = (event: MessageEvent) => {
    if (event.source !== window.top || event.origin !== origin) {
      return;
    }
    const data = event.data as BridgeMessage | null;
    if (data && typeof data === 'object' && data.requestId === requestId) {
      handler(data);
    }
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}

/**
 * Whether the top window can run Apple Pay.
 *
 * No answer within the timeout means the merchant page has not mounted the
 * bridge, and then Apple Pay cannot run at all — so that is a no.
 */
export function canMakePaymentsInTopWindow(): Promise<boolean> {
  const requestId = newRequestId();

  return new Promise<boolean>(resolve => {
    // Replies arrive as later message events, by which time everything below
    // is set up.
    const stop = listen(requestId, data => {
      if ('applePayCanMakePayments' in data) {
        done(data.applePayCanMakePayments === true);
      }
    });

    const ask = () => post({ hyperApplePayCanMakePayments: true, requestId });
    if (!ask()) {
      stop();
      resolve(false);
      return;
    }
    const retry = setInterval(ask, BRIDGE_RETRY_MS);
    const timeout = setTimeout(() => done(false), BRIDGE_TIMEOUT_MS);

    function done(answer: boolean) {
      clearInterval(retry);
      clearTimeout(timeout);
      stop();
      resolve(answer);
    }
  });
}

/**
 * Has the top window present the sheet, and resolves with what the player did.
 *
 * Must be called straight from the tap, with nothing awaited first: the click
 * message is what lets Safari open the session in the top window.
 *
 * `merchantSession` is handed over only when Apple asks for it, so it is free
 * to still be in flight when this starts.
 */
export function startApplePayInTopWindow(
  paymentRequest: ApplePayJS.ApplePayPaymentRequest,
  merchantSession: Promise<unknown>,
): Promise<TopWindowOutcome> {
  const requestId = newRequestId();

  return new Promise<TopWindowOutcome>(resolve => {
    const stop = listen(requestId, data => {
      if (data.applePayValidateMerchant) {
        merchantSession.then(
          session =>
            post(
              session
                ? { applePayMerchantSession: session, requestId }
                : {
                    applePayMerchantSessionError: 'No validated merchant session',
                    requestId,
                  },
            ),
          error =>
            post({
              applePayMerchantSessionError:
                error instanceof Error ? error.message : String(error),
              requestId,
            }),
        );
      } else if ('applePayPaymentToken' in data) {
        stop();
        resolve({
          ok: true,
          payment: {
            token: data.applePayPaymentToken,
            billingContact: data.applePayBillingContact ?? undefined,
            shippingContact: data.applePayShippingContact ?? undefined,
          } as ApplePayJS.ApplePayPayment,
        });
      } else if (data.showApplePayButton) {
        stop();
        resolve({
          ok: false,
          cancelled: data.applePayCancelled === true,
          message:
            typeof data.applePayError === 'string'
              ? data.applePayError
              : 'Payment cancelled',
        });
      }
    });

    const sent = post({
      hyperApplePayButtonClicked: true,
      paymentRequest,
      requestId,
    });
    if (!sent) {
      stop();
      resolve({
        ok: false,
        cancelled: false,
        message: 'Apple Pay needs the merchant page to mount apple-pay-bridge.js',
      });
    }
  });
}
