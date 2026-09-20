'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import type { CardFormHandle } from '../cards/types';
import type { CreatePaymentResponse } from '../server/api';
import { amountValue } from '../ui/money';
import {
  defaultSelection,
  describeSelection,
  findSavedCard,
  findWalletToken,
  firstTypeFor,
  requiresCvc,
  type SelectedMethod,
  type WalletName,
} from '../paymentMethods';
import { confirmDeposit } from './confirmDeposit';
import { createIntent } from './createIntent';
import {
  collectWalletPayment,
  walletAvailability,
  walletsWithTokens,
} from './payWithWallet';
import { savedCardWithoutCvc, tokenizeCard } from './tokenizeCard';
import type { CollectOutcome } from './types';
import { updateIntent } from './updateIntent';

/**
 * The deposit sequence, in order, in one place.
 *
 * Read this file top to bottom against the sequence diagram: each step calls
 * into `src/flow/<step>.ts`, which documents the arrows it implements. The
 * screens hold no flow logic — they render what this returns and call back in.
 *
 *   lobby   → startDeposit()   step 1: create the intent
 *   deposit → openSheet()      step 2: update the amount, then show the sheet
 *           → deposit()        steps 2-4: update, collect, confirm
 *   sheet   → deposit()        steps 3-4: collect, confirm
 *   lobby   ← outcome          step 5: report (next action is not handled)
 */

export type Screen = 'lobby' | 'deposit' | 'methods';

