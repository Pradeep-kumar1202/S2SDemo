'use client';

import type { RefObject } from 'react';

import { SavedCardCvcField } from '../../cards/SavedCardCvcField';
import type { CardFormHandle } from '../../cards/types';
import type { CreatePaymentResponse, CustomerPaymentMethod } from '../../server/api';
import { ApplePayButton } from '../../wallets/ApplePayButton';
import { GooglePayButton } from '../../wallets/GooglePayButton';
import type { WalletName } from '../../paymentMethods';
import { CardBrandMark } from '../CardBrandMark';
import {
  BALANCE,
  DEPOSIT_CURRENCY_SYMBOL,
  QUICK_AMOUNTS,
  formatAmount,
  formatBalance,
  sanitizeAmount,
} from '../money';

type Props = {
  payment: CreatePaymentResponse;
  amount: string;
  onAmountChange: (raw: string) => void;
  selectionLabel: string;
  selectionNetwork?: string | null;
  onOpenMethods: () => void;
  cvcCard: CustomerPaymentMethod | null;
  cvcFormRef: RefObject<CardFormHandle | null>;
  /** Set when the latest stored method is a wallet: its button replaces Deposit. */
  wallet: WalletName | null;
  walletReady: boolean;
  publishableKey: string;
  onDeposit: () => void;
  canDeposit: boolean;
  busy: boolean;
  status?: string | null;
  error?: string | null;
};

/** Where the player types the amount and sees the method they will pay with. */
export function DepositScreen({
  payment,
  amount,
  onAmountChange,
  selectionLabel,
  selectionNetwork,
  onOpenMethods,
  cvcCard,
  cvcFormRef,
  wallet,
  walletReady,
  publishableKey,
  onDeposit,
  canDeposit,
  busy,
  status,
  error,
}: Props) {
  return (
    <section className="screen">
      <header className="screen-header">
        <h1>Deposit</h1>
        <p className="muted">Balance {formatBalance(BALANCE)}</p>
      </header>

      <div className="method-row">
        <button className="method-pill" onClick={onOpenMethods} disabled={busy}>
          <CardBrandMark network={selectionNetwork} />
          <span className="method-label">{selectionLabel}</span>
          <span className="chevron">⌄</span>
        </button>

        {cvcCard ? (
          <div className="cvc-pill">
            <SavedCardCvcField ref={cvcFormRef} payment={payment} method={cvcCard} />
          </div>
        ) : null}
      </div>

      <div className="amount">
        <label className="visually-hidden" htmlFor="amount">
          Deposit amount
        </label>
        <input
          id="amount"
          inputMode="decimal"
          value={`${DEPOSIT_CURRENCY_SYMBOL}${amount}`}
          onChange={event => onAmountChange(sanitizeAmount(event.target.value))}
        />
      </div>

      <button className="link">Manage Deposit Limits</button>

      <div className="chips">
        {QUICK_AMOUNTS.map(value => (
          <button
            key={value}
            className={amount === value ? 'chip chip-selected' : 'chip'}
            onClick={() => onAmountChange(value)}
          >
            {formatAmount(Number(value))}
          </button>
        ))}
      </div>

      {error ? <p className="banner">{error}</p> : null}
      {!error && status ? <p className="muted small center">{status}</p> : null}

      {wallet === 'google_pay' ? (
        <GooglePayButton
          publishableKey={publishableKey}
          onPress={onDeposit}
          disabled={busy || !walletReady || !canDeposit}
        />
      ) : wallet === 'apple_pay' ? (
        <ApplePayButton onPress={onDeposit} disabled={busy || !canDeposit} />
      ) : (
        <button className="primary" onClick={onDeposit} disabled={!canDeposit || busy}>
          {busy ? 'Working…' : 'Deposit'}
        </button>
      )}
    </section>
  );
}
