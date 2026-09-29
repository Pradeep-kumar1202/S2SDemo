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
 * The vault authorization the Cards SDK needs, taken from the payment the
 * server already created: `session_tokens.vault_details.vault_data`.
 *
 * Passing this means the SDK does no payment-method-session lookup of its own.
 */
/**
 * The vault the profile uses, as the session takes it: `{vaultType, vaultData}`.
 *
 * Passing the vault outright tells the SDK which one to drive, so it performs
 * no payment-method-session lookup of its own.
 *
 * The payment carries it in `session_tokens.vault_details`, in the API's
 * snake_case, so it is read from there and camelCased — which also means a
 * profile on a vault other than Hyperswitch works without a change here. Some
 * responses carry only the top-level `sdk_authorization` instead, and that is
 * the fallback.
 */
export function vaultDetailsFor(
  payment: CreatePaymentResponse | null,
): { vaultType: string; vaultData: Record<string, unknown> } | null {
  const raw = payment?.session_tokens?.vault_details;
  if (raw?.vault_type) {
    return {
      vaultType: raw.vault_type,
      vaultData: toCamelCaseKeys(raw.vault_data ?? {}),
    };
  }

  const sdkAuthorization = payment?.sdk_authorization;
  if (typeof sdkAuthorization === 'string' && sdkAuthorization !== '') {
    return { vaultType: 'hyperswitch', vaultData: { sdkAuthorization } };
  }

  return null;
}
