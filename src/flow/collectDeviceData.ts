import type { ConfirmPaymentResponse } from '../server/api';

/**
 * Step 5a — device data collection (DDC).
 *
 * Sequence diagram arrows implemented here:
 *
 *   App   <- Server      : next action (invoke_ddc)
 *   App   -> Issuer page : load iframe_url, out of sight
 *   App   <- Issuer page : postMessage(next_action)
 *
 * Before an issuer decides whether to challenge the player, it wants to know
 * about the device: screen size, timezone, what the browser supports. It
 * collects that itself, by loading a page of its own and reading the browser
 * from the inside — which is why this step exists at all, and why the demo
 * cannot just forward a few fields.
 *
 * So the confirm response says `invoke_ddc` and hands over a URL. The page
 * loads it in a **hidden** iframe — the player must not see it; nothing on it
 * is for them — and waits for that page to post a message back saying where to
 * go next. The answer is an ordinary `redirect_to_url` next action, so from
 * here the flow rejoins the path it already knows.
 *
 * Nothing is collected by this code. It provides a frame and a listener; the
 * issuer's page does the work.
 */

/**
 * What the SDKs use when `ddc_data.timeout_ms` is null, which it usually is.
 *
 * The whole point of a hidden step is that the player is staring at a spinner
 * while it runs, so it cannot wait forever — but the issuer's page can be slow,
 * and cutting it short fails a payment that would have gone through.
 */
const DEFAULT_TIMEOUT_MS = 300_000;

const IFRAME_ID = 'ddc-iframe';

/** The `ddc_data` the confirm response carries. */
export type DdcData = {
  iframe_url: string;
  timeout_ms?: number | null;
};

export type DeviceDataOutcome =
  /** Send the player here — an ordinary 3DS challenge or APM redirect. */
  | { kind: 'redirect'; url: string }
  /** DDC finished and no redirect is wanted; read the payment's status instead. */
  | { kind: 'no_redirect' }
  | { kind: 'failed'; message: string };

/**
 * Narrows the confirm response's `next_action` to a DDC request.
 *
 * Shaped like `redirectUrlOf` in `confirmDeposit.ts`: `next_action` is typed
 * `unknown`, because the server relays whatever Hyperswitch sent, so each
 * handler asks for the one shape it understands.
 */
export function invokeDdcOf(result: ConfirmPaymentResponse): DdcData | null {
  const action = asObject(result.next_action);
  if (action?.type !== 'invoke_ddc') {
    return null;
  }
  const data = asObject(action.ddc_data);
  return {
    iframe_url: typeof data?.iframe_url === 'string' ? data.iframe_url : '',
    timeout_ms: typeof data?.timeout_ms === 'number' ? data.timeout_ms : null,
  };
}

/**
 * Reads the message the DDC page posts back.
 *
 * Returns `null` for a message this step has no opinion about — which is most
 * of them. Any script in the page can post to this window, the card fields SDK
 * included, so a message without a `next_action` is ignored rather than treated
 * as a failed collection.
 *
 * The key names are read generously, in both spellings, because this is the one
 * place where another origin's code decides the shape.
 */
export function postDdcOutcome(raw: unknown): DeviceDataOutcome | null {
  const action = asObject(asObject(raw)?.next_action);
  if (!action) {
    return null;
  }

  const type = typeof action.type === 'string' ? action.type : '';
  // `url` is the key the page actually posts, and the plain `redirect_to_url`
  // next action uses it too, so it leads. The rest are spellings the reference
  // implementations also accept, kept so a different connector cannot stall the
  // flow on a renamed field.
  const url = firstString(
    action.url,
    action.post_ddc_redirect_url,
    action.postDdcRedirectUrl,
    action.redirect_to_url,
    action.redirectToUrl,
  );

  if (type !== 'redirect_to_url') {
    return {
      kind: 'failed',
      message: `Device data collection answered with ${
        type ? `\`${type}\`` : 'no action'
      }, which this demo cannot continue from.`,
    };
  }
  if (!url) {
    return {
      kind: 'failed',
      message: 'Device data collection answered without a URL to continue to.',
    };
  }

  // `if_required` means the redirect is only for a challenge, and none is
  // needed — so the player stays where they are and the payment is read
  // instead. Any other mode is a redirect to make.
  const mode = firstString(action.redirect_mode, action.redirectMode);
  return mode === 'if_required' ? { kind: 'no_redirect' } : { kind: 'redirect', url };
}

/**
 * Runs the collection and resolves once the page answers, or the clock runs out.
 *
 * Never rejects: a timeout and a nonsense answer are outcomes the deposit
 * reports, the same way a cancelled wallet sheet is. Whatever happens, the
 * iframe and the listener are removed exactly once — a payment can be retried,
 * and a leaked listener would make the next attempt resolve on a stale message.
 */
export function runDeviceDataCollection(
  ddc: DdcData,
): Promise<DeviceDataOutcome> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve({
      kind: 'failed',
      message: 'Device data collection needs a browser.',
    });
  }
  if (!ddc.iframe_url) {
    return Promise.resolve({
      kind: 'failed',
      message: 'Device data collection was asked for without a URL to load.',
    });
  }

  return new Promise<DeviceDataOutcome>(resolve => {
    let settled = false;
    let timer = 0;

    const iframe = document.createElement('iframe');

    const settle = (outcome: DeviceDataOutcome) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      iframe.remove();
      resolve(outcome);
    };

    function onMessage(event: MessageEvent) {
      const outcome = postDdcOutcome(event.data);
      if (outcome) {
        settle(outcome);
      }
    }

    window.addEventListener('message', onMessage);

    iframe.id = IFRAME_ID;
    iframe.title = 'Device data collection';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'display:none;width:1px;height:1px;border:0';
    iframe.src = ddc.iframe_url;
    document.body.appendChild(iframe);

    timer = window.setTimeout(
      () =>
        settle({
          kind: 'failed',
          message: 'The bank did not answer in time. Please try again.',
        }),
      ddc.timeout_ms ?? DEFAULT_TIMEOUT_MS,
    );
  });
}

/** The message may arrive as a JSON string or as an object; both are read. */
function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      return asObject(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/** The first of these that is a non-empty string. */
function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value !== '') {
      return value;
    }
  }
  return null;
}