export function useDepositFlow() {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [payment, setPayment] = useState<CreatePaymentResponse | null>(null);

  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [amount, setAmount] = useState('10');

  /**
   * Two selections, deliberately. The deposit screen shows the player's most
   * recently used method and keeps showing it; the sheet is where they browse.
   * Picking in the sheet pays with that pick, but never rewrites the deposit
   * screen behind them.
   */
  const [depositSelection, setDepositSelection] = useState<SelectedMethod | null>(null);
  const [sheetSelection, setSheetSelection] = useState<SelectedMethod | null>(null);

  const [googlePayReady, setGooglePayReady] = useState(false);
  const [applePayReady, setApplePayReady] = useState(false);

  /** Handles on the mounted Cards SDK forms — the only way to reach a token. */
  const cvcFormRef = useRef<CardFormHandle>(null);
  const cardFormRef = useRef<CardFormHandle>(null);
  const [cardComplete, setCardComplete] = useState(false);

  const methodList = payment?.payment_method_list;
  const value = amountValue(amount);

  /**
   * A wallet is offered when the payment carries its session token, and — for
   * Google Pay — when that session can return a network token. Apple Pay stays
   * on offer even where it cannot run, so its button can explain why.
   */
  const walletOffered = useCallback(
    (wallet: WalletName) =>
      findWalletToken(payment, wallet) != null &&
      (wallet === 'apple_pay' || googlePayReady),
    [googlePayReady, payment],
  );

  // ---------------------------------------------------------------------------
  // Step 1 — create the intent when the player asks to deposit
  // ---------------------------------------------------------------------------

  const startDeposit = useCallback(async () => {
    setCreating(true);
    setError(null);
    setStatus(null);
    try {
      const created = await createIntent();
      setPayment(created);

      // Wallet availability is settled first: Google Pay is hidden when its
      // session cannot produce a network token, so the screen must not start
      // on it.
      const availability = await walletAvailability(created);
      setGooglePayReady(availability.googlePayReady);
      setApplePayReady(availability.applePayReady);

      // The player's most recently used usable method leads, on both screens.
      const top = defaultSelection(created.payment_method_list, wallet =>
        // Apple Pay stays on offer everywhere: outside Safari its button
        // explains itself rather than disappearing.
        wallet === 'apple_pay' ? true : availability.googlePayReady,
      );
      setDepositSelection(top);
      setSheetSelection(top);

      setScreen('deposit');
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setCreating(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Step 2 — put the entered amount on the intent
  // ---------------------------------------------------------------------------

  /** Returns the refreshed payment, or null when the update failed. */
  const pushAmount = useCallback(async (): Promise<CreatePaymentResponse | null> => {
    if (!payment) {
      return null;
    }
    try {
      const refreshed = await updateIntent(payment, value);
      setPayment(refreshed);
      return refreshed;
    } catch (e) {
      setError(messageOf(e));
      return null;
    }
  }, [payment, value]);

  /** Opening the sheet is a moment the player can pick an instrument. */
  const openSheet = useCallback(async () => {
    if (!payment) {
      return;
    }
    setBusy(true);
    try {
      await pushAmount();
    } finally {
      setBusy(false);
      setScreen('methods');
    }
  }, [payment, pushAmount]);

  // ---------------------------------------------------------------------------
  // Steps 3 and 4 — collect an instrument, then confirm with it
  // ---------------------------------------------------------------------------

  /**
   * The shared tail of every payment path: take whatever was collected and, if
   * it worked, confirm it. A failed collection leaves the player where they are
   * so they can retry.
   */
  const confirmWith = useCallback(
    async (
      collect: () => Promise<CollectOutcome>,
      source?: CreatePaymentResponse | null,
    ) => {
      const current = source ?? payment;
      if (!current) {
        return;
      }
      setBusy(true);
      setError(null);
      setStatus(null);
      try {
        const collected = await collect();
        if (!collected.ok) {
          setError(collected.message);
          return;
        }
        const outcome = await confirmDeposit(current, collected.body);
        // However it ended, the player goes back to the lobby to read it.
        setScreen('lobby');
        if (outcome.ok) {
          setStatus(outcome.message);
        } else {
          setError(outcome.message);
        }
      } catch (e) {
        setError(messageOf(e));
      } finally {
        setBusy(false);
      }
    },
    [payment],
  );

  const payWithWallet = useCallback(
    (wallet: WalletName, source?: CreatePaymentResponse | null) => {
      const current = source ?? payment;
      if (!current) {
        return;
      }
      return confirmWith(() => collectWalletPayment(current, wallet), current);
    },
    [confirmWith, payment],
  );

  /**
   * Deposit, from whichever screen is showing.
   *
   * The deposit screen has not pushed the amount yet, so it does that first;
   * the sheet already did on its way in.
   */
  const deposit = useCallback(async () => {
    const selected = screen === 'methods' ? sheetSelection : depositSelection;
    const refreshed = screen === 'deposit' ? await pushAmount() : payment;
    const current = refreshed ?? payment;
    if (!current || !selected) {
      setScreen('methods');
      return;
    }

    if (selected.kind === 'wallet') {
      return payWithWallet(selected.wallet, current);
    }

    if (selected.kind === 'new_card') {
      // The card fields live under the Card row in the sheet, so if the player
      // is not there yet, take them there instead of tokenizing nothing.
      if (screen !== 'methods') {
        setError(null);
        setScreen('methods');
        return;
      }
      return confirmWith(
        () =>
          tokenizeCard(cardFormRef.current, {
            paymentMethodType: firstTypeFor(methodList, selected.paymentMethod),
          }),
        current,
      );
    }

    const method = findSavedCard(methodList, selected.paymentToken);
    if (!method) {
      return;
    }
    return confirmWith(
      () =>
        requiresCvc(method)
          ? tokenizeCard(cvcFormRef.current, {
              paymentMethodType: method.payment_method_type,
              paymentToken: method.payment_token,
            })
          : Promise.resolve(savedCardWithoutCvc(method)),
      current,
    );
  }, [
    confirmWith,
    depositSelection,
    methodList,
    payment,
    payWithWallet,
    pushAmount,
    screen,
    sheetSelection,
  ]);

  // ---------------------------------------------------------------------------
  // What the screens render
  // ---------------------------------------------------------------------------

  const selectMethod = useCallback((method: SelectedMethod) => {
    setSheetSelection(method);
    setCardComplete(false);
    setError(null);
  }, []);

  /** The deposit screen's own method: its label, its CVC field, its wallet. */
  const depositMethod = useMemo(() => {
    const card =
      depositSelection?.kind === 'saved'
        ? findSavedCard(methodList, depositSelection.paymentToken)
        : undefined;
    const wallet =
      depositSelection?.kind === 'wallet' ? depositSelection.wallet : null;
    return {
      ...describeSelection(depositSelection, methodList),
      cvcCard: card && requiresCvc(card) ? card : null,
      // A wallet button only replaces Deposit when there is a token to use.
      wallet: wallet && findWalletToken(payment, wallet) ? wallet : null,
      walletReady: wallet === 'apple_pay' ? applePayReady : googlePayReady,
    };
  }, [applePayReady, depositSelection, googlePayReady, methodList, payment]);

  const selected = screen === 'methods' ? sheetSelection : depositSelection;
  const canDeposit =
    payment != null &&
    selected != null &&
    value > 0 &&
    (selected.kind !== 'new_card' || screen !== 'methods' || cardComplete);

  return {
    screen,
    payment,

    lobbyProps: { onStart: startDeposit, loading: creating, status, error },

    depositProps: {
      amount,
      onAmountChange: setAmount,
      selectionLabel: depositMethod.label,
      selectionNetwork: depositMethod.network,
      onOpenMethods: openSheet,
      cvcCard: depositMethod.cvcCard,
      cvcFormRef,
      wallet: depositMethod.wallet,
      walletReady: depositMethod.walletReady,
      publishableKey: payment?.publishable_key ?? '',
      onDeposit: deposit,
      canDeposit,
      busy,
      status,
      error,
    },

    sheetProps: {
      selected: sheetSelection,
      onSelect: selectMethod,
      onBack: () => setScreen('deposit'),
      cvcFormRef,
      cardFormRef,
      onCardComplete: setCardComplete,
      amount: value,
      onDeposit: deposit,
      canDeposit,
      busy,
      error,
      applePayReady,
      googlePayReady,
      publishableKey: payment?.publishable_key ?? '',
      wallets: payment ? walletsWithTokens(payment).filter(walletOffered) : [],
      onWalletPress: (wallet: WalletName) => payWithWallet(wallet),
    },
  };
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
