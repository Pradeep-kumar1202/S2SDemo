import { Platform } from 'react-native';
import NativeGooglePay from '../../specs/NativeGooglePay';
import type { GooglePaySessionToken, WalletPaymentMethodData } from '../server/api';
import { toCamelCaseKeys, toSnakeCaseKeys } from './keyCase';

export type GooglePayEnvironment = 'TEST' | 'PRODUCTION';

export class GooglePayError extends Error {
  constructor(public code: 'cancelled' | 'failed' | 'unavailable', message: string) {
    super(message);
  }
}

export const isGooglePaySupported = () =>
  Platform.OS === 'android' && NativeGooglePay != null;

/** Sandbox publishable keys (pk_snd_) map to Google's TEST environment. */
export const googlePayEnvironment = (publishableKey: string): GooglePayEnvironment =>
  publishableKey.startsWith('pk_prd_') ? 'PRODUCTION' : 'TEST';

/** Converts the Hyperswitch session token into Google's PaymentDataRequest. */
export function buildPaymentDataRequest(token: GooglePaySessionToken) {
  const {
    allowed_payment_methods,
    transaction_info,
    merchant_info,
    email_required,
    shipping_address_required,
    shipping_address_parameters,
  } = token;
  return {
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: toCamelCaseKeys(allowed_payment_methods),
    transactionInfo: transactionInfoFor(transaction_info),
    merchantInfo: toCamelCaseKeys(merchant_info),
    ...(email_required != null ? { emailRequired: email_required } : {}),
    ...(shipping_address_required != null
      ? { shippingAddressRequired: shipping_address_required }
      : {}),
    ...(shipping_address_parameters != null
      ? { shippingAddressParameters: toCamelCaseKeys(shipping_address_parameters) }
      : {}),
  };
}

/**
 * Google requires `totalPriceStatus` to be one of NOT_CURRENTLY_KNOWN,
 * ESTIMATED or FINAL, and rejects the whole request with DEVELOPER_ERROR
 * otherwise. Hyperswitch spells it "Final", so it is upper-cased here.
 */
function transactionInfoFor(transactionInfo: GooglePaySessionToken['transaction_info']) {
  const info = toCamelCaseKeys<Record<string, unknown>>(transactionInfo);
  if (typeof info.totalPriceStatus === 'string') {
    info.totalPriceStatus = info.totalPriceStatus.toUpperCase();
  }
  return info;
}

/** IsReadyToPayRequest = PaymentDataRequest minus tokenization details. */
export function buildIsReadyToPayRequest(token: GooglePaySessionToken) {
  const allowedPaymentMethods = toCamelCaseKeys<any[]>(token.allowed_payment_methods).map(
    ({ tokenizationSpecification: _omit, ...method }) => method,
  );
  return { apiVersion: 2, apiVersionMinor: 0, allowedPaymentMethods };
}

export async function isReadyToPay(
  token: GooglePaySessionToken,
  environment: GooglePayEnvironment,
): Promise<boolean> {
  if (!NativeGooglePay) {
    return false;
  }
  return NativeGooglePay.isReadyToPay(
    JSON.stringify(buildIsReadyToPayRequest(token)),
    environment,
  );
}

/**
 * Presents the Google Pay sheet and returns the Hyperswitch confirm payload
 * for the selected card.
 */
export async function payWithGooglePay(
  token: GooglePaySessionToken,
  environment: GooglePayEnvironment,
): Promise<WalletPaymentMethodData> {
  if (!NativeGooglePay) {
    throw new GooglePayError('unavailable', 'Google Pay is only available on Android');
  }

  const result = (await NativeGooglePay.requestPayment(
    JSON.stringify({ paymentDataRequest: buildPaymentDataRequest(token), environment }),
  )) as { paymentMethodData?: string; error?: string };

  if (result.error || !result.paymentMethodData) {
    const message = result.error ?? 'Failure';
    throw new GooglePayError(message === 'Cancel' ? 'cancelled' : 'failed', message);
  }

  // PaymentData.toJson(): { apiVersion, apiVersionMinor, paymentMethodData, email?, shippingAddress? }
  const paymentData = JSON.parse(result.paymentMethodData);
  const pmd = toSnakeCaseKeys<any>(paymentData.paymentMethodData);

  return {
    payment_method: 'wallet',
    payment_method_type: 'google_pay',
    payment_method_data: {
      wallet: {
        google_pay: {
          type: pmd.type,
          description: pmd.description,
          info: {
            card_network: pmd.info?.card_network,
            card_details: pmd.info?.card_details,
            ...(pmd.info?.assurance_details
              ? { assurance_details: pmd.info.assurance_details }
              : {}),
          },
          tokenization_data: {
            type: pmd.tokenization_data?.type,
            token: pmd.tokenization_data?.token,
          },
        },
      },
    },
  };
}
