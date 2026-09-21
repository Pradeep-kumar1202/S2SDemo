'use client';

import { useMemo } from 'react';
import { HyperPaymentMethodSession } from '@juspay-tech/react-hyper-js';

import type { CreatePaymentResponse } from '../server/api';
import { getHyper, sdkAuthorizationFor } from './vault';

/**
 * The session every card field mounts inside.
 *
 * It carries the merchant identity (`hyper`) and the vault authorization, so a
 * form below it is just `<CardForm>` and its fields — the code never branches
 * on which vault the profile uses.
 */
export function CardSession({
  payment,
  children,
  onError,
}: {
  payment: CreatePaymentResponse;
  children: React.ReactNode;
  onError?: (error: unknown) => void;
}) {
  const sdkAuthorization = useMemo(() => sdkAuthorizationFor(payment), [payment]);
  const hyper = useMemo(
    () => getHyper(payment.publishable_key ?? ''),
    [payment.publishable_key],
  );

  if (!sdkAuthorization) {
    return (
      <p className="hint">
        This payment returned no vault details, so card fields cannot be shown.
      </p>
    );
  }

  return (
    <HyperPaymentMethodSession
      hyper={hyper}
      options={{ sdkAuthorization, appearance: APPEARANCE }}
      onError={onError}
    >
      {children}
    </HyperPaymentMethodSession>
  );
}

/**
 * Field styling, to match the dark theme of the surrounding page.
 *
 * The SDK draws the whole input — box, border and all — inside its iframe, so
 * these have to carry the design; a border on the container around it only
 * produces a second box nested inside the first. `borderColor` especially:
 * left unset the SDK falls back to a bright default that reads as a focus ring.
 */
const APPEARANCE = {
  /*
   * `variables.borderColor` is accepted and then ignored for this field
   * surface — the input keeps the SDK's own default (#e6e6e6), which on a dark
   * page reads as a bright outline. Every other variable below does apply, so
   * the border is restated as a rule, which does reach it.
   */
  rules: { '.Input': { border: '1px solid #2E4436' } },
  variables: {
    colorPrimary: '#21C25E',
    colorBackground: '#24362B',
    colorText: '#FFFFFF',
    colorTextPlaceholder: '#9CB0A4',
    borderColor: '#2E4436',
    borderRadius: '10px',
    /*
     * This sets the height of the field's *iframe*, not just the input inside
     * it (LoaderPaymentElement.res reads it straight into the iframe's style).
     * Every built-in SDK theme uses 48px and the field's contents are laid out
     * for it, so a smaller value leaves the document taller than its frame and
     * the field scrolls vertically inside itself.
     */
    inputFieldHeight: '48px',
    fontSizeBase: '15px',
    fontFamily: 'system-ui, sans-serif',
  },
};
