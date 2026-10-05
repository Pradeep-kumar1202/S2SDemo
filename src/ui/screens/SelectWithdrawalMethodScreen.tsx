'use client';

import {
  payoutMethodLabel,
  payoutMethodNetwork,
} from '../../flow/listWithdrawalMethods';
import type { PayoutMethod } from '../../server/api';
import { CardBrandMark } from '../CardBrandMark';
import { formatAmount } from '../money';

type Props = {
  methods: PayoutMethod[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  amount: number;
  onWithdraw: () => void;
  canWithdraw: boolean;
  busy: boolean;
  error?: string | null;
};

/**
 * Where the payout is going.
 *
 * One list, not two: a payout method is already a stored instrument, so there
 * is nothing to collect here — no card form, no CVC, no wallet sheet. That is
 * the whole difference from the deposit sheet.
 */
export function SelectWithdrawalMethodScreen({
  methods,
  selectedId,
  onSelect,
  onBack,
  amount,
  onWithdraw,
  canWithdraw,
  busy,
  error,
}: Props) {
  return (
    <section className="screen">
      <header className="sheet-header">
        <button className="back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <h1>Withdraw to</h1>
      </header>

      <div className="sheet-body">
        {methods.length > 0 ? (
          <div className="card">
            {methods.map(method => {
              const selected = method.id === selectedId;
              return (
                <div key={method.id} className="saved-row">
                  <button
                    className="row-main"
                    onClick={() => onSelect(method.id)}
                    role="radio"
                    aria-checked={selected}
                  >
                    <span className={selected ? 'radio radio-on' : 'radio'} />
                    <CardBrandMark network={payoutMethodNetwork(method)} />
                    <span className="grow">{payoutMethodLabel(method)}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="hint">
            This player has no method a payout can be sent to.
          </p>
        )}

        {error ? <p className="banner">{error}</p> : null}
      </div>

      <footer className="sheet-footer">
        <button
          className="primary"
          onClick={onWithdraw}
          disabled={!canWithdraw || busy}
        >
          {busy ? 'Working…' : `Withdraw ${formatAmount(amount)}`}
        </button>
        <p className="muted small center">
          🔒 Payouts go to your saved methods only
        </p>
      </footer>
    </section>
  );
}
