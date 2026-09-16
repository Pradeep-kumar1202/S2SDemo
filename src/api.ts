import { SERVER_URL } from './config';

export type SdkNextAction = {
  next_action: string;
  should_block_confirm?: boolean;
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
  };
  session_token_data?: unknown;
};

export type SessionToken =
  | GooglePaySessionToken
  | ApplePaySessionToken
  | { wallet_name: string; [key: string]: unknown };

export type CreatePaymentResponse = {
  payment_id: string;
  client_secret: string;
  publishable_key: string;
  profile_id: string;
  customer_id: string;
  payment: {
    payment_id: string;
    status: string;
    amount: number;
    currency: string;
    [key: string]: unknown;
  };
  client: unknown;
  session_tokens: {
    payment_id: string;
    client_secret: string;
    session_token: SessionToken[];
    vault_details?: unknown;
  };
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message =
      data?.details?.error?.message ?? data?.error ?? `HTTP ${res.status}`;
    throw new Error(`${message} (${path})`);
  }
  return data as T;
}

/** Creates a payment and fetches client data + wallet session tokens. */
export function createPayment(
  overrides: Record<string, unknown> = {},
): Promise<CreatePaymentResponse> {
  return request('/api/create-payment', {
    method: 'POST',
    body: JSON.stringify(overrides),
  });
}

/** Confirms a payment with the wallet token obtained from Google Pay / Apple Pay. */
export function confirmPayment(
  paymentId: string,
  body: WalletPaymentMethodData & Record<string, unknown>,
): Promise<ConfirmPaymentResponse> {
  return request('/api/confirm-payment', {
    method: 'POST',
    body: JSON.stringify({ payment_id: paymentId, ...body }),
  });
}

/** Retrieves the current state of a payment. */
export function getPayment(paymentId: string): Promise<ConfirmPaymentResponse> {
  return request(`/api/payments/${encodeURIComponent(paymentId)}`);
}
