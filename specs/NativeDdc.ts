import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * Loads `url` out of sight — in a 1×1 off-screen WebView — and resolves with
   * the first message the page posts, verbatim, as a string.
   *
   * Resolves `""` and nothing else when the page never answers: on timeout, on
   * a navigation failure, or when there is no activity or window to attach the
   * WebView to. It never rejects, so the caller has one shape to read.
   *
   * `timeoutMs` of zero or less resolves `""` immediately, so a resolved
   * default must be passed rather than a raw null from `ddc_data`.
   */
  openIframeBridge(url: string, timeoutMs: number): Promise<string>;
}

// Implemented on both platforms; `get` keeps a missing module from throwing at
// import time, the way the wallet specs do.
export default TurboModuleRegistry.get<Spec>('NativeDdc');
