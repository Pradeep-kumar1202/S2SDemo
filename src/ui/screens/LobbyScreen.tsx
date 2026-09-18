import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BALANCE, formatBalance } from '../money';
import { theme } from '../theme';

type Props = {
  onStart: () => void;
  loading: boolean;
  /** Outcome of the last deposit, shown on the way back from confirm. */
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
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Lobby</Text>
        <Text style={styles.balance}>Balance {formatBalance(BALANCE)}</Text>
      </View>

      <View style={styles.body}>
        {error ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{error}</Text>
          </View>
        ) : status ? (
          <View style={styles.receipt}>
            <Text style={styles.receiptTitle}>Last deposit</Text>
            <Text style={styles.receiptText}>{status}</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={onStart}
        disabled={loading}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.startButton,
          loading && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={theme.accentText} />
        ) : (
          <Text style={styles.startText}>Deposit</Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  header: { alignItems: 'center', paddingTop: 8, paddingBottom: 16 },
  title: { color: theme.text, fontSize: 17, fontWeight: '700' },
  balance: { color: theme.muted, fontSize: 12, marginTop: 2 },
  body: { flex: 1, justifyContent: 'center', gap: 12 },
  banner: { backgroundColor: theme.dangerBg, borderRadius: 8, padding: 12 },
  bannerText: { color: theme.danger, fontSize: 12 },
  receipt: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 4,
  },
  receiptTitle: { color: theme.muted, fontSize: 11 },
  receiptText: { color: theme.text, fontSize: 14 },
  startButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  startText: { color: theme.accentText, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
