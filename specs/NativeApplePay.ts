import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /** Resolves true if this device can make Apple Pay payments. */
  canMakePayments(): Promise<boolean>;

  /**
   * Presents the Apple Pay sheet.
   * `request` is a JSON string containing `payment_request_data` (the Hyperswitch apple_pay session token).
   * Resolves { status: "Success", payment_data, payment_method, transaction_identifier, billing_contact, shipping_contact }
   * or { status: "Failed" | "Cancelled", message? }.
   */
  startPayment(request: string): Promise<Object>;
}

// iOS only; null on Android.
export default TurboModuleRegistry.get<Spec>('NativeApplePay');
