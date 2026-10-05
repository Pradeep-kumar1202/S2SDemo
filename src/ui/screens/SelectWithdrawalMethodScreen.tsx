import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  payoutMethodLabel,
  payoutMethodNetwork,
} from '../../flow/listWithdrawalMethods';
import type { PayoutMethod } from '../../server/api';
import { CardBrandMark } from '../CardBrandMark';
import { formatAmount } from '../money';
import { theme } from '../theme';

type Props = {
  methods: PayoutMethod[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The id the Interac row carries; stored methods carry their own. */
  interacId: string;
  interacEmail: string;
  onInteracEmailChange: (email: string) => void;
  onBack: () => void;
  amount: number;
  onWithdraw: () => void;
  canWithdraw: boolean;
  busy: boolean;
  error?: string | null;
};

/**
 * Where the payout is going.
 *
 * One list, not two: a payout method is already a stored instrument, so there
 * is nothing to collect here — no card form, no CVC, no wallet sheet. That is
 * the whole difference from the deposit sheet.
 */
export function SelectWithdrawalMethodScreen({
  methods,
  selectedId,
  onSelect,
  interacId,
  interacEmail,
  onInteracEmailChange,
  onBack,
  amount,
  onWithdraw,
  canWithdraw,
  busy,
  error,
}: Props) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
        >
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Withdraw to</Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {methods.length > 0 ? (
          <View style={styles.card}>
            {methods.map((method, index) => {
              const selected = method.id === selectedId;
              return (
                <Pressable
                  key={method.id}
                  onPress={() => onSelect(method.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.row,
                    // Only between rows: the card's own border is the top edge.
                    index > 0 && styles.rowDivider,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <CardBrandMark network={payoutMethodNetwork(method)} />
                  <Text style={styles.label} numberOfLines={1}>
                    {payoutMethodLabel(method)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.hint}>
            This player has no method a payout can be sent to.
          </Text>
        )}

        {/*
          Interac is not a stored method: there is nothing on file to name, so
          the payout carries the email instead. Selecting it opens that field
          in place, the way the deposit sheet opens its card form.
        */}
        <Text style={styles.sectionTitle}>Other</Text>
        <View
          style={[
            styles.card,
            selectedId === interacId && styles.cardSelected,
          ]}
        >
          <Pressable
            onPress={() => onSelect(interacId)}
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedId === interacId }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View
              style={[
                styles.radio,
                selectedId === interacId && styles.radioSelected,
              ]}
            >
              {selectedId === interacId ? <View style={styles.radioDot} /> : null}
            </View>
            <CardBrandMark network="interac" />
            <Text style={styles.label}>Interac</Text>
          </Pressable>

          {selectedId === interacId ? (
            <View style={styles.interacFields}>
              <Text style={styles.fieldLabel}>Email for the transfer</Text>
              <TextInput
                value={interacEmail}
                onChangeText={onInteracEmailChange}
                placeholder="john.doe@example.com"
                placeholderTextColor={theme.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.interacInput}
                accessibilityLabel="Email for the Interac transfer"
              />
            </View>
          ) : null}
        </View>

        {error ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
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
              Withdraw {formatAmount(amount)}
            </Text>
          )}
        </Pressable>
        <Text style={styles.secure}>🔒 Payouts go to your saved methods only</Text>
      </View>
    </SafeAreaView>
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
  card: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    // Matches the deposit sheet's saved rows, so the two lists sit alike.
    paddingVertical: 10,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: theme.border },
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
  label: { color: theme.text, fontSize: 13, flex: 1 },
  cardSelected: { borderColor: theme.accent },
  sectionTitle: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  interacFields: { paddingHorizontal: 12, paddingBottom: 12, gap: 4 },
  fieldLabel: { color: theme.muted, fontSize: 11 },
  interacInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceAlt,
    paddingHorizontal: 12,
    color: theme.text,
    fontSize: 15,
  },
  hint: { color: theme.muted, fontSize: 12, textAlign: 'center' },
  banner: { backgroundColor: theme.dangerBg, borderRadius: 8, padding: 10 },
  bannerText: { color: theme.danger, fontSize: 12 },
  footer: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  withdrawButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  withdrawText: { color: theme.accentText, fontSize: 16, fontWeight: '700' },
  secure: { color: theme.muted, fontSize: 11, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
