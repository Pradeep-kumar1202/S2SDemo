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
 * The vault the profile uses, taken from the payment we already created:
 * session_tokens.vault_details is `{ vault_type, vault_data: { sdk_authorization } }`,
 * and the SDK wants the same thing camelCased. Passing it means the SDK does
 * no payment-method-session lookup of its own.
 */
export function vaultDetailsFor(
  payment: CreatePaymentResponse | null,
): VaultDetails | null {
  const raw = payment?.session_tokens?.vault_details;
  if (!raw?.vault_type) {
    return null;
  }
  return {
    vaultType: raw.vault_type,
    vaultData: toCamelCaseKeys(raw.vault_data ?? {}),
  };
}
