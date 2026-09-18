'use client';

import { useState, type RefObject } from 'react';

import { NewCardFields } from '../../cards/NewCardFields';
import { SavedCardCvcField } from '../../cards/SavedCardCvcField';
import type { CardFormHandle } from '../../cards/types';
import type { CreatePaymentResponse } from '../../server/api';
import {
  cardNetwork,
  otherPaymentMethods,
  requiresCvc,
  sortedSavedCards,
  type SelectedMethod,
  type WalletName,
} from '../../paymentMethods';
import { GooglePayButton } from '../../wallets/GooglePayButton';

import { CardBrandMark } from '../CardBrandMark';
import { formatAmount } from '../money';

type Props = {
  payment: CreatePaymentResponse;
  selected: SelectedMethod | null;
  onSelect: (method: SelectedMethod) => void;
  onBack: () => void;
  cvcFormRef: RefObject<CardFormHandle | null>;
  cardFormRef: RefObject<CardFormHandle | null>;
  onCardComplete: (complete: boolean) => void;
  amount: number;
  onDeposit: () => void;
  canDeposit: boolean;
  busy: boolean;
  error?: string | null;
  applePayReady: boolean;
  googlePayReady: boolean;
  publishableKey: string;
  wallets: WalletName[];
  onWalletPress: (wallet: WalletName) => void;
};

/** The payment sheet: saved cards in an accordion, other methods below. */
export function SelectPaymentMethodScreen({
  payment,
  selected,
  onSelect,
  onBack,
  cvcFormRef,
  cardFormRef,
  onCardComplete,
  amount,
  onDeposit,
  canDeposit,
  busy,
  error,
  googlePayReady,
  publishableKey,
  wallets,
  onWalletPress,
}: Props) {
  const [savedOpen, setSavedOpen] = useState(true);

  const savedCards = sortedSavedCards(payment.payment_method_list);
  const otherMethods = otherPaymentMethods(payment.payment_method_list);

  return (
    <section className="screen">
      <header className="sheet-header">
        <button className="back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <h1>Select Payment Method</h1>
      </header>

      <div className="sheet-body">
        {wallets.includes('google_pay') ? (
          <GooglePayButton
            publishableKey={publishableKey}
            onPress={() => onWalletPress('google_pay')}
            disabled={busy || !googlePayReady}
          />
        ) : null}
        {wallets.includes('google_pay') && !googlePayReady ? (
          <p className="hint">Google Pay is not available in this browser.</p>
        ) : null}
        {wallets.includes('apple_pay') ? (
          <p className="hint">
            Apple Pay needs a verified merchant domain, so it is not wired here.
          </p>
        ) : null}

        {savedCards.length > 0 ? (
          <div className="card">
            <button
              className="accordion"
              onClick={() => setSavedOpen(open => !open)}
              aria-expanded={savedOpen}
            >
              <span className="saved-icon">▤</span>
              <span className="grow">Saved</span>
              <span className="chevron">{savedOpen ? '⌃' : '⌄'}</span>
            </button>

            {savedOpen
              ? savedCards.map(method => {
                  const isSelected =
                    selected?.kind === 'saved' &&
                    selected.paymentToken === method.payment_token;
                  return (
                    <div key={method.payment_token} className="saved-row">
                      <button
                        className="row-main"
                        onClick={() =>
                          onSelect({
                            kind: 'saved',
                            paymentToken: method.payment_token,
                          })
                        }
                        role="radio"
                        aria-checked={isSelected}
                      >
                        <span className={isSelected ? 'radio radio-on' : 'radio'} />
                        <CardBrandMark network={cardNetwork(method)} />
                        <span className="grow mono">
                          •••• {method.payment_method_data?.card?.last4_digits ?? '••••'}
                        </span>
                      </button>
                      {isSelected && requiresCvc(method) ? (
                        <div className="cvc-inline">
                          <SavedCardCvcField
                            ref={cvcFormRef}
                            payment={payment}
                            method={method}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })
              : null}
          </div>
        ) : null}

        {otherMethods.length > 0 ? (
          <>
            <p className="section-title">Other</p>
            {otherMethods.map(method => {
              const isSelected =
                selected?.kind === 'new_card' &&
                selected.paymentMethod === method.paymentMethod;
              return (
                <div
                  key={method.paymentMethod}
                  className={isSelected ? 'card card-selected' : 'card'}
                >
                  <button
                    className="accordion"
                    onClick={() =>
                      onSelect({
                        kind: 'new_card',
                        paymentMethod: method.paymentMethod,
                      })
                    }
                    aria-expanded={isSelected}
                  >
                    <span className="saved-icon">▢</span>
                    <span className="grow">{method.label}</span>
                    <span className="chevron">{isSelected ? '⌃' : '⌄'}</span>
                  </button>

                  {/* Selecting the row expands its fields in place. */}
                  {isSelected && method.paymentMethod === 'card' ? (
                    <div className="card-fields">
                      <NewCardFields
                        ref={cardFormRef}
                        payment={payment}
                        onComplete={onCardComplete}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </>
        ) : null}

        {error ? <p className="banner">{error}</p> : null}
      </div>

      <footer className="sheet-footer">
        <button className="primary" onClick={onDeposit} disabled={!canDeposit || busy}>
          {busy ? 'Working…' : `Deposit ${formatAmount(amount)}`}
        </button>
        <p className="muted small center">🔒 Your deposit is secure and encrypted</p>
      </footer>
    </section>
  );
}
