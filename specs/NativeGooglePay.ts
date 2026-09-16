import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * Resolves true if Google Pay is available on this device.
   * `isReadyToPayRequest` is a JSON string in Google's IsReadyToPayRequest format.
   * `environment` is "TEST" or "PRODUCTION".
   */
  isReadyToPay(isReadyToPayRequest: string, environment: string): Promise<boolean>;

  /**
   * Presents the Google Pay sheet.
   * `request` is a JSON string: { paymentDataRequest: <PaymentDataRequest>, environment: "TEST" | "PRODUCTION" }.
   * Resolves { paymentMethodData: "<PaymentData JSON>" } on success or { error: "Cancel" | "Failure" | string }.
   */
  requestPayment(request: string): Promise<Object>;
}

// Android only; null on iOS.
export default TurboModuleRegistry.get<Spec>('NativeGooglePay');
