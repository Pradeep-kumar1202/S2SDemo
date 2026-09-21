import type { GooglePaySessionToken, WalletPaymentMethodData } from '../server/api';
import { toCamelCaseKeys, toSnakeCaseKeys } from './keyCase';

/**
 * Google Pay on the web, driven by the session token the server fetched.
 *
 * The same shape as the native demo's wallet path, and for the same reason: the
 * app does not build the payment request, it hands Google the token Hyperswitch
 * minted. The one thing it changes is the auth methods: this demo takes network
 * tokens only, so `allowed_payment_methods` is cut down to `CRYPTOGRAM_3DS` —
 * see `networkTokenPaymentMethods`.
 *
 * What comes back goes to the merchant server, which confirms it — the browser
 * never confirms the payment itself.
 */

export type GooglePayEnvironment = 'TEST' | 'PRODUCTION';

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

/** The session's allowed payment methods in Google's shape, auth methods untouched. */
export function allowedPaymentMethodsOf(
  token: GooglePaySessionToken,
): Record<string, unknown>[] {
  return toCamelCaseKeys<Record<string, unknown>[]>(
    token.allowed_payment_methods ?? [],
  );
}

/** The auth method that yields a network token rather than the card number. */
const CRYPTOGRAM_3DS = 'CRYPTOGRAM_3DS';

/**
 * The session's payment methods, keeping network tokens only.
 *
 * Google Pay returns one of two things, depending on the auth method: a network
 * token (`CRYPTOGRAM_3DS`) or the card number itself (`PAN_ONLY`). The profile
 * may allow both; this demo takes network tokens only. So each method keeps
 * `CRYPTOGRAM_3DS` and nothing else, and a method that allows only `PAN_ONLY`
 * is dropped entirely.
 *
 * Both requests to Google are built from this, never from the unfiltered list.
 * Asking `isReadyToPay` about PAN_ONLY and then opening a sheet that allows only
 * CRYPTOGRAM_3DS is what produces "this merchant doesn't accept any of your
 * available payment methods": the button appears, and the sheet then has nothing
 * to offer.
 */
export function networkTokenPaymentMethods(
  token: GooglePaySessionToken,
): Record<string, unknown>[] {
  return allowedPaymentMethodsOf(token).flatMap(method => {
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
}

/** Whether the session allows a network token at all. PAN_ONLY alone does not. */
export function supportsNetworkToken(token: GooglePaySessionToken): boolean {
  return networkTokenPaymentMethods(token).length > 0;
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
    allowedPaymentMethods: networkTokenPaymentMethods(token),
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

/**
 * IsReadyToPayRequest = the network-token methods, minus tokenization
 * details.
 *
 * It must ask with exactly what `buildPaymentDataRequest` will request; see
 * `networkTokenPaymentMethods` for why a wider question here breaks the sheet.
 */
export function buildIsReadyToPayRequest(token: GooglePaySessionToken) {
  const allowedPaymentMethods = networkTokenPaymentMethods(token).map(
    ({ tokenizationSpecification: _omit, ...method }) => method,
  );
  return { apiVersion: 2, apiVersionMinor: 0, allowedPaymentMethods };
}

export async function isReadyToPay(
  token: GooglePaySessionToken,
  environment: GooglePayEnvironment,
): Promise<boolean> {
  // A session that allows only PAN_ONLY has nothing this demo accepts, so there
  // is no Google Pay to offer — and no reason to ask Google.
  if (!supportsNetworkToken(token)) {
    return false;
  }
  try {
    const api = await paymentsClient(environment);
    const result = await api.isReadyToPay(
      buildIsReadyToPayRequest(token) as unknown as google.payments.api.IsReadyToPayRequest,
    );
    return Boolean(result.result);
  } catch (error) {
    // Hiding the wallet on a thrown probe is right, but silence makes a
    // misbuilt request (DEVELOPER_ERROR) look identical to "no cards here".
    console.warn('Google Pay isReadyToPay failed', error);
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
