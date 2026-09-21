'use client';

/**
 * Apple's own Pay button.
 *
 * It needs no script: Safari draws the real button from the `-apple-pay-button`
 * appearance in CSS. That appearance exists only in Safari — and so does this
 * button, since Apple Pay is offered only where `canPayWithApplePay` holds (see
 * `src/wallets/applePay.ts`). There is no fallback for other browsers because
 * there is nothing for one to do: Apple Pay cannot run there.
 */
export function ApplePayButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="apple-pay-button"
      onClick={onPress}
      disabled={disabled}
      aria-label="Pay with Apple Pay"
    />
  );
}
