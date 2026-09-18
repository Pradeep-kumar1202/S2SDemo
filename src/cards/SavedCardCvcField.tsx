import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  CardCVCField,
  CardForm,
  HyperPaymentMethodSession,
  type CardFormHandle,
} from '@juspay-tech/react-native-hyperswitch-payment-methods';

import type { CreatePaymentResponse, CustomerPaymentMethod } from '../server/api';
import { getHyper, vaultDetailsFor } from './vault';
import { cardNetwork } from '../paymentMethods';
import { theme } from '../ui/theme';

type Props = {
  payment: CreatePaymentResponse;
  method: CustomerPaymentMethod;
  /** 'pill' sits beside the method selector, 'row' inside the saved-card list. */
  variant?: 'pill' | 'row';
  onError?: (error: Error) => void;
};

/**
 * CVC re-collection for a stored card.
 *
 * The CVC field must be the only field in its form, and the card is named by
 * its payment token — `tokenize()` then refreshes that card's CVC instead of
 * collecting a new card. The digits stay inside the vault's secure input.
 */
export const SavedCardCvcField = forwardRef<CardFormHandle, Props>(
  function SavedCardCvcFieldInner({ payment, method, variant = 'row', onError }, ref) {
    const vaultDetails = useMemo(() => vaultDetailsFor(payment), [payment]);
    const hyper = useMemo(
      () => getHyper(payment.publishable_key ?? ''),
      [payment.publishable_key],
    );
    const options = useMemo(
      () =>
        vaultDetails
          ? { vaultDetails, appearance: { input: fieldStyles.input } }
          : null,
      [vaultDetails],
    );
    const fieldOptions = useMemo(
      () => ({
        savedCard: {
          // paymentMethodToken: method.payment_token,
          paymentMethodData: { card: { cardNetwork: cardNetwork(method) } },
        },
      }),
      [method],
    );

    if (!options) {
      return (
        <View style={[styles.box, styles[variant]]}>
          <Text style={styles.unavailable}>No vault</Text>
        </View>
      );
    }

    return (
      <HyperPaymentMethodSession hyper={hyper} options={options} onError={onError}>
        <CardForm ref={ref}>
          <CardCVCField
            options={fieldOptions}
            placeholder="CVC"
            styles={{
              container: StyleSheet.flatten([styles.box, styles[variant]]),
              input: fieldStyles.input,
            }}
          />
        </CardForm>
      </HyperPaymentMethodSession>
    );
  },
);

const fieldStyles = StyleSheet.create({
  input: { color: theme.text, fontSize: 13 },
});

const styles = StyleSheet.create({
  box: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceAlt,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  pill: { width: 68, height: 46, borderRadius: 10, backgroundColor: theme.surface },
  row: { width: 58, height: 38 },
  unavailable: { color: theme.muted, fontSize: 9 },
});
