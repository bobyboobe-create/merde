import NetInfo from '@react-native-community/netinfo';

/**
 * Connexion utilisable pour l’upload.
 * S’arrête si pas de réseau, Internet injoignable, ou lien trop faible.
 */
export async function isNetworkGood() {
  const net = await NetInfo.fetch();
  if (!net.isConnected) return false;
  if (net.isInternetReachable === false) return false;

  const details = net.details || {};
  // Cellular: signal trop faible
  if (typeof details.strength === 'number' && details.strength >= 0 && details.strength < 2) {
    return false;
  }
  // Wi‑Fi: lien trop lent / faible
  if (typeof details.linkSpeed === 'number' && details.linkSpeed > 0 && details.linkSpeed < 1) {
    return false;
  }

  return true;
}
