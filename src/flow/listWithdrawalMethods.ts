import {
  fetchWithdrawalMethods,
  type PayoutMethod,
} from '../server/api';

/**
 * Withdrawal W1 — where can this player's money go?
 *
 * Sequence:
 *
 *   App             -> Server          : list withdrawal methods
 *   Server          -> Payments API    : /v1/customers/{player}/saved-payment-methods
 *   App             <- Server          : the methods a payout may be sent to
 *
 * This is deliberately a different list from the deposit screen's. Paying money
 * out is not the same question as taking it in: the entries come from the
 * customers API keyed by a payout-capable id, and that id — not the deposit
 * flow's `payment_token` — is what a payout is created with.
 */
export async function listWithdrawalMethods(): Promise<PayoutMethod[]> {
  const { customer_payment_methods: methods } = await fetchWithdrawalMethods();
  return [...(methods ?? [])].sort(
    (a, b) => lastUsedAt(b) - lastUsedAt(a),
  );
}

/** Most recently used first, as on the deposit side. */
function lastUsedAt(method: PayoutMethod): number {
  const stamp = method.last_used_at ?? method.created;
  const time = stamp ? Date.parse(stamp) : NaN;
  return Number.isNaN(time) ? 0 : time;
}

/** What the pill and the rows show for a payout method. */
export function payoutMethodLabel(method: PayoutMethod): string {
  const card = method.payment_method_data?.card;
  if (card) {
    return `${card.card_network ?? card.scheme ?? 'Card'} •••• ${card.last4_digits ?? '••••'}`;
  }
  const wallet = method.payment_method_data?.wallet;
  const walletName = wallet ? Object.keys(wallet)[0] : undefined;
  if (walletName) {
    const last4 = wallet?.[walletName]?.last4;
    const label = walletName === 'apple_pay' ? 'Apple Pay' : 'Google Pay';
    return last4 ? `${label} •••• ${last4}` : label;
  }
  return method.payment_method_subtype ?? method.payment_method_type;
}

/** The brand mark to draw beside it. */
export function payoutMethodNetwork(method: PayoutMethod): string | null {
  const card = method.payment_method_data?.card;
  if (card) {
    return card.card_network ?? card.scheme ?? null;
  }
  const wallet = method.payment_method_data?.wallet;
  return wallet ? Object.keys(wallet)[0] ?? null : null;
}
