'use client';

import { useEffect, useRef } from 'react';

import { googlePayEnvironment, paymentsClient } from './googlePay';

/**
 * Google's own Pay button.
 *
 * Google requires their rendered button rather than a lookalike, so this mounts
 * the one `createButton` returns into a container div.
 */
export function GooglePayButton({
  publishableKey,
  onPress,
  disabled,
}: {
  publishableKey: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  // The button is created once, so it calls through a ref to reach the latest
  // handler rather than capturing the first one.
  const handler = useRef(onPress);

  useEffect(() => {
    handler.current = onPress;
  }, [onPress]);

  useEffect(() => {
    let cancelled = false;

    paymentsClient(googlePayEnvironment(publishableKey))
      .then(api => {
        if (cancelled || !host.current || host.current.childElementCount > 0) {
          return;
        }
        host.current.appendChild(
          api.createButton({
            onClick: () => handler.current(),
            buttonType: 'pay',
            buttonSizeMode: 'fill',
            buttonColor: 'white',
          }),
        );
      })
      .catch(() => {
        // Availability is decided before this renders; a load failure here just
        // leaves the slot empty rather than breaking the sheet.
      });

    return () => {
      cancelled = true;
    };
  }, [publishableKey]);

  return (
    <div
      ref={host}
      className="gpay-button"
      aria-disabled={disabled}
      style={disabled ? { opacity: 0.45, pointerEvents: 'none' } : undefined}
    />
  );
}
