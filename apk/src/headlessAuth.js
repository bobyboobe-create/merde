import { Platform } from 'react-native';
import { getSettings, login } from './api';
import { loadSession, saveBatchLimit, saveToken } from './authStore';
import { isNetworkGood } from './network';

function deviceUid() {
  return `dev-${Platform.OS}-${Platform.Version}`;
}

/** Auth utilisable en mode headless (app fermée / après boot). */
export async function ensureServerAuthHeadless() {
  const session = await loadSession();
  const creds = session.creds;
  if (!creds?.username || !creds?.password) {
    throw new Error('Identifiants manquants');
  }
  if (!(await isNetworkGood())) {
    throw new Error('Pas d’Internet / mauvaise connexion');
  }
  const res = await login(creds.username, creds.password, deviceUid(), Platform.OS);
  await saveToken(res.token, res.user);
  return res.token;
}

export async function fetchRemoteSettings(token) {
  const res = await getSettings(token);
  const limit = Number(res.settings?.upload_batch_limit);
  if (limit >= 1) await saveBatchLimit(limit);
  return {
    upload_batch_limit: limit >= 1 ? limit : 20,
    apk_enabled: res.settings?.apk_enabled !== false,
  };
}
