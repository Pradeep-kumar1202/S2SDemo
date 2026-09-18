/**
 * Deposit amounts shown in the UI.
 *
 * The design is a GBP deposit screen, so the amount the customer types is
 * formatted as GBP. The payment created on the server is a separate, server-side
 * amount; nothing here is sent to Hyperswitch.
 */
export const DEPOSIT_CURRENCY_SYMBOL = '£';

/** Preset chips under the amount. */
export const QUICK_AMOUNTS = ['5', '10', '25'] as const;

/** Starting balance shown under the title. */
export const BALANCE = 2000;

const MAX_DECIMALS = 2;
const MAX_DIGITS = 6;

/**
 * Keeps what the system keypad produces to a well-formed amount: digits, at
 * most one decimal point, at most two decimals, and no leading zeros.
 */
export function sanitizeAmount(input: string): string {
  const digitsAndDots = input.replace(/[^0-9.]/g, '');
  const [whole = '', ...rest] = digitsAndDots.split('.');
  const trimmedWhole = whole.replace(/^0+(?=\d)/, '').slice(0, MAX_DIGITS);
  if (rest.length === 0) {
    return trimmedWhole;
  }
  return `${trimmedWhole || '0'}.${rest.join('').slice(0, MAX_DECIMALS)}`;
}

export function amountValue(raw: string): number {
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

/** "10" -> "£10", "10.5" -> "£10.5" (keeps what was typed, for the big display). */
export function formatTypedAmount(raw: string): string {
  return `${DEPOSIT_CURRENCY_SYMBOL}${raw || '0'}`;
}

/** Always two decimals when they matter: "£10" / "£10.50". */
export function formatAmount(value: number): string {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `${DEPOSIT_CURRENCY_SYMBOL}${text}`;
}

export function formatBalance(value: number): string {
  return `${DEPOSIT_CURRENCY_SYMBOL}${value.toLocaleString('en-GB')}`;
}
