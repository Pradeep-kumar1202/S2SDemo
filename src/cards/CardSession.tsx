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

/** Field styling, to match the dark theme of the surrounding page. */
const APPEARANCE = {
  variables: {
    colorPrimary: '#21C25E',
    colorBackground: '#24362B',
    colorText: '#FFFFFF',
    colorTextPlaceholder: '#9CB0A4',
    borderRadius: '10px',
    fontFamily: 'system-ui, sans-serif',
  },
};
