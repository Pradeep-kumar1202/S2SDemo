'use client';

import { BALANCE, formatBalance } from '../money';

type Props = {
  onStart: () => void;
  onWithdraw: () => void;
  loading: boolean;
  status?: string | null;
  error?: string | null;
  /** An informational line, e.g. for an action the demo does not implement. */
  notice?: string | null;
};

/**
 * Where the player starts and lands back after a deposit.
 *
 * Starting the flow is what creates the payment intent — nothing is created
 * until the player asks to deposit.
 */
export function LobbyScreen({
  onStart,
  onWithdraw,
  loading,
  status,
  error,
  notice,
}: Props) {
  return (
    <section className="screen">
      <header className="screen-header">
        <h1>Lobby</h1>
        <p className="muted">Balance {formatBalance(BALANCE)}</p>
      </header>

      <div className="screen-body">
        {error ? (
          <p className="banner">{error}</p>
        ) : status ? (
          <div className="receipt">
            <span className="muted small">Last deposit</span>
            <span>{status}</span>
          </div>
        ) : null}
      </div>

      {notice ? <p className="muted small center">{notice}</p> : null}

      <button className="primary" onClick={onStart} disabled={loading}>
        {loading ? 'Creating payment…' : 'Deposit'}
      </button>

      {/* The other half of a cashier. Deposit stays the primary action. */}
      <button className="secondary" onClick={onWithdraw} disabled={loading}>
        Withdrawal
      </button>
    </section>
  );
}
