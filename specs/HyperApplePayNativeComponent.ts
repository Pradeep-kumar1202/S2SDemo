import type { CodegenTypes, ViewProps } from 'react-native';
import { codegenNativeComponent } from 'react-native';

export interface NativeProps extends ViewProps {
  /** PKPaymentButtonType (0 = plain, 1 = buy, 5 = checkout, ...). */
  type?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;
  /** PKPaymentButtonStyle (0 = white, 1 = whiteOutline, 2 = black, 3 = automatic). */
  buttonStyle?: CodegenTypes.WithDefault<CodegenTypes.Int32, 2>;
  /** Corner radius in points. */
  buttonBorderRadius?: CodegenTypes.WithDefault<CodegenTypes.Int32, 4>;
  disabled?: CodegenTypes.WithDefault<boolean, false>;
}

export default codegenNativeComponent<NativeProps>('HyperApplePayButton', {
  excludedPlatforms: ['android'],
});
