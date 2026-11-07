import { Linking, NativeModules, Platform } from 'react-native';

/**
 * Demande d’ignorer l’optimisation batterie (Android) pour garder le service vivant.
 */
export async function requestIgnoreBatteryOptimizations() {
  if (Platform.OS !== 'android') return false;

  try {
    // Intent natif si dispo via module custom / linking settings
    const pkg = 'com.merde.backup';
    const intentUrl = `package:${pkg}`;
    // Ouvre les réglages app — l’utilisateur active « aucune restriction »
    await Linking.openSettings();
    return true;
  } catch {
    try {
      await Linking.openURL('package:');
      return true;
    } catch {
      return false;
    }
  }
}

export function hasNativeBackgroundModule() {
  return Boolean(NativeModules.RNBackgroundActions);
}
