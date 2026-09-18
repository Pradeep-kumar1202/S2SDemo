'use client';

import { BALANCE, formatBalance } from '../money';

type Props = {
  onStart: () => void;
  loading: boolean;
  status?: string | null;
  error?: string | null;
};

/**
 * Where the player starts and lands back after a deposit.
 *
 * Starting the flow is what creates the payment intent — nothing is created
 * until the player asks to deposit.
 */
export function LobbyScreen({ onStart, loading, status, error }: Props) {
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

      <button className="primary" onClick={onStart} disabled={loading}>
        {loading ? 'Creating payment…' : 'Deposit'}
      </button>
    </section>
  );
}
