'use client';

import { useDepositFlow } from '@/src/flow/useDepositFlow';
import { DepositScreen } from '@/src/ui/screens/DepositScreen';
import { LobbyScreen } from '@/src/ui/screens/LobbyScreen';
import { SelectPaymentMethodScreen } from '@/src/ui/screens/SelectPaymentMethodScreen';

/**
 * The three screens of the flow. Which one shows is the flow's own state, so
 * this component is only a router — every decision lives in useDepositFlow.
 */
export default function Page() {
  const flow = useDepositFlow();

  return (
    <main className="phone">
      {flow.screen === 'methods' && flow.payment ? (
        <SelectPaymentMethodScreen payment={flow.payment} {...flow.sheetProps} />
      ) : flow.screen === 'deposit' && flow.payment ? (
        <DepositScreen payment={flow.payment} {...flow.depositProps} />
      ) : (
        <LobbyScreen {...flow.lobbyProps} />
      )}
    </main>
  );
}
