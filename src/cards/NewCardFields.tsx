"use client";

import { forwardRef, useCallback, useRef } from "react";
import {
  CardCVCField,
  CardExpiryField,
  CardForm,
  CardNumberField,
  CardholderNameField,
} from "@juspay-tech/react-hyper-js";

import type { CreatePaymentResponse } from "../server/api";
import { CardSession } from "./CardSession";
import { ShimmerField } from "./ShimmerField";
import {
  SUBSCRIPTION_EVENTS,
  isCardDetailsChange,
  type CardFormChange,
  type CardFormEvent,
  type CardFormHandle,
} from "./types";

/**
 * Fields for a card the player has not saved yet.
 *
 * The cardholder name, PAN, expiry and CVC live in the vault's iframes —
 * `tokenize()` on the forwarded ref is the only way anything leaves them, and
 * it returns tokens, never card values.
 */
export const NewCardFields = forwardRef<
  CardFormHandle,
  {
    payment: CreatePaymentResponse;
    onComplete?: (complete: boolean) => void;
    onError?: (error: unknown) => void;
  }
>(function NewCardFields({ payment, onComplete, onError }, ref) {
  /*
   * The last word from each source, kept in refs so whichever reports second
   * can combine them without waiting for a render.
   */
  const cardComplete = useRef(false);
  const nameComplete = useRef(false);
  const reportComplete = useCallback(() => {
    onComplete?.(cardComplete.current);
  }, [onComplete]);

  /**
   * Completeness of the card, from the form as a whole.
   *
   * `cardDetailsChange` describes the number, expiry and CVC at once, so the
   * card is finished when each is complete. The SDK only sends it because the
   * fields subscribe to it in their `options` below.
   */
  const onFormChange = useCallback(
    (event: CardFormEvent) => {
      if (!isCardDetailsChange(event)) {
        return;
      }
      const card = event.payload;
      cardComplete.current =
        card.isCardNumberComplete &&
        card.isExpiryComplete &&
        card.isCvcComplete;
      reportComplete();
    },
    [reportComplete],
  );

  /**
   * Completeness of the cardholder name, from the field itself.
   *
   * `cardDetailsChange` says nothing about the name, so its own change event
   * is the only signal. The SDK calls a name complete once it is non-empty.
   */
  const onNameChange = useCallback(
    (event: CardFormChange) => {
      nameComplete.current = event.complete;
      reportComplete();
    },
    [reportComplete],
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
        <div className="field">
          <label>Cardholder name</label>
          <ShimmerField
            render={(onReady) => (
              <CardholderNameField
                options={NAME_OPTIONS}
                onChange={onNameChange}
                onReady={onReady}
              />
            )}
          />
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
const NAME_OPTIONS = { placeholder: "Name on card", subscriptionEvents };
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
