import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CardFormHandle } from '@juspay-tech/react-native-hyperswitch-payment-methods';

import type { CreatePaymentResponse, CustomerPaymentMethod } from '../../server/api';
import { ApplePayButton } from '../../wallets/ApplePayButton';
import { CardBrandMark } from '../CardBrandMark';
import { GooglePayButton } from '../../wallets/GooglePayButton';
import { NewCardFields } from '../../cards/NewCardFields';
import { SavedCardCvcField } from '../../cards/SavedCardCvcField';
import { formatAmount } from '../money';
import {
  cardNetwork,
  findWalletToken,
  otherPaymentMethods,
  requiresCvc,
  savedWalletNames,
  sortedSavedMethods,
  walletLabel,
  walletNameOf,
  type SelectedMethod,
  type WalletName,
} from '../../paymentMethods';
import { theme } from '../theme';

type Props = {
  payment: CreatePaymentResponse;
  selected: SelectedMethod | null;
  onSelect: (method: SelectedMethod) => void;
  onBack: () => void;
  /** CVC form for the selected saved card; tokenized when Deposit is pressed. */
  cvcFormRef: React.Ref<CardFormHandle>;
  /** New-card form expanded under the Card row; tokenized the same way. */
  cardFormRef: React.Ref<CardFormHandle>;
  onCardComplete: (complete: boolean) => void;
  amount: number;
  onDeposit: () => void;
  canDeposit: boolean;
  busy: boolean;
  error?: string | null;
  applePayReady: boolean;
  googlePayReady: boolean;
  /** Wallets this payment can actually use; anything else is hidden. */
  offeredWallets: WalletName[];
  onApplePay: () => void;
  onGooglePay: () => void;
};

