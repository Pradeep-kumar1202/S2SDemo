import { Platform } from 'react-native';

/**
 * Base URL of server/index.js.
 * - Android emulator reaches the host machine via 10.0.2.2
 * - iOS simulator can use localhost
 * - Physical devices: replace with your machine's LAN IP.
 */
export const SERVER_URL = Platform.select({
  android: 'http://10.0.2.2:5252',
  default: 'http://localhost:5252',
});
