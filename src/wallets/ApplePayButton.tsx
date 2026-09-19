'use client';

import { useSyncExternalStore } from 'react';

/**
 * Apple's own Pay button.
 *
 * In Safari it needs no script: the browser draws the real button from the
 * `-apple-pay-button` appearance in CSS. No other browser supports that
 * appearance, and a button styled with it there renders as an empty grey box —
 * so outside Safari this falls back to a plain black Apple Pay button.
 *
 * The fallback is there so the demo shows the whole payment sheet anywhere,
 * including on localhost in Chrome. Pressing it reports why Apple Pay cannot
 * run rather than doing nothing.
 */
/**
 * The Apple logo, drawn rather than typed: the  glyph is an Apple
 * private-use character and renders as nothing outside Apple's own fonts.
 */
function AppleMark() {
  return (
    <svg viewBox="0 0 20 24" width="14" height="17" fill="currentColor" aria-hidden>
      <path d="M16.7 12.7c0-2.9 2.4-4.3 2.5-4.4-1.4-2-3.5-2.3-4.2-2.3-1.8-.2-3.5 1-4.4 1-.9 0-2.3-1-3.8-1-1.9 0-3.7 1.1-4.7 2.9-2 3.5-.5 8.6 1.4 11.4.9 1.4 2 2.9 3.5 2.9 1.4-.1 1.9-.9 3.6-.9s2.2.9 3.7.9c1.5 0 2.5-1.4 3.4-2.8 1.1-1.6 1.5-3.1 1.6-3.2-.1 0-3-1.2-3-4.5zM13.9 4c.8-.9 1.3-2.2 1.1-3.5-1.1.1-2.5.8-3.3 1.7-.7.8-1.3 2.1-1.2 3.3 1.3.1 2.6-.6 3.4-1.5z" />
    </svg>
  );
}

/** The appearance exists only in Safari; everywhere else this is false. */
const supportsAppleButton = () =>
  typeof CSS !== 'undefined' &&
  Boolean(CSS.supports?.('-webkit-appearance', '-apple-pay-button'));

/** Browser support does not change while the page is open. */
const subscribe = () => () => {};

export function ApplePayButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  // Read from the browser after hydration; the server has none to ask, so it
  // renders the fallback and the client swaps it in Safari.
  const native = useSyncExternalStore(subscribe, supportsAppleButton, () => false);

  if (native) {
    return (
      <button
        type="button"
        className="apple-pay-button"
        onClick={onPress}
        disabled={disabled}
        aria-label="Pay with Apple Pay"
      />
    );
  }

  return (
    <button
      type="button"
      className="apple-pay-fallback"
      onClick={onPress}
      disabled={disabled}
    >
      <AppleMark /> Pay
    </button>
  );
}
