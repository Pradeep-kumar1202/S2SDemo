import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Small brand badge for a card network, drawn with views only so the demo
 * needs no image assets.
 */
export function CardBrandMark({ network }: { network?: string | null }) {
  const brand = (network ?? '').toLowerCase();

  if (brand === 'google_pay') {
    return (
      <View style={[styles.badge, styles.wallet]}>
        <Text style={styles.googleG}>G</Text>
        <Text style={styles.walletPay}>Pay</Text>
      </View>
    );
  }

  if (brand === 'apple_pay') {
    return (
      <View style={[styles.badge, styles.applePay]}>
        <Text style={styles.applePayText}>Pay</Text>
      </View>
    );
  }

  if (brand.includes('master')) {
    return (
      <View style={[styles.badge, styles.mastercard]}>
        <View style={[styles.circle, styles.circleRed]} />
        <View style={[styles.circle, styles.circleYellow]} />
      </View>
    );
  }

  if (brand.includes('visa')) {
    return (
      <View style={[styles.badge, styles.visa]}>
        <Text style={styles.visaText}>VISA</Text>
      </View>
    );
  }

  if (brand.includes('american') || brand.includes('amex')) {
    return (
      <View style={[styles.badge, styles.amex]}>
        <Text style={styles.amexText}>AMEX</Text>
      </View>
    );
  }

  const label = (network ?? 'Card').slice(0, 4).toUpperCase();
  return (
    <View style={[styles.badge, styles.generic]}>
      <Text style={styles.genericText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 32,
    height: 22,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  visa: { backgroundColor: '#1A1F71' },
  visaText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  mastercard: { backgroundColor: '#FFFFFF' },
  circle: { width: 14, height: 14, borderRadius: 7 },
  circleRed: { backgroundColor: '#EB001B', marginRight: -5 },
  circleYellow: { backgroundColor: '#F79E1B', opacity: 0.9 },
  amex: { backgroundColor: '#2E77BC' },
  amexText: { color: '#FFFFFF', fontSize: 8, fontWeight: '800' },
  wallet: { backgroundColor: '#FFFFFF', gap: 2 },
  googleG: { color: '#4285F4', fontSize: 11, fontWeight: '800' },
  walletPay: { color: '#3C4043', fontSize: 10, fontWeight: '600' },
  applePay: { backgroundColor: '#000000', borderWidth: 1, borderColor: '#3A3A3C' },
  applePayText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' },
  generic: { backgroundColor: '#E5E7EB' },
  genericText: { color: '#111827', fontSize: 8, fontWeight: '700' },
});
