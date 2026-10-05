import React, { useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardBrandMark } from '../CardBrandMark';
import {
  BALANCE,
  DEPOSIT_CURRENCY_SYMBOL,
  QUICK_AMOUNTS,
  formatAmount,
  formatBalance,
  sanitizeAmount,
} from '../money';
import { theme } from '../theme';

type Props = {
  amount: string;
  onAmountChange: (raw: string) => void;
  onQuickAmount: (value: string) => void;
  selectionLabel: string;
  selectionNetwork?: string | null;
  onOpenMethods: () => void;
  onBack: () => void;
  onWithdraw: () => void;
  canWithdraw: boolean;
  busy: boolean;
  loading: boolean;
  error?: string | null;
};

/**
 * Where the player says how much to take out, and to which stored method.
 *
 * The deposit screen's twin, minus everything a payout does not need: no CVC to
 * re-collect and no wallet sheet, because nothing is being authorised here —
 * the money is going the other way.
 */
export function WithdrawalScreen({
  amount,
  onAmountChange,
  onQuickAmount,
  selectionLabel,
  selectionNetwork,
  onOpenMethods,
  onBack,
  onWithdraw,
  canWithdraw,
  busy,
  loading,
  error,
}: Props) {
  const amountInput = useRef<React.ComponentRef<typeof TextInput>>(null);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
          >
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Withdraw</Text>
            <Text style={styles.balance}>Balance {formatBalance(BALANCE)}</Text>
          </View>
          <View style={styles.backSpacer} />
        </View>

        <Pressable
          onPress={onOpenMethods}
          disabled={busy || loading}
          accessibilityRole="button"
          style={({ pressed }) => [styles.methodPill, pressed && styles.pressed]}
        >
          {loading ? (
            <ActivityIndicator color={theme.muted} />
          ) : (
            <>
              <CardBrandMark network={selectionNetwork} />
              <Text style={styles.methodLabel} numberOfLines={1}>
                {selectionLabel}
              </Text>
              <Text style={styles.chevron}>⌄</Text>
            </>
          )}
        </Pressable>

        <View style={styles.amountArea}>
          <TextInput
            ref={amountInput}
            value={`${DEPOSIT_CURRENCY_SYMBOL}${amount}`}
            onChangeText={text => onAmountChange(sanitizeAmount(text))}
            keyboardType="decimal-pad"
            selectionColor={theme.accent}
            accessibilityLabel="Withdrawal amount"
            numberOfLines={1}
            style={styles.amount}
          />
        </View>

        <View style={styles.chips}>
          {QUICK_AMOUNTS.map(value => {
            const selected = amount === value;
            return (
              <Pressable
                key={value}
                onPress={() => onQuickAmount(value)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {formatAmount(Number(value))}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={onWithdraw}
          disabled={!canWithdraw || busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.withdrawButton,
            (!canWithdraw || busy) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={theme.accentText} />
          ) : (
            <Text style={styles.withdrawText}>
              Withdraw {formatAmount(amountValueOf(amount))}
            </Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const amountValueOf = (raw: string) => {
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  headerText: { flex: 1, alignItems: 'center' },
  back: { color: theme.text, fontSize: 28, width: 28, marginTop: -6 },
  backSpacer: { width: 28 },
  title: { color: theme.text, fontSize: 17, fontWeight: '700' },
  balance: { color: theme.muted, fontSize: 12, marginTop: 2 },
  methodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    height: 46,
  },
  methodLabel: { color: theme.text, fontSize: 14, flex: 1 },
  chevron: { color: theme.muted, fontSize: 16, marginTop: -6 },
  amountArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
  },
  amount: {
    color: theme.text,
    fontSize: 56,
    fontWeight: '700',
    textAlign: 'center',
    padding: 0,
    minWidth: 120,
  },
  chips: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginVertical: 12,
  },
  chip: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipText: { color: theme.text, fontSize: 15, fontWeight: '600' },
  chipTextSelected: { color: theme.accentText },
  banner: {
    backgroundColor: theme.dangerBg,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  bannerText: { color: theme.danger, fontSize: 12 },
  withdrawButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  disabled: { opacity: 0.45 },
  withdrawText: { color: theme.accentText, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
