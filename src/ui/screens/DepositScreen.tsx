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
import type { CardFormHandle } from '@juspay-tech/react-native-hyperswitch-payment-methods';

import type { CreatePaymentResponse, CustomerPaymentMethod } from '../../server/api';
import { ApplePayButton } from '../../wallets/ApplePayButton';
import { CardBrandMark } from '../CardBrandMark';
import { GooglePayButton } from '../../wallets/GooglePayButton';
import { SavedCardCvcField } from '../../cards/SavedCardCvcField';
import type { WalletName } from '../../paymentMethods';
import {
  BALANCE,
  QUICK_AMOUNTS,
  formatAmount,
  formatBalance,
  sanitizeAmount,
  DEPOSIT_CURRENCY_SYMBOL,
} from '../money';
import { theme } from '../theme';

type Props = {
  amount: string;
  onAmountChange: (raw: string) => void;
  onQuickAmount: (value: string) => void;
  selectionLabel: string;
  selectionNetwork?: string | null;
  onOpenMethods: () => void;
  /** Payment + saved card whose CVC is re-collected beside the selector. */
  payment: CreatePaymentResponse;
  cvcCard: CustomerPaymentMethod | null;
  cvcFormRef: React.Ref<CardFormHandle>;
  /** Set when the latest stored method is a wallet: its button replaces Deposit. */
  wallet: WalletName | null;
  walletReady: boolean;
  onWalletPress: () => void;
  onDeposit: () => void;
  canDeposit: boolean;
  busy: boolean;
  status?: string | null;
  error?: string | null;
};

export function DepositScreen({
  amount,
  onAmountChange,
  onQuickAmount,
  selectionLabel,
  selectionNetwork,
  onOpenMethods,
  payment,
  cvcCard,
  cvcFormRef,
  wallet,
  walletReady,
  onWalletPress,
  onDeposit,
  canDeposit,
  busy,
  status,
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
          <Text style={styles.title}>Deposit</Text>
          <Text style={styles.balance}>Balance {formatBalance(BALANCE)}</Text>
        </View>

        <View style={styles.methodRow}>
          <Pressable
            onPress={onOpenMethods}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.methodPill,
              pressed && styles.pressed,
            ]}
          >
            <CardBrandMark network={selectionNetwork} />
            <Text style={styles.methodLabel} numberOfLines={1}>
              {selectionLabel}
            </Text>
            <Text style={styles.chevron}>⌄</Text>
          </Pressable>

          {cvcCard ? (
            <SavedCardCvcField
              ref={cvcFormRef}
              payment={payment}
              method={cvcCard}
              variant="pill"
            />
          ) : null}
        </View>

        <View style={styles.amountArea}>
          {/*
            The amount is a real input, so the system number pad drives it and
            there is no second copy of the value to keep in sync.
          */}
          <TextInput
            ref={amountInput}
            value={`${DEPOSIT_CURRENCY_SYMBOL}${amount}`}
            onChangeText={text => onAmountChange(sanitizeAmount(text))}
            keyboardType="decimal-pad"
            selectionColor={theme.accent}
            accessibilityLabel="Deposit amount"
            numberOfLines={1}
            style={styles.amount}
          />
        </View>

        <Pressable accessibilityRole="link" style={styles.limitsLink}>
          <Text style={styles.limitsText}>Manage Deposit Limits</Text>
        </Pressable>

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
        ) : status ? (
          <Text style={styles.status}>{status}</Text>
        ) : null}

        {wallet === 'apple_pay' ? (
          <ApplePayButton
            onPress={onWalletPress}
            disabled={busy || !walletReady || !canDeposit}
            style={styles.walletButton}
          />
        ) : wallet === 'google_pay' ? (
          <GooglePayButton
            onPress={onWalletPress}
            disabled={busy || !walletReady || !canDeposit}
            style={styles.walletButton}
          />
        ) : (
          <Pressable
            onPress={onDeposit}
            disabled={!canDeposit || busy}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.depositButton,
              (!canDeposit || busy) && styles.depositDisabled,
              pressed && styles.pressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={theme.accentText} />
            ) : (
              <Text style={styles.depositText}>Deposit</Text>
            )}
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  header: { alignItems: 'center', paddingTop: 8, paddingBottom: 16 },
  title: { color: theme.text, fontSize: 17, fontWeight: '700' },
  balance: { color: theme.muted, fontSize: 12, marginTop: 2 },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodPill: {
    flex: 1,
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
    flexDirection: 'row',
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
  limitsLink: { alignSelf: 'center', paddingVertical: 8 },
  limitsText: { color: theme.accent, fontSize: 12, fontWeight: '600' },
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
  status: {
    color: theme.muted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  depositButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  walletButton: { height: 48, marginBottom: 16 },
  depositDisabled: { opacity: 0.45 },
  depositText: { color: theme.accentText, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
