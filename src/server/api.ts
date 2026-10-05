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
  /**
   * Present when create/update was sent with `X-Integration-Type: server`;
   * it is the Cards SDK's authorization, and replaces the vault_details blob a
   * separate session-tokens call returns.
   */
  sdk_authorization?: string;
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

/**
 * Confirm body for a method with no fields to collect, such as an Interac bank
 * redirect: the method and type are the whole instrument, nested the way
 * Hyperswitch reads them — `{ bank_redirect: { interac: {} } }`.
 */
export type NoFieldsPaymentData = {
  payment_method: string;
  payment_method_type: string;
  payment_method_data: Record<string, Record<string, Record<string, never>>>;
};

export type ConfirmPaymentData =
  | WalletPaymentMethodData
  | CardTokenPaymentData
  | NoFieldsPaymentData;

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
      data?.error?.message ?? data?.error ?? `HTTP ${res.status}`;
    throw new Error(`${message} (${path})`);
  }
  return data as T;
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

/**
 * Step 5 — read the payment back after the player has been away.
 *
 * `force_sync` asks the connector rather than trusting the stored status, which
 * is the point: the app was not watching while the challenge happened.
 */
export function syncPayment(paymentId: string): Promise<ConfirmPaymentResponse> {
  return request(`/api/payments/${encodeURIComponent(paymentId)}`);
}

/** Confirms a payment with a wallet token or a saved-card token. */
export function confirmPayment(
  paymentId: string,
  body: ConfirmPaymentData & Record<string, unknown>,
): Promise<ConfirmPaymentResponse> {
  return request('/api/confirm-payment', {
    method: 'POST',
    body: JSON.stringify({
      payment_id: paymentId,
      ...body,
      customer_acceptance: {
        acceptance_type: "online",
        accepted_at: "2026-10-01T08:47:51.331Z",
        online: {
          user_agent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
        },
      },
    }),
  });
}

/** A method a payout can be sent to, from the customers API's own list. */
export type PayoutMethod = {
  /** The `payout_method_id` a withdrawal is created with. */
  id: string;
  customer_id?: string;
  payment_method_type: string;
  payment_method_subtype?: string;
  is_default?: boolean;
  last_used_at?: string;
  created?: string;
  payment_method_data?: {
    card?: SavedCard;
    wallet?: Record<string, { last4?: string; card_network?: string }>;
  };
};

export type WithdrawalMethodsResponse = {
  customer_payment_methods: PayoutMethod[];
};

export type PayoutResponse = {
  payout_id?: string;
  status?: string;
  error_code?: string | null;
  error_message?: string | null;
  [key: string]: unknown;
};

/** Withdrawal W1 — the methods this player can be paid out to. */
export function fetchWithdrawalMethods(): Promise<WithdrawalMethodsResponse> {
  return request('/api/withdrawal-methods');
}

/**
 * Where a payout is going: a method already stored against the player, or a
 * bank redirect that carries its own details.
 */
export type WithdrawalTarget =
  | { kind: 'saved'; payoutMethodId: string }
  | { kind: 'interac'; email: string };

/** Withdrawal W2 — create the payout, in minor units. */
export function createWithdrawal(
  amount: number,
  target: WithdrawalTarget,
): Promise<PayoutResponse> {
  return request('/api/withdraw', {
    method: 'POST',
    body: JSON.stringify({
      amount,
      ...(target.kind === 'saved'
        ? { payout_method_id: target.payoutMethodId }
        : { interac_email: target.email }),
    }),
  });
}
