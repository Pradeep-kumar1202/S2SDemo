import type { GooglePaySessionToken, WalletPaymentMethodData } from '../server/api';
import { toCamelCaseKeys, toSnakeCaseKeys } from './keyCase';

/**
 * Google Pay on the web, driven by the session token the server fetched.
 *
 * The same shape as the native demo's wallet path, and for the same reason: the
 * app does not build the payment request, it hands Google the token Hyperswitch
 * minted. What comes back is a network token, which the merchant server
 * confirms — the browser never confirms the payment itself.
 */

export type GooglePayEnvironment = 'TEST' | 'PRODUCTION';

/** The auth method that yields a network token rather than a raw PAN. */
const CRYPTOGRAM_3DS = 'CRYPTOGRAM_3DS';

/** Sandbox publishable keys (pk_snd_) map to Google's TEST environment. */
export const googlePayEnvironment = (
  publishableKey: string,
): GooglePayEnvironment =>
  publishableKey.startsWith('pk_prd_') ? 'PRODUCTION' : 'TEST';

const SCRIPT_SRC = 'https://pay.google.com/gp/p/js/pay.js';
let scriptPromise: Promise<void> | null = null;

/** Loads Google's pay.js once, on demand. */
function loadGooglePayScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Pay needs a browser'));
  }
  if (window.google?.payments?.api) {
    return Promise.resolve();
  }
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load Google Pay'));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

let client: google.payments.api.PaymentsClient | null = null;
let clientEnvironment: GooglePayEnvironment | null = null;

/** One PaymentsClient per environment, created after pay.js has loaded. */
export async function paymentsClient(
  environment: GooglePayEnvironment,
): Promise<google.payments.api.PaymentsClient> {
  await loadGooglePayScript();
  if (!client || clientEnvironment !== environment) {
    clientEnvironment = environment;
    client = new window.google!.payments.api.PaymentsClient({ environment });
  }
  return client;
}

/**
 * Google Pay returns one of two things depending on the auth method the card
 * supports: a network token (`CRYPTOGRAM_3DS`) or the raw card number
 * (`PAN_ONLY`). This demo takes network tokens only, so:
 *
 *   - a session offering both is narrowed to `CRYPTOGRAM_3DS`, and
 *   - a session offering only `PAN_ONLY` leaves nothing usable, which is
 *     reported as "not available" so Google Pay is not offered at all.
 *
 * Returns the allowed payment methods with the auth methods narrowed, or null
 * when no method can produce a network token.
 */
export function cryptogramOnlyPaymentMethods(
  token: GooglePaySessionToken,
): Record<string, unknown>[] | null {
  const methods = toCamelCaseKeys<Record<string, unknown>[]>(
    token.allowed_payment_methods ?? [],
  );

  const narrowed = methods.flatMap(method => {
    const parameters = (method.parameters ?? {}) as Record<string, unknown>;
    const authMethods = parameters.allowedAuthMethods;
    if (!Array.isArray(authMethods) || !authMethods.includes(CRYPTOGRAM_3DS)) {
      return [];
    }
    return [
      {
        ...method,
        parameters: { ...parameters, allowedAuthMethods: [CRYPTOGRAM_3DS] },
      },
    ];
  });

  return narrowed.length > 0 ? narrowed : null;
}

/** Whether this session can produce a network token at all. */
export function supportsCryptogram3ds(token: GooglePaySessionToken): boolean {
  return cryptogramOnlyPaymentMethods(token) != null;
}

/** Converts the Hyperswitch session token into Google's PaymentDataRequest. */
export function buildPaymentDataRequest(token: GooglePaySessionToken) {
  const {
    transaction_info,
    merchant_info,
    email_required,
    shipping_address_required,
    shipping_address_parameters,
  } = token;
  return {
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: cryptogramOnlyPaymentMethods(token) ?? [],
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
  const allowedPaymentMethods = (cryptogramOnlyPaymentMethods(token) ?? []).map(
    ({ tokenizationSpecification: _omit, ...method }) => method,
  );
  return { apiVersion: 2, apiVersionMinor: 0, allowedPaymentMethods };
}

export async function isReadyToPay(
  token: GooglePaySessionToken,
  environment: GooglePayEnvironment,
): Promise<boolean> {
  // A PAN_ONLY-only session is treated as no Google Pay at all.
  if (!supportsCryptogram3ds(token)) {
    return false;
  }
  try {
    const api = await paymentsClient(environment);
    const result = await api.isReadyToPay(
      buildIsReadyToPayRequest(token) as unknown as google.payments.api.IsReadyToPayRequest,
    );
    return Boolean(result.result);
  } catch {
    return false;
  }
}

/** Thrown for a cancelled or failed sheet, mirroring the native demo. */
export class GooglePayError extends Error {
  constructor(
    public code: 'cancelled' | 'failed',
    message: string,
  ) {
    super(message);
  }
}

/**
 * Presents the Google Pay sheet and returns the confirm body for the card the
 * player authorised.
 */
export async function payWithGooglePay(
  token: GooglePaySessionToken,
  environment: GooglePayEnvironment,
): Promise<WalletPaymentMethodData> {
  const api = await paymentsClient(environment);

  let paymentData: google.payments.api.PaymentData;
  try {
    paymentData = await api.loadPaymentData(
      buildPaymentDataRequest(token) as unknown as google.payments.api.PaymentDataRequest,
    );
  } catch (error) {
    const reason = (error as { statusCode?: string })?.statusCode;
    throw new GooglePayError(
      reason === 'CANCELED' ? 'cancelled' : 'failed',
      reason ?? 'Google Pay failed',
    );
  }

  // paymentMethodData is camelCase from Google; Hyperswitch wants snake_case.
  const pmd = toSnakeCaseKeys<{
    type?: string;
    description?: string;
    info?: Record<string, unknown>;
    tokenization_data?: { type?: string; token?: string };
  }>(paymentData.paymentMethodData);

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
