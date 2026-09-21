/**
 * `@juspay-tech/react-hyper-js` ships no types, so the components this demo
 * uses are declared here. Anything not declared is still importable as `any`.
 */
declare module '@juspay-tech/react-hyper-js' {
  import type { ComponentType, ReactNode, Ref } from 'react';
  import type { CardFormChange, CardFormHandle } from '@/src/cards/types';

  export const HyperPaymentMethodSession: ComponentType<{
    hyper: unknown;
    options: { sdkAuthorization: string; appearance?: Record<string, unknown> };
    onError?: (error: unknown) => void;
    children: ReactNode;
  }>;

  export const CardForm: ComponentType<{
    ref?: Ref<CardFormHandle>;
    onChange?: (event: CardFormChange) => void;
    onReady?: () => void;
    children?: ReactNode;
  }>;

  /**
   * Note there is no `placeholder` prop. The SDK reads `placeholder` (and
   * `cvcIcon`) from `options` and ignores same-named props entirely, so one
   * passed here would silently do nothing and the field would keep the SDK's
   * own default text.
   */
  type FieldProps = {
    options?: Record<string, unknown>;
    className?: string;
    onChange?: (event: CardFormChange) => void;
    /** Fired once the field's iframe has booted and drawn its input. */
    onReady?: (event?: unknown) => void;
  };

  export const CardNumberField: ComponentType<FieldProps>;
  export const CardExpiryField: ComponentType<FieldProps>;
  export const CardCVCField: ComponentType<FieldProps>;
}

declare module '@juspay-tech/hyper-js' {
  export function loadHyper(
    publishableKey: string,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
}

/** pay.js attaches the Google Pay API to window once it has loaded. */
interface Window {
  google?: typeof google;
  /** Safari only; absent in every other browser. */
  ApplePaySession?: typeof ApplePaySession;
}