export function SelectPaymentMethodScreen({
  payment,
  selected,
  onSelect,
  onBack,
  cvcFormRef,
  cardFormRef,
  onCardComplete,
  amount,
  onDeposit,
  canDeposit,
  busy,
  error,
  applePayReady,
  googlePayReady,
  offeredWallets,
  onApplePay,
  onGooglePay,
}: Props) {
  const [savedOpen, setSavedOpen] = useState(true);

  // Every stored method, cards and wallets alike, most recently used first.
  const savedMethods = sortedSavedMethods(payment.payment_method_list);
  const otherMethods = otherPaymentMethods(payment.payment_method_list);

  // A wallet already listed as a saved row does not also get a button up top.
  const savedWallets = savedWalletNames(payment.payment_method_list);
  const applePayToken = findWalletToken(payment, 'apple_pay');
  const googlePayToken = findWalletToken(payment, 'google_pay');
  const showApplePay =
    Platform.OS === 'ios' &&
    applePayToken != null &&
    offeredWallets.includes('apple_pay') &&
    !savedWallets.includes('apple_pay');
  const showGooglePay =
    Platform.OS === 'android' &&
    googlePayToken != null &&
    offeredWallets.includes('google_pay') &&
    !savedWallets.includes('google_pay');

  /** Selecting a wallet turns the Deposit button into that wallet's button. */
  const selectedWallet: WalletName | null =
    selected?.kind === 'wallet' ? selected.wallet : null;
  const selectedWalletReady =
    selectedWallet === 'apple_pay' ? applePayReady : googlePayReady;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Select Payment Method</Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {showApplePay ? (
          <ApplePayButton
            onPress={onApplePay}
            disabled={busy || !applePayReady}
            style={styles.walletButton}
          />
        ) : null}
        {showGooglePay ? (
          <GooglePayButton
            onPress={onGooglePay}
            disabled={busy || !googlePayReady}
            style={styles.walletButton}
          />
        ) : null}
        {savedMethods.length > 0 ? (
          <View style={styles.card}>
            <Pressable
              onPress={() => setSavedOpen(open => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: savedOpen }}
              style={styles.accordionHeader}
            >
              <View style={styles.savedIcon}>
                <Text style={styles.savedIconText}>▤</Text>
              </View>
              <Text style={styles.accordionTitle}>Saved</Text>
              <Text style={styles.chevron}>{savedOpen ? '⌃' : '⌄'}</Text>
            </Pressable>

            {savedOpen
              ? savedMethods.map(method => {
                  const wallet = walletNameOf(method);
                  if (wallet && !offeredWallets.includes(wallet)) {
                    return null;
                  }
                  return wallet ? (
                    <SavedWalletRow
                      key={method.payment_token}
                      wallet={wallet}
                      selected={selected?.kind === 'wallet' && selected.wallet === wallet}
                      onSelect={() => onSelect({ kind: 'wallet', wallet })}
                    />
                  ) : (
                    <SavedCardRow
                      key={method.payment_token}
                      payment={payment}
                      method={method}
                      selected={
                        selected?.kind === 'saved' &&
                        selected.paymentToken === method.payment_token
                      }
                      onSelect={() =>
                        onSelect({ kind: 'saved', paymentToken: method.payment_token })
                      }
                      cvcFormRef={cvcFormRef}
                    />
                  );
                })
              : null}
          </View>
        ) : null}

        {otherMethods.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Other</Text>
            {otherMethods.map(method => {
              const isSelected =
                selected?.kind === 'new_card' &&
                selected.paymentMethod === method.paymentMethod;
              return (
                <View
                  key={method.paymentMethod}
                  style={[styles.otherCard, isSelected && styles.otherRowSelected]}
                >
                  <Pressable
                    onPress={() =>
                      onSelect({ kind: 'new_card', paymentMethod: method.paymentMethod })
                    }
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected, expanded: isSelected }}
                    style={({ pressed }) => [styles.otherRow, pressed && styles.pressed]}
                  >
                    <View style={styles.otherIcon}>
                      <Text style={styles.otherIconText}>▢</Text>
                    </View>
                    <Text style={styles.otherLabel}>{method.label}</Text>
                    <Text style={styles.chevron}>{isSelected ? '⌃' : '⌄'}</Text>
                  </Pressable>

                  {/* Selecting the row expands its fields in place. */}
                  {isSelected && method.paymentMethod === 'card' ? (
                    <NewCardFields
                      ref={cardFormRef}
                      payment={payment}
                      onComplete={onCardComplete}
                    />
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}

        {error ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {selectedWallet === 'apple_pay' ? (
          <ApplePayButton
            onPress={onApplePay}
            disabled={busy || !selectedWalletReady || !canDeposit}
            style={styles.walletButton}
          />
        ) : selectedWallet === 'google_pay' ? (
          <GooglePayButton
            onPress={onGooglePay}
            disabled={busy || !selectedWalletReady || !canDeposit}
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
              <Text style={styles.depositText}>Deposit {formatAmount(amount)}</Text>
            )}
          </Pressable>
        )}
        <Text style={styles.secure}>🔒 Your deposit is secure and encrypted</Text>
      </View>
    </SafeAreaView>
  );
}

/** A wallet the customer has used before, listed beside their saved cards. */
function SavedWalletRow({
  wallet,
  selected,
  onSelect,
}: {
  wallet: WalletName;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.savedRow, pressed && styles.pressed]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <CardBrandMark network={wallet} />
      <Text style={styles.savedLabel} numberOfLines={1}>
        {walletLabel(wallet)}
      </Text>
    </Pressable>
  );
}

function SavedCardRow({
  payment,
  method,
  selected,
  onSelect,
  cvcFormRef,
}: {
  payment: CreatePaymentResponse;
  method: CustomerPaymentMethod;
  selected: boolean;
  onSelect: () => void;
  cvcFormRef: React.Ref<CardFormHandle>;
}) {
  const card = method.payment_method_data?.card;
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.savedRow, pressed && styles.pressed]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <CardBrandMark network={cardNetwork(method)} />
      <Text style={styles.savedLabel} numberOfLines={1}>
        •••• {card?.last4_digits ?? '••••'}
      </Text>
      {selected && requiresCvc(method) ? (
        <SavedCardCvcField
          ref={cvcFormRef}
          payment={payment}
          method={method}
          variant="row"
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { color: theme.text, fontSize: 28, width: 28, marginTop: -6 },
  backSpacer: { width: 28 },
  title: { color: theme.text, fontSize: 15, fontWeight: '700', flex: 1 },
  content: { padding: 16, gap: 12 },
  walletButton: { height: 46 },
  hint: { color: theme.muted, fontSize: 11, textAlign: 'center' },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  savedIcon: {
    width: 28,
    height: 22,
    borderRadius: 4,
    backgroundColor: theme.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedIconText: { color: theme.muted, fontSize: 12 },
  accordionTitle: { color: theme.text, fontSize: 13, fontWeight: '700', flex: 1 },
  chevron: { color: theme.muted, fontSize: 14 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: theme.accent },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.accent,
  },
  savedLabel: { color: theme.text, fontSize: 13, flex: 1, letterSpacing: 1 },
  sectionTitle: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  otherCard: {
    backgroundColor: theme.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  otherRowSelected: { borderColor: theme.accent },
  otherIcon: {
    width: 28,
    height: 22,
    borderRadius: 4,
    backgroundColor: theme.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherIconText: { color: theme.muted, fontSize: 12 },
  otherLabel: { color: theme.text, fontSize: 13, flex: 1 },
  banner: { backgroundColor: theme.dangerBg, borderRadius: 8, padding: 10 },
  bannerText: { color: theme.danger, fontSize: 12 },
  footer: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  depositButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositDisabled: { opacity: 0.45 },
  depositText: { color: theme.accentText, fontSize: 16, fontWeight: '700' },
  secure: { color: theme.muted, fontSize: 11, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
