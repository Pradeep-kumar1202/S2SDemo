/**
 * S2S Demo: server-to-server Hyperswitch checkout with native Google Pay / Apple Pay.
 *
 * 1. mockServer.js creates the payment and returns wallet session tokens.
 * 2. The app presents the native wallet sheet with that token.
 * 3. The wallet token is sent back to mockServer.js, which confirms the payment.
 *
 * @format
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import {
  confirmPayment,
  createPayment,
  type ApplePaySessionToken,
  type ConfirmPaymentResponse,
  type CreatePaymentResponse,
  type GooglePaySessionToken,
  type WalletPaymentMethodData,
} from './src/api';
import { ApplePayError, canMakePayments, isApplePaySupported, payWithApplePay } from './src/applePay';
import {
  GooglePayError,
  googlePayEnvironment,
  isGooglePaySupported,
  isReadyToPay,
  payWithGooglePay,
} from './src/googlePay';
import { ApplePayButton } from './src/components/ApplePayButton';
import { GooglePayButton } from './src/components/GooglePayButton';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Checkout />
    </SafeAreaProvider>
  );
}

function Checkout() {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const [payment, setPayment] = useState<CreatePaymentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ConfirmPaymentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [googlePayReady, setGooglePayReady] = useState(false);
  const [applePayReady, setApplePayReady] = useState(false);

  const googlePayToken = payment?.session_tokens.session_token.find(
    (t): t is GooglePaySessionToken => t.wallet_name === 'google_pay',
  );
  const applePayToken = payment?.session_tokens.session_token.find(
    (t): t is ApplePaySessionToken => t.wallet_name === 'apple_pay',
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setPayment(null);
    try {
      const created = await createPayment();
      setPayment(created);

      const gpay = created.session_tokens.session_token.find(t => t.wallet_name === 'google_pay');
      if (gpay && isGooglePaySupported()) {
        setGooglePayReady(
          await isReadyToPay(
            gpay as GooglePaySessionToken,
            googlePayEnvironment(created.publishable_key),
          ),
        );
      }
      const apay = created.session_tokens.session_token.find(t => t.wallet_name === 'apple_pay');
      if (apay && isApplePaySupported()) {
        setApplePayReady(await canMakePayments());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmWith = useCallback(
    async (collect: () => Promise<WalletPaymentMethodData>) => {
      if (!payment) {
        return;
      }
      setBusy(true);
      setError(null);
      setResult(null);
      try {
        const walletData = await collect();
        setResult(await confirmPayment(payment.payment_id, walletData));
      } catch (e) {
        if ((e instanceof GooglePayError || e instanceof ApplePayError) && e.code === 'cancelled') {
          setError('Payment cancelled');
        } else {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        setBusy(false);
      }
    },
    [payment],
  );

  const onGooglePay = () =>
    confirmWith(() =>
      payWithGooglePay(googlePayToken!, googlePayEnvironment(payment!.publishable_key)),
    );
  const onApplePay = () => confirmWith(() => payWithApplePay(applePayToken!));

  const amount = payment ? formatAmount(payment.payment.amount, payment.payment.currency) : '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>S2S Checkout</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Hyperswitch · {Platform.OS === 'ios' ? 'Apple Pay' : 'Google Pay'}
        </Text>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Order</Text>
          <Row label="Item" value="Apple iPhone 15" theme={theme} />
          <Row label="Total" value={amount || '—'} theme={theme} />
          <Row label="Payment ID" value={payment?.payment_id ?? '—'} theme={theme} mono />
          <Row label="Status" value={result?.status ?? payment?.payment.status ?? '—'} theme={theme} />
        </View>

        <View style={styles.walletSection}>
          {loading ? (
            <ActivityIndicator color={theme.text} />
          ) : payment ? (
            <>
              {Platform.OS === 'android' && googlePayToken && (
                <GooglePayButton onPress={onGooglePay} disabled={busy || !googlePayReady} />
              )}
              {Platform.OS === 'ios' && applePayToken && (
                <ApplePayButton onPress={onApplePay} disabled={busy || !applePayReady} />
              )}
              {Platform.OS === 'android' && !googlePayToken && (
                <Hint theme={theme}>
                  No google_pay session token returned. Enable Google Pay on a connector for this
                  profile in the Hyperswitch dashboard (or set MOCK_WALLET_SESSION_TOKENS=true on
                  the server).
                </Hint>
              )}
              {Platform.OS === 'ios' && !applePayToken && (
                <Hint theme={theme}>
                  No apple_pay session token returned. Enable Apple Pay on a connector for this
                  profile in the Hyperswitch dashboard (or set MOCK_WALLET_SESSION_TOKENS=true on
                  the server).
                </Hint>
              )}
              {Platform.OS === 'android' && googlePayToken && !googlePayReady && (
                <Hint theme={theme}>Google Pay is not available on this device.</Hint>
              )}
              {Platform.OS === 'ios' && applePayToken && !applePayReady && (
                <Hint theme={theme}>Apple Pay is not available on this device.</Hint>
              )}
            </>
          ) : null}
          {busy && <ActivityIndicator color={theme.text} style={styles.spinner} />}
        </View>

        {error && (
          <View style={[styles.banner, { backgroundColor: theme.errorBg }]}>
            <Text style={{ color: theme.errorText }}>{error}</Text>
          </View>
        )}

        {result && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Confirm response</Text>
            <Row label="Status" value={result.status} theme={theme} />
            {result.error_code ? (
              <Row label="Error" value={`${result.error_code}: ${result.error_message ?? ''}`} theme={theme} />
            ) : null}
            <Text style={[styles.json, { color: theme.muted }]}>
              {JSON.stringify(result, null, 2)}
            </Text>
          </View>
        )}

        <Pressable
          onPress={load}
          disabled={loading || busy}
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: theme.border, opacity: pressed || loading || busy ? 0.6 : 1 },
          ]}
        >
          <Text style={{ color: theme.text }}>New payment</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  theme,
  mono,
}: {
  label: string;
  value: string;
  theme: Theme;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.muted }]}>{label}</Text>
      <Text
        style={[styles.rowValue, { color: theme.text }, mono && styles.mono]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function Hint({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  return <Text style={[styles.hint, { color: theme.muted }]}>{children}</Text>;
}

function formatAmount(minorUnits: number, currency: string) {
  return `${(minorUnits / 100).toFixed(2)} ${currency}`;
}

type Theme = typeof lightTheme;

const lightTheme = {
  background: '#f4f4f5',
  card: '#ffffff',
  border: '#e4e4e7',
  text: '#18181b',
  muted: '#71717a',
  errorBg: '#fee2e2',
  errorText: '#991b1b',
};

const darkTheme = {
  background: '#09090b',
  card: '#18181b',
  border: '#27272a',
  text: '#fafafa',
  muted: '#a1a1aa',
  errorBg: '#3f1d1d',
  errorText: '#fecaca',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: -8 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, flexShrink: 1, textAlign: 'right' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  walletSection: { gap: 12, minHeight: 48, justifyContent: 'center' },
  spinner: { marginTop: 4 },
  hint: { fontSize: 13, textAlign: 'center' },
  banner: { borderRadius: 8, padding: 12 },
  json: { fontSize: 11, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
});

export default App;
