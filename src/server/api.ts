import { SERVER_URL } from './config';

export type SdkNextAction = {
  next_action: string;
  should_block_confirm?: boolean | null;
};

export type GooglePaySessionToken = {
  wallet_name: 'google_pay';
  connector: string;
  delayed_session_token?: boolean;
  sdk_next_action?: SdkNextAction;
  merchant_info: { merchant_name: string; merchant_id?: string };
  allowed_payment_methods: unknown[];
  transaction_info: {
    country_code: string;
    currency_code: string;
    total_price_status: string;
    total_price: string;
  };
  shipping_address_required?: boolean;
  email_required?: boolean;
  shipping_address_parameters?: unknown;
};

export type ApplePaySessionToken = {
  wallet_name: 'apple_pay';
  connector: string;
  delayed_session_token?: boolean;
  sdk_next_action?: SdkNextAction;
  payment_request_data: {
    country_code: string;
    currency_code: string;
    total: { label: string; type: string; amount: string };
    merchant_capabilities: string[];
    supported_networks: string[];
    merchant_identifier: string;
    required_billing_contact_fields?: string[];
    required_shipping_contact_fields?: string[];
  } | null;
  session_token_data?: unknown;
};

export type SessionToken =
  | GooglePaySessionToken
  | ApplePaySessionToken
  | { wallet_name: string; [key: string]: unknown };

/** A method the merchant has enabled for this profile. */
export type EnabledPaymentMethod = {
  payment_method: string;
  payment_method_type: string;
  card_networks?: string[] | null;
  payment_experience?: string[] | null;
  collect_shipping_details_from_wallets?: boolean | null;
  collect_billing_details_from_wallets?: boolean | null;
};

export type SavedCard = {
  scheme?: string | null;
  issuer_country?: string | null;
  issuer_country_code?: string | null;
  last4_digits: string;
  expiry_month: string;
  expiry_year: string;
  card_holder_name?: string | null;
  nick_name?: string | null;
  card_network?: string | null;
  card_issuer?: string | null;
  card_type?: string | null;
};

/** A card already saved against the customer, usable with its payment_token. */
export type CustomerPaymentMethod = {
  payment_token: string;
  payment_method: string;
  payment_method_type: string;
  default_payment_method_set?: boolean;
  requires_cvv?: boolean;
  created?: string;
  last_used_at?: string;
  recurring_enabled?: boolean;
  payment_method_data?: { card?: SavedCard };
};

export type PaymentMethodList = {
  payment_methods_enabled: EnabledPaymentMethod[];
  customer_payment_methods: CustomerPaymentMethod[];
  sdk_next_action?: SdkNextAction;
  intent_data?: {
    payment_id: string;
    status: string;
    amount: number;
    currency: string;
    client_secret: string;
    customer_id?: string | null;
    merchant_name?: string;
    [key: string]: unknown;
  };
};

export type CreatePaymentResponse = {
  payment_id: string;
  status: string;
  amount: number;
  currency: string;
  client_secret: string;
  customer_id?: string | null;
  profile_id?: string;
  publishable_key: string;
  payment_method_list: PaymentMethodList;
  session_tokens: {
    payment_id: string;
    client_secret: string;
    session_token: SessionToken[];
    /** Vault the Hosted Card Fields SDK should drive, in Hyperswitch's wire shape. */
    vault_details?: {
      vault_type: 'hyperswitch' | 'vgs' | 'skyflow' | 'basis_theory' | 'evervault';
      vault_data?: Record<string, unknown>;
    };
  };
  [key: string]: unknown;
};

export type ConfirmPaymentResponse = {
  payment_id: string;
  status: string;
  amount?: number;
  currency?: string;
  error_code?: string | null;
  error_message?: string | null;
  next_action?: unknown;
  [key: string]: unknown;
};

export type WalletPaymentMethodData = {
  payment_method: 'wallet';
  payment_method_type: 'google_pay' | 'apple_pay';
  payment_method_data: {
    wallet: Record<string, unknown>;
    billing?: unknown;
  };
};

/**
 * Confirm body for a card collected by the Hosted Card Fields SDK.
 *
 * `tokenize()` hands back the vault's tokens; they are spread into the confirm
 * body, alongside `payment_token` when an existing saved card was re-collected.
 */
export type CardTokenPaymentData = {
  payment_method: 'card';
  payment_method_type: string;
  payment_token?: string;
} & Record<string, unknown>;

export type ConfirmPaymentData = WalletPaymentMethodData | CardTokenPaymentData;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${errorMessageOf(data) ?? `HTTP ${res.status}`} (${path})`);
  }
  return data as T;
}

/** The server reports failures as { error } or { error: { message } }. */
function errorMessageOf(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('error' in data)) {
    return null;
  }
  const error = (data as { error: unknown }).error;
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return null;
}

/** Creates a payment and returns its payment method list + wallet session tokens. */
export function createPayment(): Promise<CreatePaymentResponse> {
  return request('/api/create-payment');
}

/**
 * Updates the payment intent with the amount the player entered, and returns
 * the refreshed payment data (session tokens, vault details, method list).
 */
export function updatePayment(
  paymentId: string,
  amount: number,
): Promise<CreatePaymentResponse> {
  return request('/api/update-payment', {
    method: 'POST',
    body: JSON.stringify({ payment_id: paymentId, amount }),
  });
}

/** Confirms a payment with a wallet token or a saved-card token. */
export function confirmPayment(
  paymentId: string,
  body: ConfirmPaymentData & Record<string, unknown>,
): Promise<ConfirmPaymentResponse> {
  return request('/api/confirm-payment', {
    method: 'POST',
    body: JSON.stringify({ payment_id: paymentId, ...body }),
  });
}
