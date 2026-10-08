import { Linking } from 'react-native';

/**
 * Step 5b — coming back from an authentication.
 *
 * Sequence diagram arrows implemented here:
 *
 *   App   -> Issuer page : openURL(redirect_to_url)
 *   App   <- Issuer page : return_url, reopening the app
 *   App   -> Server      : GET /api/payments/{id}?force_sync=true
 *
 * A browser cannot navigate into an app. All it can do is hand a URL to the OS
 * and let whoever registered that scheme answer — which is why the way back is
 * a scheme of our own rather than an address.
 *
 * So the confirm call says where to come back to, and when the player is done
 * the issuer's page sends the browser there. The OS wakes the app with that URL
 * and the deposit finishes where it left off. Without it the player is left in
 * a browser tab with no way back, and the demo only notices because the app
 * happens to come forward again.
 */

/**
 * Where the issuer sends the player when authentication is done.
 *
 * Three places have to agree on this scheme, and nothing checks that they do:
 * this function, the intent filter in `android/app/src/main/AndroidManifest.xml`
 * and `CFBundleURLTypes` in `ios/S2SDemo/Info.plist`. A scheme nothing has
 * registered simply goes nowhere, with no error anywhere.
 *
 * A function rather than a constant because the web twin has to build its own
 * address at call time, and this way the two have the same call site to share.
 */
export function returnUrl(): string {
  return 'com.s2sdemo.hyperswitchs2s://deposit';
}

/**
 * The payment the returned URL names, or null for a URL that is not one of ours.
 *
 * The URL carries more than the id — a `status`, and an HMAC `signature` over
 * the lot. Neither is read here. A status in a query string is a claim by
 * whoever opened the URL, and checking the signature would need a secret the
 * app is not allowed to hold. The id is enough: the payment is then read back
 * with `force_sync`, and that answer is the only one worth reporting.
 *
 * Read with a plain scan rather than `URL`, which on a device is a hand-written
 * polyfill rather than the browser's parser, and a custom scheme is exactly
 * where the two are least alike. The web twin reads the same way, so the two
 * cannot drift.
 */
export function returnedPaymentId(url: string): string | null {
  const match = /[?&]payment_id=([^&#]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Calls `onReturn` with every return link, from either door. The returned
 * function unsubscribes.
 *
 * A return arrives one of two ways, and which one depends on what the player
 * did rather than on anything about the payment:
 *
 *   - the app was still alive behind the browser, so it is brought forward and
 *     the URL arrives as an event; or
 *   - the app had been killed, so the system starts it *for* the URL, and there
 *     was no listener yet to hear anything — the URL has to be asked for.
 *
 * Both are wired, because handling only the first works everywhere except on
 * the device where the player swiped the app away while paying.
 *
 * The waiting URL is asked for unconditionally rather than only when a payment
 * is known to be pending: after a cold start there is no such knowledge to
 * check against, since it died with the process.
 */
export function onReturnFromRedirect(
  onReturn: (url: string) => void,
): () => void {
  const subscription = Linking.addEventListener('url', ({ url }) =>
    onReturn(url),
  );
  Linking.getInitialURL().then(url => {
    if (url) {
      onReturn(url);
    }
  });
  return () => subscription.remove();
}
