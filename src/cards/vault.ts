import { loadHyper } from '@juspay-tech/hyper-js';

import type { CreatePaymentResponse } from '../server/api';
import { toCamelCaseKeys } from '../wallets/keyCase';

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
 * The vault the profile uses, as the session takes it: `{vaultType, vaultData}`.
 *
 * Passing the vault outright tells the SDK which one to drive, so it performs
 * no payment-method-session lookup of its own.
 *
 * The payment carries it in `session_tokens.vault_details`, in the API's
 * snake_case, so it is read from there and camelCased — which also means a
 * profile on a vault other than Hyperswitch works without a change here. The
 * vault's own `sdk_authorization` is inside `vault_data`.
 *
 * The payment's top-level `sdk_authorization` is a different token — the
 * payment's, not the vault's — so it is never used here. A payment without
 * `vault_details` gets `null`, and no card fields.
 */
export function vaultDetailsFor(
  payment: CreatePaymentResponse | null,
): { vaultType: string; vaultData: Record<string, unknown> } | null {
  const raw = payment?.session_tokens?.vault_details;
  if (!raw?.vault_data) {
    return null;
  }

  return {
    vaultType: raw.vault_type ?? 'hyperswitch',
    vaultData: toCamelCaseKeys(raw.vault_data),
  };
}
