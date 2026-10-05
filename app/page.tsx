'use client';

import { useDepositFlow } from '@/src/flow/useDepositFlow';
import { useWithdrawalFlow } from '@/src/flow/useWithdrawalFlow';
import { DepositScreen } from '@/src/ui/screens/DepositScreen';
import { LobbyScreen } from '@/src/ui/screens/LobbyScreen';
import { SelectPaymentMethodScreen } from '@/src/ui/screens/SelectPaymentMethodScreen';
import { SelectWithdrawalMethodScreen } from '@/src/ui/screens/SelectWithdrawalMethodScreen';
import { WithdrawalScreen } from '@/src/ui/screens/WithdrawalScreen';

/**
 * The screens of both journeys. Which one shows is each flow's own state, so
 * this component is only a router — every decision lives in the hooks.
 *
 * The two journeys are separate hooks rather than one: they share the lobby and
 * nothing else. A deposit creates an intent and collects an instrument; a
 * withdrawal names a stored one and creates a payout.
 */
export default function Page() {
  const flow = useDepositFlow();
  const withdrawal = useWithdrawalFlow({ onFinished: () => {} });

  return (
    <main className="phone">
      {withdrawal.active ? (
        withdrawal.screen === 'methods' ? (
          <SelectWithdrawalMethodScreen {...withdrawal.sheetProps} />
        ) : (
          <WithdrawalScreen {...withdrawal.amountProps} />
        )
      ) : flow.screen === 'methods' && flow.payment ? (
        <SelectPaymentMethodScreen payment={flow.payment} {...flow.sheetProps} />
      ) : flow.screen === 'deposit' && flow.payment ? (
        <DepositScreen payment={flow.payment} {...flow.depositProps} />
      ) : (
        <LobbyScreen
          {...flow.lobbyProps}
          onWithdraw={withdrawal.start}
          // Whichever journey ran last is what the lobby reports.
          status={withdrawal.status ?? flow.lobbyProps.status}
          error={withdrawal.error ?? flow.lobbyProps.error}
          notice={withdrawal.status ? null : flow.lobbyProps.notice}
        />
      )}
    </main>
  );
}
