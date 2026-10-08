import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import type { CardFormHandle } from '@juspay-tech/react-native-hyperswitch-payment-methods';

import {
  syncPayment,
  type ConfirmPaymentResponse,
  type CreatePaymentResponse,
} from '../server/api';
import { amountValue } from '../ui/money';
import {
  onReturnFromRedirect,
  returnedPaymentId,
} from './returnFromRedirect';
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
import { collectWalletPayment, walletAvailability } from './payWithWallet';
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
  /** An informational line for the lobby, separate from errors. */
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * A payment left mid-authentication, and the one being read back right now.
   *
   * Refs, not state: nothing renders them, and two wake-ups race for them — the
   * return link arriving and the app coming forward. They can fire in the same
   * tick, and a state value would still be the old one in whichever handler ran
   * second, so the payment would be read twice.
   *
   * A ref does not survive the process being killed, which is the other half of
   * why the link carries the payment id. See `returnFromRedirect.ts`.
   */
  const pendingPaymentId = useRef<string | null>(null);
  const settlingPaymentId = useRef<string | null>(null);

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
   * A wallet is only offered when it can actually be paid with: the payment
   * carries its session token and the device (and, for Google Pay, the session's
   * auth methods) can use it. Anything else is hidden rather than disabled.
   */
  const walletOffered = useCallback(
    (wallet: WalletName) =>
      findWalletToken(payment, wallet) != null &&
      (wallet === 'apple_pay' ? applePayReady : googlePayReady),
    [applePayReady, googlePayReady, payment],
  );

  /**
   * Re-checked every time the payment is replaced, not just on create: the
   * intent starts at amount 0, and a wallet whose connector will not quote a
   * zero amount (Apple Pay) only gets its session token once update has put
   * the real amount on it.
   */
  const refreshWallets = useCallback(async (current: CreatePaymentResponse) => {
    const availability = await walletAvailability(current);
    setGooglePayReady(availability.googlePayReady);
    setApplePayReady(availability.applePayReady);
    return availability;
  }, []);

  /**
   * Step 5 — reconcile after a redirect.
   *
   * The player authenticated somewhere this app cannot see, so nothing here was
   * told the answer. Both ways back end in the same place: read the payment with
   * `force_sync` and report whatever it actually says.
   */
  /** How a payment read back from the server is reported, wherever it is read. */
  const reportPayment = useCallback((result: ConfirmPaymentResponse) => {
    if (result.error_code || result.error_message) {
      setError(`${result.error_code ?? 'error'}: ${result.error_message ?? ''}`);
    } else {
      setStatus(`Payment ${result.payment_id} · ${result.status}`);
    }
  }, []);

  /**
   * Reads one payment back, once.
   *
   * The ref is claimed before the first `await`, so when the link and the
   * foreground transition both arrive for the same payment the second one finds
   * it taken and does nothing — otherwise the lobby reports the same payment
   * twice. Only a payment that was actually read is forgotten: a read that
   * failed stays pending, so coming forward again tries it rather than losing
   * the payment in silence.
   */
  const settlePayment = useCallback(
    async (paymentId: string) => {
      if (settlingPaymentId.current === paymentId) {
        return;
      }
      settlingPaymentId.current = paymentId;
      try {
        const result = await syncPayment(paymentId);
        if (pendingPaymentId.current === paymentId) {
          pendingPaymentId.current = null;
        }
        reportPayment(result);
      } catch (e) {
        setError(messageOf(e));
      } finally {
        settlingPaymentId.current = null;
      }
    },
    [reportPayment],
  );

  /**
   * Step 5b — the player came back through the link.
   *
   * The id in the URL leads and the remembered one is only a fallback: after a
   * cold start there is nothing remembered, and after a warm one the two name
   * the same payment anyway.
   */
  useEffect(
    () =>
      onReturnFromRedirect(url => {
        const paymentId = returnedPaymentId(url) ?? pendingPaymentId.current;
        if (!paymentId) {
          // A link that names no payment, with none waiting. Said out loud,
          // because doing nothing looks exactly like a deep link wired wrong.
          setNotice('Came back from authentication, but with no payment to read.');
          return;
        }
        setScreen('lobby');
        setStatus('Checking the payment…');
        settlePayment(paymentId);
      }),
    [settlePayment],
  );

  /**
   * The fallback for a return that never arrives as a link: the player pressed
   * back out of the browser, or the page closed without following `return_url`.
   *
   * Subscribed for the life of the app and reading the ref, rather than
   * resubscribed whenever the pending payment changes — rebuilding the listener
   * inside the window it is meant to catch is its own race.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && pendingPaymentId.current) {
        settlePayment(pendingPaymentId.current);
      }
    });
    return () => subscription.remove();
  }, [settlePayment]);

  // ---------------------------------------------------------------------------
  // Step 1 — create the intent when the player asks to deposit
  // ---------------------------------------------------------------------------

  const startDeposit = useCallback(async () => {
    setCreating(true);
    setError(null);
    setStatus(null);
    setNotice(null);
    try {
      const created = await createIntent();
      setPayment(created);

      // Wallet availability is settled first: a wallet that cannot be used is
      // hidden everywhere, so the screen must not start on one.
      const availability = await refreshWallets(created);

      // The player's most recently used usable method leads, on both screens.
      const top = defaultSelection(created.payment_method_list, wallet =>
        wallet === 'apple_pay'
          ? availability.applePayReady
          : availability.googlePayReady,
      );
      setDepositSelection(top);
      setSheetSelection(top);

      setScreen('deposit');
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setCreating(false);
    }
  }, [refreshWallets]);

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
      await refreshWallets(refreshed);
      return refreshed;
    } catch (e) {
      setError(messageOf(e));
      return null;
    }
  }, [payment, refreshWallets, value]);

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
   * it worked, confirm it. A failed collection (cancelled sheet, empty CVC)
   * leaves the player where they are so they can retry.
   */
  const confirmWith = useCallback(
    async (collect: () => Promise<CollectOutcome>, source?: CreatePaymentResponse | null) => {
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
        const outcome = await confirmDeposit(current, collected.body, setStatus);
        // However it ended, the player goes back to the lobby to read it.
        setScreen('lobby');

        if ('redirect' in outcome) {
          // Step 5 — the issuer wants the player somewhere else first. Send
          // them, remember which payment is waiting, and reconcile on return.
          setStatus(outcome.message);
          pendingPaymentId.current = outcome.paymentId;
          Linking.openURL(outcome.redirect).catch(e => setError(messageOf(e)));
          return;
        }

        if ('sync' in outcome) {
          // Step 5 — there is nothing to present: device data collection ended
          // without a challenge, so the payment's own status is the answer.
          setStatus(outcome.message);
          reportPayment(await syncPayment(outcome.sync));
          return;
        }

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
    [payment, reportPayment],
  );

  /** Wallet button, wherever it is pressed. */
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

      const paymentMethodType = firstTypeFor(methodList, selected.paymentMethod);

      // A method with no fields — a bank redirect, say — is confirmed by naming
      // it: the empty `payment_method_data` is how the API expects the choice
      // to arrive. What comes back is a `next_action`, which step 5 follows.
      if (!collectsCardFields(selected)) {
        return confirmWith(
          async () => ({
            ok: true,
            body: {
              payment_method: selected.paymentMethod,
              payment_method_type: paymentMethodType,
              payment_method_data: {
                [selected.paymentMethod]: { [paymentMethodType]: {} },
              },
            },
          }),
          current,
        );
      }

      return confirmWith(
        () => tokenizeCard(cardFormRef.current, { paymentMethodType }),
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
    const wallet = depositSelection?.kind === 'wallet' ? depositSelection.wallet : null;
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
    // Only a method with fields to fill waits on them. A bank redirect and
    // the other APMs collect nothing here, so there is nothing to complete.
    (!collectsCardFields(selected) || screen !== 'methods' || cardComplete);

  return {
    screen,
    payment,

    lobbyProps: {
      onStart: startDeposit,
      // Withdrawal is the cashier's other half, and out of scope here: this
      // demo implements the deposit sequence only.
      onWithdraw: () =>
        setNotice('Withdrawals are not part of this demo — deposits only.'),
      notice,
      loading: creating,
      status,
      error,
    },

    depositProps: {
      amount,
      onAmountChange: setAmount,
      onQuickAmount: setAmount,
      selectionLabel: depositMethod.label,
      selectionNetwork: depositMethod.network,
      onOpenMethods: openSheet,
      cvcCard: depositMethod.cvcCard,
      cvcFormRef,
      wallet: depositMethod.wallet,
      walletReady: depositMethod.walletReady,
      onWalletPress: () =>
        depositMethod.wallet ? deposit() : undefined,
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
      status,
      applePayReady,
      googlePayReady,
      offeredWallets: (['google_pay', 'apple_pay'] as const).filter(walletOffered),
      onApplePay: () => payWithWallet('apple_pay'),
      onGooglePay: () => payWithWallet('google_pay'),
    },
  };
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Whether a chosen method has card fields the player must fill first.
 *
 * Today that is only `card`; every other entry in the sheet's Other section —
 * bank redirects and the rest — carries no form, so waiting on one would leave
 * its Deposit button disabled forever.
 */
function collectsCardFields(selected: SelectedMethod | null): boolean {
  return selected?.kind === 'new_card' && selected.paymentMethod === 'card';
}
