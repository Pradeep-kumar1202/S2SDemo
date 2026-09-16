import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import HyperGooglePayButton from '../../specs/HyperGooglePayNativeComponent';

/** com.google.android.gms.wallet.button.ButtonConstants.ButtonType */
export const GooglePayButtonType = {
  BUY: 1,
  BOOK: 2,
  CHECKOUT: 3,
  DONATE: 4,
  ORDER: 5,
  PAY: 6,
  SUBSCRIBE: 7,
  PLAIN: 8,
} as const;

/** com.google.android.gms.wallet.button.ButtonConstants.ButtonTheme */
export const GooglePayButtonTheme = { DARK: 1, LIGHT: 2 } as const;

type Props = {
  onPress: () => void;
  disabled?: boolean;
  type?: number;
  theme?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function GooglePayButton({
  onPress,
  disabled,
  type = GooglePayButtonType.PAY,
  theme = GooglePayButtonTheme.DARK,
  borderRadius = 8,
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.disabled, style]}
    >
      <HyperGooglePayButton
        type={type}
        appearance={theme}
        borderRadius={borderRadius}
        style={StyleSheet.absoluteFill}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { height: 48, width: '100%' },
  disabled: { opacity: 0.5 },
});
