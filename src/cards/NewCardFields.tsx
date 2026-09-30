"use client";

import { forwardRef, useCallback } from "react";
import {
  CardCVCField,
  CardExpiryField,
  CardForm,
  CardNumberField,
} from "@juspay-tech/react-hyper-js";

import type { CreatePaymentResponse } from "../server/api";
import { CardSession } from "./CardSession";
import { ShimmerField } from "./ShimmerField";
import {
  SUBSCRIPTION_EVENTS,
  isCardDetailsChange,
  type CardFormEvent,
  type CardFormHandle,
} from "./types";

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
   * Completeness, from the form as a whole.
   *
   * `cardDetailsChange` describes all three fields at once, so the form is
   * finished when its number, expiry and CVC are each complete. The SDK only
   * sends it because the fields subscribe to it in their `options` below.
   */
  const onFormChange = useCallback(
    (event: CardFormEvent) => {
      if (!isCardDetailsChange(event)) {
        return;
      }
      const card = event.payload;
      onComplete?.(
        card.isCardNumberComplete &&
          card.isExpiryComplete &&
          card.isCvcComplete,
      );
    },
    [onComplete],
  );

  return (
    <CardSession payment={payment} onError={onError}>
      <CardForm ref={ref} onChange={onFormChange}>
        <div className="field">
          <label>Card number</label>
          <ShimmerField
            render={(onReady) => (
              <CardNumberField options={NUMBER_OPTIONS} onReady={onReady} />
            )}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Expiry</label>
            <ShimmerField
              render={(onReady) => (
                <CardExpiryField options={EXPIRY_OPTIONS} onReady={onReady} />
              )}
            />
          </div>
          <div className="field">
            <label>CVC</label>
            <ShimmerField
              render={(onReady) => (
                <CardCVCField options={CVC_OPTIONS} onReady={onReady} />
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
 * demo. Each field names the form's subscriptions too: one would be enough,
 * but then which field mounts first would matter. Module constants so their
 * identity is stable across renders.
 */
const subscriptionEvents = [...SUBSCRIPTION_EVENTS];
const NUMBER_OPTIONS = {
  placeholder: "1234 5678 9012 3456",
  subscriptionEvents,
};
const EXPIRY_OPTIONS = { placeholder: "MM / YY", subscriptionEvents };
const CVC_OPTIONS = {
  placeholder: "CVC",
  cvcIcon: "hidden",
  subscriptionEvents,
};
