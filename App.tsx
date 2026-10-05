/**
 * Deposit demo — server-to-server payments with Hyperswitch.
 *
 * This app is the client side of the deposit sequence diagram, and
 * `server/index.js` is the merchant server. Between them they implement
 * the deposit flow end to end: create an intent, put the player's amount on it,
 * collect a card or wallet, and confirm.
 *
 * Where to read:
 *   README.md                   setup, and the sequence diagram arrow by arrow
 *   src/flow/useDepositFlow.ts  the whole sequence in order, in one file
 *   src/flow/*.ts               one file per step, documenting its arrows
 *   src/ui/screens/*.tsx        rendering only — no flow logic lives here
 *   server/index.js             everything that needs the secret API key
 *
 * @format
 */

import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useDepositFlow } from './src/flow/useDepositFlow';
import { useWithdrawalFlow } from './src/flow/useWithdrawalFlow';
import { DepositScreen } from './src/ui/screens/DepositScreen';
import { LobbyScreen } from './src/ui/screens/LobbyScreen';
import { SelectPaymentMethodScreen } from './src/ui/screens/SelectPaymentMethodScreen';
import { SelectWithdrawalMethodScreen } from './src/ui/screens/SelectWithdrawalMethodScreen';
import { WithdrawalScreen } from './src/ui/screens/WithdrawalScreen';
import { theme } from './src/ui/theme';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <Cashier />
    </SafeAreaProvider>
  );
}

/**
 * The screens of both journeys. Which one shows is each flow's own state, so
 * this component is only a router — every decision lives in the hooks.
 *
 * The two journeys are separate hooks rather than one: they share the lobby and
 * nothing else. A deposit creates an intent and collects an instrument; a
 * withdrawal names a stored one and creates a payout.
 */
function Cashier() {
  const flow = useDepositFlow();
  const withdrawal = useWithdrawalFlow({ onFinished: () => {} });

  if (withdrawal.active) {
    return withdrawal.screen === 'methods' ? (
      <SelectWithdrawalMethodScreen {...withdrawal.sheetProps} />
    ) : (
      <View style={styles.root}>
        <WithdrawalScreen {...withdrawal.amountProps} />
      </View>
    );
  }

  if (flow.screen === 'methods' && flow.payment) {
    return <SelectPaymentMethodScreen payment={flow.payment} {...flow.sheetProps} />;
  }

  if (flow.screen === 'deposit' && flow.payment) {
    return (
      <View style={styles.root}>
        <DepositScreen payment={flow.payment} {...flow.depositProps} />
      </View>
    );
  }

  return (
    <LobbyScreen
      {...flow.lobbyProps}
      onWithdraw={withdrawal.start}
      // Whichever journey ran last is what the lobby reports.
      status={withdrawal.status ?? flow.lobbyProps.status}
      error={withdrawal.error ?? flow.lobbyProps.error}
      notice={withdrawal.status ? null : flow.lobbyProps.notice}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
});

export default App;
