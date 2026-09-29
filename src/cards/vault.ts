import {
  Hyperswitch,
  type HyperswitchInstance,
  type VaultDetails,
} from '@juspay-tech/react-native-hyperswitch-payment-methods';

import type { CreatePaymentResponse } from '../server/api';
import { toCamelCaseKeys } from '../wallets/keyCase';

/** Sandbox publishable keys (pk_snd_) talk to the sandbox host. */
const environmentFor = (publishableKey: string) =>
  publishableKey.startsWith('pk_prd_') ? ('PROD' as const) : ('SANDBOX' as const);

let instance: Promise<HyperswitchInstance> | null = null;
let instanceKey: string | null = null;

/**
 * The SDK instance is created once and reused. The publishable key only
 * arrives with the payment, so this memoizes on it instead of running at
 * module scope.
 */
export function getHyper(publishableKey: string): Promise<HyperswitchInstance> {
  if (!instance || instanceKey !== publishableKey) {
    instanceKey = publishableKey;
    instance = Hyperswitch.init({
      publishableKey,
      environment: environmentFor(publishableKey),
    });
  }
  return instance;
}

/**
 * The vault the profile uses, taken from the payment the server already created.
 * Passing it means the SDK does no payment-method-session lookup of its own.
 *
 * It arrives as `session_tokens.vault_details` in the API's snake_case, so it is
 * read from there and camelCased — which also means a profile on a vault other
 * than Hyperswitch works without a change here. Some responses carry only the
 * top-level `sdk_authorization` instead, and that is the fallback.
 */
export function vaultDetailsFor(
  payment: CreatePaymentResponse | null,
): VaultDetails | null {
  const raw = payment?.session_tokens?.vault_details;
  if (raw?.vault_type) {
    return {
      vaultType: raw.vault_type,
      vaultData: toCamelCaseKeys(raw.vault_data ?? {}),
    };
  }

  const sdkAuthorization = payment?.sdk_authorization;
  if (typeof sdkAuthorization === 'string' && sdkAuthorization !== '') {
    return {
      vaultType: 'hyperswitch',
      vaultData: { sdkAuthorization },
    };
  }

  return null;
}
