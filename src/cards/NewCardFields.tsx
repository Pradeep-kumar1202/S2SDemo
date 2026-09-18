import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  CardCVCField,
  CardExpiryField,
  CardForm,
  CardNumberField,
  CardholderNameField,
  HyperPaymentMethodSession,
  type CardFormHandle,
} from '@juspay-tech/react-native-hyperswitch-payment-methods';

import type { CreatePaymentResponse } from '../server/api';
import { getHyper, vaultDetailsFor } from './vault';
import { theme } from '../ui/theme';

type Props = {
  payment: CreatePaymentResponse;
  onComplete?: (complete: boolean) => void;
  onError?: (error: Error) => void;
};

/**
 * Fields for a card the customer has not saved yet.
 *
 * The PAN, expiry and CVC live in the vault's secure inputs — `tokenize()` on
 * the forwarded ref is the only way anything leaves them, and it returns
 * tokens, never card values.
 */
export const NewCardFields = forwardRef<CardFormHandle, Props>(
  function NewCardFieldsInner({ payment, onComplete, onError }, ref) {
    const vaultDetails = useMemo(() => vaultDetailsFor(payment), [payment]);
    const hyper = useMemo(
      () => getHyper(payment.publishable_key ?? ''),
      [payment.publishable_key],
    );
    const options = useMemo(
      () => (vaultDetails ? { vaultDetails, appearance } : null),
      [vaultDetails],
    );

    if (!options) {
      return (
        <Text style={styles.hint}>
          This payment returned no vault details, so card fields cannot be shown.
        </Text>
      );
    }

    return (
      <HyperPaymentMethodSession hyper={hyper} options={options} onError={onError}>
        <CardForm
          ref={ref}
          onChange={event => onComplete?.(event.complete && event.valid)}
        >
          <View style={styles.fields}>
            <Text style={styles.label}>Card number</Text>
            <CardNumberField placeholder="1234 5678 9012 3456" />
            <View style={styles.pairRow}>
              <View style={styles.pairItem}>
                <Text style={styles.label}>Expiry</Text>
                <CardExpiryField placeholder="MM / YY" />
              </View>
              <View style={styles.pairItem}>
                <Text style={styles.label}>CVC</Text>
                <CardCVCField placeholder="123" options={{cvcIcon: "hidden"}} />
              </View>
            </View>
            <Text style={styles.label}>Name on card</Text>
            <CardholderNameField placeholder="John Doe" />
          </View>
        </CardForm>
      </HyperPaymentMethodSession>
    );
  },
);

/** Field defaults for every field below the session. */
const appearance = {
  container: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    backgroundColor: theme.surfaceAlt,
    height: 44,
    paddingHorizontal: 12,
  },
  input: { color: theme.text, fontSize: 15 },
};

const styles = StyleSheet.create({
  fields: { gap: 6, paddingHorizontal: 12, paddingBottom: 12 },
  label: { color: theme.muted, fontSize: 11, marginTop: 6 },
  pairRow: { flexDirection: 'row', gap: 12 },
  pairItem: { flex: 1 },
  hint: {
    color: theme.muted,
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
});
