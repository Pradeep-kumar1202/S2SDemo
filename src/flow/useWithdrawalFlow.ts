'use client';

import { useCallback, useMemo, useState } from 'react';

import type { PayoutMethod, WithdrawalTarget } from '../server/api';
import { amountValue } from '../ui/money';
import {
  listWithdrawalMethods,
  payoutMethodLabel,
  payoutMethodNetwork,
} from './listWithdrawalMethods';
import { withdraw } from './withdraw';

/**
 * The withdrawal journey, in order, in one place.
 *
 * It mirrors `useDepositFlow` deliberately — lobby, an amount screen, a method
 * sheet, back to the lobby with the outcome — so the two read alike. Where it
 * differs is where the APIs differ:
 *
 *   W1  listWithdrawalMethods()   the payout-capable methods, fetched when the
 *                                 journey starts rather than with an intent
 *   W2  withdraw()                /payouts/create — there is no intent to
 *                                 update first, so the amount travels with it
 *
 * The journey owns no payment: nothing is created until the player confirms.
 */

export type WithdrawalScreen = 'amount' | 'methods';

export function useWithdrawalFlow({ onFinished }: { onFinished: () => void }) {
  const [active, setActive] = useState(false);
  const [screen, setScreen] = useState<WithdrawalScreen>('amount');

  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  /** A stored method's id, or 'interac' for the bank redirect. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [interacEmail, setInteracEmail] = useState('');

  const [amount, setAmount] = useState('10');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const value = amountValue(amount);
  const toInterac = selectedId === INTERAC;
  const selected = methods.find(method => method.id === selectedId) ?? null;
  // Interac is the one destination that carries details rather than an id.
  const target = useMemo<WithdrawalTarget | null>(
    () =>
      toInterac
        ? { kind: 'interac', email: interacEmail.trim() }
        : selected
          ? { kind: 'saved', payoutMethodId: selected.id }
          : null,
    [interacEmail, selected, toInterac],
  );

  // ---------------------------------------------------------------------------
  // W1 — the methods a payout can be sent to
  // ---------------------------------------------------------------------------

  const start = useCallback(async () => {
    setActive(true);
    setScreen('amount');
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const available = await listWithdrawalMethods();
      setMethods(available);
      // The most recently used one leads, as on the deposit screen.
      setSelectedId(available[0]?.id ?? null);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const cancel = useCallback(() => {
    setActive(false);
    setError(null);
  }, []);

  // ---------------------------------------------------------------------------
  // W2 — create the payout
  // ---------------------------------------------------------------------------

  const confirmWithdrawal = useCallback(async () => {
    if (!target) {
      setScreen('methods');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const outcome = await withdraw(target, value);
      if (outcome.ok) {
        // However it ended, the player reads it back in the lobby.
        setStatus(outcome.message);
        setActive(false);
        onFinished();
      } else {
        setError(outcome.message);
      }
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }, [onFinished, target, value]);

  const canWithdraw =
    value > 0 &&
    (toInterac ? looksLikeEmail(interacEmail) : selected != null);

  return {
    active,
    screen,
    /** The lobby shows the last payout the same way it shows a deposit. */
    status,
    error: active ? null : error,

    start,

    amountProps: {
      amount,
      onAmountChange: setAmount,
      onQuickAmount: setAmount,
      selectionLabel: toInterac
        ? 'Interac'
        : selected
          ? payoutMethodLabel(selected)
          : loading
            ? 'Loading methods…'
            : 'No payout method',
      selectionNetwork: toInterac
        ? null
        : selected
          ? payoutMethodNetwork(selected)
          : null,
      onOpenMethods: () => setScreen('methods'),
      onBack: cancel,
      onWithdraw: confirmWithdrawal,
      canWithdraw,
      busy,
      loading,
      error: active ? error : null,
    },

    sheetProps: {
      methods,
      selectedId,
      onSelect: (id: string) => {
        setSelectedId(id);
        setError(null);
      },
      interacId: INTERAC,
      interacEmail,
      onInteracEmailChange: setInteracEmail,
      onBack: () => setScreen('amount'),
      amount: value,
      onWithdraw: confirmWithdrawal,
      canWithdraw,
      busy,
      error: active ? error : null,
    },
  };
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** The id the Interac row carries, where a stored method would carry its own. */
export const INTERAC = 'interac';

/** Enough of a check to keep an obviously wrong address out of a payout. */
function looksLikeEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}
