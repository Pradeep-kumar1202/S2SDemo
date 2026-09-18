import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
    <View style={[styles.button, disabled && styles.disabled, style]}>
      <HyperGooglePayButton
        type={type}
        appearance={theme}
        borderRadius={borderRadius}
        style={StyleSheet.absoluteFill}
      />
      {/*
        Google's PayButton is a clickable native view, so a Pressable wrapped
        around it never sees the touch. The transparent Pressable is rendered
        after it, which puts it above in the native hierarchy and lets it take
        the tap instead.
      */}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Google Pay"
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { height: 48, width: '100%' },
  disabled: { opacity: 0.5 },
});
