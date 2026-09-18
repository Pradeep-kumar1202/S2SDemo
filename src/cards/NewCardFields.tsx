'use client';

import { forwardRef } from 'react';
import {
  CardCVCField,
  CardExpiryField,
  CardForm,
  CardNumberField,
} from '@juspay-tech/react-hyper-js';

import type { CreatePaymentResponse } from '../server/api';
import { CardSession } from './CardSession';
import type { CardFormChange, CardFormHandle } from './types';

/**
 * Fields for a card the player has not saved yet.
 *
 * The PAN, expiry and CVC live in the vault's iframes — `tokenize()` on the
 * forwarded ref is the only way anything leaves them, and it returns tokens,
 * never card values.
 */
export const NewCardFields = forwardRef<
  CardFormHandle,
  {
    payment: CreatePaymentResponse;
    onComplete?: (complete: boolean) => void;
    onError?: (error: unknown) => void;
  }
>(function NewCardFields({ payment, onComplete, onError }, ref) {
  return (
    <CardSession payment={payment} onError={onError}>
      <CardForm
        ref={ref}
        onChange={(event: CardFormChange) =>
          onComplete?.(event.complete && event.valid)
        }
      >
        <div className="field">
          <label>Card number</label>
          <CardNumberField placeholder="1234 5678 9012 3456" />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Expiry</label>
            <CardExpiryField placeholder="MM / YY" />
          </div>
          <div className="field">
            <label>CVC</label>
            <CardCVCField placeholder="123" />
          </div>
        </div>
      </CardForm>
    </CardSession>
  );
});
