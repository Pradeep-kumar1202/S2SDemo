/**
 * Minimal typings for `@juspay-tech/react-hyper-js`, which ships none.
 *
 * Only what this demo uses is declared. The shapes mirror the React Native
 * Hosted Card Fields SDK, which is deliberate: the same integration reads the
 * same on both platforms.
 */

export type TokenizeErrorCode =
  | 'validation_error'
  | 'incomplete_field_set'
  | 'unsupported_configuration'
  | 'sdk_not_ready'
  | 'session_expired'
  | 'session_consumed'
  | 'invalid_session'
  | 'tokenization_failed'
  | 'unknown_outcome';

export type TokenizeResult =
  | {
      status: 'success';
      data?: { tokens?: Record<string, unknown>; savedCard?: unknown };
      card?: { bin?: string; last4?: string; brand?: string };
    }
  | {
      status: 'validation_error' | 'error';
      error: { code: TokenizeErrorCode; message: string; type: string };
    };

/** What a `<CardForm ref>` exposes — the only way to reach a token. */
export type CardFormHandle = {
  tokenize(providerData?: unknown): Promise<TokenizeResult>;
};

/** The change event the form publishes; never carries a card value. */
export type CardFormChange = {
  complete: boolean;
  valid: boolean;
};
