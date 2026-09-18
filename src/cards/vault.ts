import { loadHyper } from '@juspay-tech/hyper-js';

import type { CreatePaymentResponse } from '../server/api';

/**
 * The SDK instance, created once and reused.
 *
 * `loadHyper` fetches the hosted card fields' iframe bundle, so calling it per
 * render would re-download it. The publishable key only arrives with the
 * payment, so this memoizes on the key rather than running at module scope.
 */
let instance: Promise<unknown> | null = null;
let instanceKey: string | null = null;

export function getHyper(publishableKey: string): Promise<unknown> {
  if (!instance || instanceKey !== publishableKey) {
    instanceKey = publishableKey;
    instance = loadHyper(publishableKey);
  }
  return instance;
}

/**
 * The vault authorization the Cards SDK needs, taken from the payment the
 * server already created: `session_tokens.vault_details.vault_data`.
 *
 * Passing this means the SDK does no payment-method-session lookup of its own.
 */
export function sdkAuthorizationFor(
  payment: CreatePaymentResponse | null,
): string | null {
  const data = payment?.session_tokens?.vault_details?.vault_data;
  const authorization = data?.sdk_authorization;
  return typeof authorization === 'string' ? authorization : null;
}
