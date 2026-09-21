'use client';

import { forwardRef, useCallback, useEffect, useState } from 'react';
import {
  CardCVCField,
  CardExpiryField,
  CardForm,
  CardNumberField,
} from '@juspay-tech/react-hyper-js';

import type { CreatePaymentResponse } from '../server/api';
import { CardSession } from './CardSession';
import { ShimmerField } from './ShimmerField';
import { CARD_FIELDS, type CardFormChange, type CardFormHandle } from './types';

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
  /**
   * Completeness, one field at a time.
   *
   * A change event describes only the field that raised it, so the form is
   * finished when all three have reported themselves complete and valid.
   * `CardForm`'s own `onChange` would be the obvious place for this, but it
   * never fires on this surface, so the answer is assembled here instead.
   */
  const [done, setDone] = useState<Record<string, boolean>>({});

  const onFieldChange = useCallback((event: CardFormChange) => {
    const field = event.elementType;
    if (!field) {
      return;
    }
    const complete = event.complete && event.valid;
    // The fields chatter on every keystroke; only transitions matter.
    setDone(prev => (prev[field] === complete ? prev : { ...prev, [field]: complete }));
  }, []);

  useEffect(() => {
    onComplete?.(CARD_FIELDS.every(field => done[field]));
  }, [done, onComplete]);

  return (
    <CardSession payment={payment} onError={onError}>
      <CardForm ref={ref}>
        <div className="field">
          <label>Card number</label>
          <ShimmerField
            render={onReady => (
              <CardNumberField
                options={NUMBER_OPTIONS}
                onReady={onReady}
                onChange={onFieldChange}
              />
            )}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Expiry</label>
            <ShimmerField
              render={onReady => (
                <CardExpiryField
                  options={EXPIRY_OPTIONS}
                  onReady={onReady}
                  onChange={onFieldChange}
                />
              )}
            />
          </div>
          <div className="field">
            <label>CVC</label>
            <ShimmerField
              render={onReady => (
                <CardCVCField
                  options={CVC_OPTIONS}
                  onReady={onReady}
                  onChange={onFieldChange}
                />
              )}
            />
          </div>
        </div>
      </CardForm>
    </CardSession>
  );
});

/*
 * Placeholders live in `options` — the SDK ignores a `placeholder` prop — and
 * the CVC glyph is hidden so the digits get the whole box, as on the native
 * demo. Module constants so their identity is stable across renders.
 */
const NUMBER_OPTIONS = { placeholder: '1234 5678 9012 3456' };
const EXPIRY_OPTIONS = { placeholder: 'MM / YY' };
const CVC_OPTIONS = { placeholder: 'CVC', cvcIcon: 'hidden' };
