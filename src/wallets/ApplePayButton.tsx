import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import HyperApplePayButton from '../../specs/HyperApplePayNativeComponent';

/** PKPaymentButtonType */
export const ApplePayButtonType = {
  PLAIN: 0,
  BUY: 1,
  SET_UP: 2,
  IN_STORE: 3,
  DONATE: 4,
  CHECKOUT: 5,
  BOOK: 6,
  SUBSCRIBE: 7,
} as const;

/** PKPaymentButtonStyle */
export const ApplePayButtonStyle = {
  WHITE: 0,
  WHITE_OUTLINE: 1,
  BLACK: 2,
  AUTOMATIC: 3,
} as const;

type Props = {
  onPress: () => void;
  disabled?: boolean;
  type?: number;
  buttonStyle?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function ApplePayButton({
  onPress,
  disabled,
  type = ApplePayButtonType.PLAIN,
  buttonStyle = ApplePayButtonStyle.BLACK,
  borderRadius = 8,
  style,
}: Props) {
  return (
    <View style={[styles.button, disabled && styles.disabled, style]}>
      <HyperApplePayButton
        type={type}
        buttonStyle={buttonStyle}
        buttonBorderRadius={borderRadius}
        disabled={disabled}
        style={StyleSheet.absoluteFill}
      />
      {/*
        PKPaymentButton is a UIButton, so like Google's PayButton it takes the
        touch before a Pressable wrapped around it can. The transparent
        Pressable renders above it and handles the tap instead.
      */}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Apple Pay"
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { height: 48, width: '100%' },
  disabled: { opacity: 0.5 },
});
