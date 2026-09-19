import { Platform } from 'react-native';

import type {
  ApplePaySessionToken,
  CreatePaymentResponse,
  CustomerPaymentMethod,
  EnabledPaymentMethod,
  GooglePaySessionToken,
  PaymentMethodList,
  SessionToken,
} from './server/api';

export type WalletName = 'apple_pay' | 'google_pay';

/** What the customer picked on the Select Payment Method screen. */
export type SelectedMethod =
  | { kind: 'saved'; paymentToken: string }
  | { kind: 'wallet'; wallet: WalletName }
  | { kind: 'new_card'; paymentMethod: string };

export function findSavedCard(
  list: PaymentMethodList | undefined,
  paymentToken: string,
): CustomerPaymentMethod | undefined {
  return list?.customer_payment_methods.find(
    method => method.payment_token === paymentToken,
  );
}

/** Milliseconds for ordering: when a card was last used, else when it was created. */
function lastUsedAt(method: CustomerPaymentMethod): number {
  const stamp = method.last_used_at ?? method.created;
  const time = stamp ? Date.parse(stamp) : NaN;
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Apple Pay exists only on iOS and Google Pay only on Android, so a stored
 * wallet from the other platform can never be paid with here.
 */
export function walletSupportedOnThisOs(wallet: WalletName): boolean {
  return wallet === 'apple_pay'
    ? Platform.OS === 'ios'
    : Platform.OS === 'android';
}

/**
 * Every stored method — cards and wallets alike — most recently used first.
 *
 * Wallets the current OS cannot present are dropped here rather than at each
 * call site, so they are absent from the saved list, from the wallet buttons,
 * and from the method the deposit screen starts on.
 */
export function sortedSavedMethods(
  list: PaymentMethodList | undefined,
): CustomerPaymentMethod[] {
  return [...(list?.customer_payment_methods ?? [])]
    .filter(method => {
      const wallet = walletNameOf(method);
      return wallet == null || walletSupportedOnThisOs(wallet);
    })
    .sort((a, b) => lastUsedAt(b) - lastUsedAt(a));
}

/** Just the cards, in that same order — what the Saved accordion lists. */
export function sortedSavedCards(
  list: PaymentMethodList | undefined,
): CustomerPaymentMethod[] {
  return sortedSavedMethods(list).filter(
    method => walletNameOf(method) == null,
  );
}

/** The wallet a stored method stands for, or null when it is a card. */
export function walletNameOf(
  method: CustomerPaymentMethod | undefined,
): WalletName | null {
  if (method?.payment_method !== 'wallet') {
    return null;
  }
  const type = method.payment_method_type;
  return type === 'apple_pay' || type === 'google_pay' ? type : null;
}

/** The wallets that appear as rows in the saved list. */
export function savedWalletNames(
  list: PaymentMethodList | undefined,
): WalletName[] {
  const wallets = sortedSavedMethods(list)
    .map(walletNameOf)
    .filter((wallet): wallet is WalletName => wallet != null);
  return [...new Set(wallets)];
}

/** A saved wallet row's label. */
export function walletLabel(wallet: WalletName): string {
  return wallet === 'apple_pay' ? 'Apple Pay' : 'Google Pay';
}

/** The method at the top of that order — the one the deposit screen shows. */
export function defaultSelection(
  list: PaymentMethodList | undefined,
): SelectedMethod | null {
  const [top] = sortedSavedMethods(list);
  if (!top) {
    return null;
  }
  const wallet = walletNameOf(top);
  return wallet
    ? { kind: 'wallet', wallet }
    : { kind: 'saved', paymentToken: top.payment_token };
}

export function cardNetwork(method: CustomerPaymentMethod): string {
  const card = method.payment_method_data?.card;
  return card?.card_network ?? card?.scheme ?? 'Card';
}

export function cardLabel(method: CustomerPaymentMethod): string {
  const card = method.payment_method_data?.card;
  return `${cardNetwork(method)} •• ${card?.last4_digits ?? '••••'}`;
}

/** Saved cards that ask for the CVC again before confirming. */
export function requiresCvc(method: CustomerPaymentMethod | undefined): boolean {
  return method?.requires_cvv !== false;
}

/**
 * Non-wallet methods the merchant has enabled, collapsed to one row per
 * payment_method (credit + debit both become a single "Card" row).
 */
export function otherPaymentMethods(
  list: PaymentMethodList | undefined,
): { paymentMethod: string; label: string; types: EnabledPaymentMethod[] }[] {
  const rows = new Map<string, EnabledPaymentMethod[]>();
  for (const entry of list?.payment_methods_enabled ?? []) {
    if (entry.payment_method === 'wallet') {
      continue;
    }
    const existing = rows.get(entry.payment_method) ?? [];
    existing.push(entry);
    rows.set(entry.payment_method, existing);
  }
  return [...rows.entries()].map(([paymentMethod, types]) => ({
    paymentMethod,
    label: titleCase(paymentMethod),
    types,
  }));
}

/**
 * A concrete payment_method_type to confirm with for a payment_method row —
 * the "Card" row covers both credit and debit, so the first enabled one wins.
 */
export function firstTypeFor(
  list: PaymentMethodList | undefined,
  paymentMethod: string,
): string {
  const match = list?.payment_methods_enabled.find(
    entry => entry.payment_method === paymentMethod,
  );
  return match?.payment_method_type ?? paymentMethod;
}

function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function findWalletToken(
  payment: CreatePaymentResponse | null,
  wallet: 'google_pay',
): GooglePaySessionToken | undefined;
export function findWalletToken(
  payment: CreatePaymentResponse | null,
  wallet: 'apple_pay',
): ApplePaySessionToken | undefined;
export function findWalletToken(
  payment: CreatePaymentResponse | null,
  wallet: WalletName,
): SessionToken | undefined;
export function findWalletToken(
  payment: CreatePaymentResponse | null,
  wallet: WalletName,
): SessionToken | undefined {
  return payment?.session_tokens?.session_token?.find(
    token => token.wallet_name === wallet,
  );
}

/** Label for the payment-method pill on the deposit screen. */
export function describeSelection(
  selected: SelectedMethod | null,
  list: PaymentMethodList | undefined,
): { label: string; network?: string | null } {
  if (!selected) {
    return { label: 'Select payment method' };
  }
  if (selected.kind === 'wallet') {
    return {
      label: selected.wallet === 'apple_pay' ? 'Apple Pay' : 'Google Pay',
      network: selected.wallet,
    };
  }
  if (selected.kind === 'new_card') {
    return { label: titleCase(selected.paymentMethod) };
  }
  const method = findSavedCard(list, selected.paymentToken);
  return method
    ? { label: cardLabel(method), network: cardNetwork(method) }
    : { label: 'Select payment method' };
}
