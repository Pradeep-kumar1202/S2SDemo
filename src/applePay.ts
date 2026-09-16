import { Platform } from 'react-native';
import NativeApplePay from '../specs/NativeApplePay';
import type { ApplePaySessionToken, WalletPaymentMethodData } from './api';

export class ApplePayError extends Error {
  constructor(public code: 'cancelled' | 'failed' | 'unavailable', message: string) {
    super(message);
  }
}

type ApplePayResult =
  | {
      status: 'Success';
      payment_data: string;
      payment_method: { type: string; network: string; display_name: string };
      transaction_identifier: string;
      billing_contact?: Record<string, unknown>;
      shipping_contact?: Record<string, unknown>;
    }
  | { status: 'Failed' | 'Cancelled'; message?: string };

export const isApplePaySupported = () =>
  Platform.OS === 'ios' && NativeApplePay != null;

export async function canMakePayments(): Promise<boolean> {
  if (!NativeApplePay) {
    return false;
  }
  return NativeApplePay.canMakePayments();
}

/**
 * Presents the Apple Pay sheet and returns the Hyperswitch confirm payload
 * for the authorized payment.
 */
export async function payWithApplePay(
  token: ApplePaySessionToken,
): Promise<WalletPaymentMethodData> {
  if (!NativeApplePay) {
    throw new ApplePayError('unavailable', 'Apple Pay is only available on iOS');
  }

  // The native handler reads `payment_request_data` from the session token as-is.
  const result = (await NativeApplePay.startPayment(JSON.stringify(token))) as ApplePayResult;

  if (result.status !== 'Success') {
    const message = result.message ?? result.status;
    throw new ApplePayError(result.status === 'Cancelled' ? 'cancelled' : 'failed', message);
  }

  return {
    payment_method: 'wallet',
    payment_method_type: 'apple_pay',
    payment_method_data: {
      wallet: {
        apple_pay: {
          payment_data: result.payment_data,
          payment_method: result.payment_method,
          transaction_identifier: result.transaction_identifier,
        },
      },
    },
  };
}
