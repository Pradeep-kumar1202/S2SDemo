'use client';

import { CardBrandMark } from '../CardBrandMark';
import {
  BALANCE,
  DEPOSIT_CURRENCY_SYMBOL,
  QUICK_AMOUNTS,
  amountValue,
  formatAmount,
  formatBalance,
  sanitizeAmount,
} from '../money';

type Props = {
  amount: string;
  onAmountChange: (raw: string) => void;
  onQuickAmount: (value: string) => void;
  selectionLabel: string;
  selectionNetwork?: string | null;
  onOpenMethods: () => void;
  onBack: () => void;
  onWithdraw: () => void;
  canWithdraw: boolean;
  busy: boolean;
  loading: boolean;
  error?: string | null;
};

/**
 * Where the player says how much to take out, and to which stored method.
 *
 * The deposit screen's twin, minus everything a payout does not need: no CVC to
 * re-collect and no wallet sheet, because nothing is being authorised here —
 * the money is going the other way.
 */
export function WithdrawalScreen({
  amount,
  onAmountChange,
  onQuickAmount,
  selectionLabel,
  selectionNetwork,
  onOpenMethods,
  onBack,
  onWithdraw,
  canWithdraw,
  busy,
  loading,
  error,
}: Props) {
  return (
    <section className="screen">
      <header className="sheet-header">
        <button className="back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <div className="grow center">
          <h1>Withdraw</h1>
          <p className="muted small">Balance {formatBalance(BALANCE)}</p>
        </div>
      </header>

      <button
        className="method-pill"
        onClick={onOpenMethods}
        disabled={busy || loading}
      >
        <CardBrandMark network={selectionNetwork} />
        <span className="method-label">{selectionLabel}</span>
        <span className="chevron">⌄</span>
      </button>

      <div className="amount">
        <label className="visually-hidden" htmlFor="withdraw-amount">
          Withdrawal amount
        </label>
        <input
          id="withdraw-amount"
          inputMode="decimal"
          value={`${DEPOSIT_CURRENCY_SYMBOL}${amount}`}
          onChange={event => onAmountChange(sanitizeAmount(event.target.value))}
        />
      </div>

      <div className="chips">
        {QUICK_AMOUNTS.map(value => (
          <button
            key={value}
            className={amount === value ? 'chip chip-selected' : 'chip'}
            onClick={() => onQuickAmount(value)}
          >
            {formatAmount(Number(value))}
          </button>
        ))}
      </div>

      {error ? <p className="banner">{error}</p> : null}

      <button
        className="primary"
        onClick={onWithdraw}
        disabled={!canWithdraw || busy}
      >
        {busy ? 'Working…' : `Withdraw ${formatAmount(amountValue(amount))}`}
      </button>
    </section>
  );
}
