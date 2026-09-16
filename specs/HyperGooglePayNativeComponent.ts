import type { CodegenTypes, ViewProps } from 'react-native';
import { codegenNativeComponent } from 'react-native';

export interface NativeProps extends ViewProps {
  /** ButtonConstants.ButtonType; -1 falls back to PAY. */
  type?: CodegenTypes.WithDefault<CodegenTypes.Int32, -1>;
  /** ButtonConstants.ButtonTheme: 1 = DARK, 2 = LIGHT. */
  appearance: CodegenTypes.Int32;
  /** Corner radius in dp. */
  borderRadius?: CodegenTypes.Int32;
}

export default codegenNativeComponent<NativeProps>('HyperGooglePayButton', {
  excludedPlatforms: ['iOS'],
});
