import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_KEY = 'merde_token';
export const USER_KEY = 'merde_user';
export const CREDS_KEY = 'merde_creds';
export const BATCH_KEY = 'merde_batch_limit';

export async function loadSession() {
  const [token, userRaw, credsRaw, batchRaw] = await AsyncStorage.multiGet([
    TOKEN_KEY,
    USER_KEY,
    CREDS_KEY,
    BATCH_KEY,
  ]);
  const user = userRaw[1] ? JSON.parse(userRaw[1]) : null;
  const creds = credsRaw[1] ? JSON.parse(credsRaw[1]) : null;
  const batchLimit = batchRaw[1] ? Number(batchRaw[1]) : null;
  return {
    token: token[1] || null,
    user,
    creds,
    batchLimit: batchLimit >= 1 ? batchLimit : null,
  };
}

export async function saveCredentials(username, password) {
  const user = { username };
  await AsyncStorage.multiSet([
    [CREDS_KEY, JSON.stringify({ username, password })],
    [USER_KEY, JSON.stringify(user)],
  ]);
  return user;
}

export async function saveToken(token, user) {
  const pairs = [[TOKEN_KEY, token]];
  if (user) pairs.push([USER_KEY, JSON.stringify(user)]);
  await AsyncStorage.multiSet(pairs);
}

export async function saveBatchLimit(limit) {
  if (limit >= 1) {
    await AsyncStorage.setItem(BATCH_KEY, String(limit));
  }
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, CREDS_KEY, BATCH_KEY]);
}
