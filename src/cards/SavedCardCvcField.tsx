'use client';

import { forwardRef, useMemo } from 'react';
import { CardCVCField, CardForm } from '@juspay-tech/react-hyper-js';

import type { CreatePaymentResponse, CustomerPaymentMethod } from '../server/api';
import { cardNetwork } from '../paymentMethods';
import { CardSession } from './CardSession';
import type { CardFormHandle } from './types';

/**
 * CVC re-collection for a stored card.
 *
 * The CVC field must be the only field in its form, and the card is named by
 * its payment token — `tokenize()` then refreshes that card's CVC instead of
 * collecting a new card. The digits stay inside the vault's iframe.
 */
export const SavedCardCvcField = forwardRef<
  CardFormHandle,
  {
    payment: CreatePaymentResponse;
    method: CustomerPaymentMethod;
    onError?: (error: unknown) => void;
  }
>(function SavedCardCvcField({ payment, method, onError }, ref) {
  const options = useMemo(
    () => ({
      savedCard: {
        paymentMethodToken: method.payment_token,
        paymentMethodData: { card: { cardNetwork: cardNetwork(method) } },
      },
    }),
    [method],
  );

  return (
    <CardSession payment={payment} onError={onError}>
      <CardForm ref={ref}>
        <CardCVCField options={options} placeholder="CVC" />
      </CardForm>
    </CardSession>
  );
});
