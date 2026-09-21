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
  | 'tokenization_in_progress'
  | 'confirm_in_progress'
  | 'unknown_outcome';

/** The SDK's failure shape, the `error` object out of `{ error: {...} }`. */
export type TokenizeError = {
  code: TokenizeErrorCode | string;
  message: string;
  type: string;
};

/**
 * What `tokenize()` resolves to.
 *
 * Deliberately untyped beyond a dictionary, because there is no one shape and
 * no `status` to branch on: a success is the vault's own response handed back
 * untouched, and an SDK-side failure is `{ error: { code, message, type } }`.
 * Read it with the two helpers below rather than reaching into it.
 */
export type TokenizeResult = Record<string, unknown>;

/**
 * The failure in a result, or null when it succeeded.
 *
 * Presence of an `error` object is the whole test — the same one the SDK makes
 * internally in `CardFormCoordinator.isErrorResult`.
 */
export function tokenizeError(result: TokenizeResult): TokenizeError | null {
  const error = result?.error;
  if (!error || typeof error !== 'object') {
    return null;
  }
  const { code, message, type } = error as Record<string, unknown>;
  return {
    code: typeof code === 'string' ? code : 'unknown_outcome',
    message:
      typeof message === 'string' ? message : 'The card could not be tokenized.',
    type: typeof type === 'string' ? type : 'api_error',
  };
}

/**
 * The vault token out of a successful result, or null if it carried none.
 *
 * It arrives as `associated_payment_methods[].payment_method_token.data`. The
 * list is searched rather than indexed because the vault decides what it puts
 * there, and an entry without a token is not an error on its own.
 */
export function vaultTokenOf(result: TokenizeResult): string | null {
  const methods = result?.associated_payment_methods;
  if (!Array.isArray(methods)) {
    return null;
  }
  for (const entry of methods) {
    const token = (entry as { payment_method_token?: { data?: unknown } })
      ?.payment_method_token?.data;
    if (typeof token === 'string' && token !== '') {
      return token;
    }
  }
  return null;
}

/** What a `<CardForm ref>` exposes — the only way to reach a token. */
export type CardFormHandle = {
  tokenize(providerData?: unknown): Promise<TokenizeResult>;
};

/**
 * A change event; never carries a card value.
 *
 * It reports one field, not the form: `elementType` says which. The form-level
 * `CardForm onChange` is not a substitute — it never fires on this surface, so
 * a form's own completeness is the three field events taken together.
 */
export type CardFormChange = {
  complete: boolean;
  valid: boolean;
  empty?: boolean;
  elementType?: string;
  brand?: string;
  error?: string;
};

/** The fields a new card needs before it can be tokenized. */
export const CARD_FIELDS = ['cardNumber', 'cardExpiry', 'cardCvc'] as const;
