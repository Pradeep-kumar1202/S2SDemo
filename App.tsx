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
import { DepositScreen } from './src/ui/screens/DepositScreen';
import { LobbyScreen } from './src/ui/screens/LobbyScreen';
import { SelectPaymentMethodScreen } from './src/ui/screens/SelectPaymentMethodScreen';
import { theme } from './src/ui/theme';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <Deposit />
    </SafeAreaProvider>
  );
}

/**
 * The three screens of the flow. Which one shows is the flow's own state, so
 * this component is only a router — every decision lives in useDepositFlow.
 */
function Deposit() {
  const flow = useDepositFlow();

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

  return <LobbyScreen {...flow.lobbyProps} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
});

export default App;
