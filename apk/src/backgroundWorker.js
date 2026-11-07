import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureServerAuthHeadless, fetchRemoteSettings } from './headlessAuth';
import { ensureMediaPermission, fetchNextImageBatch } from './mediaScan';
import { isNetworkGood } from './network';
import { runUploadQueue } from './uploadQueue';

export const QUEUE_KEY = 'merde_pending_queue';
export const RUN_KEY = 'merde_bg_running';

let loopPromise = null;
const defaultStopRef = { current: false };

export async function savePendingQueue(assets) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(assets || []));
}

export async function loadPendingQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function setBackgroundRunning(on) {
  await AsyncStorage.setItem(RUN_KEY, on ? '1' : '0');
}

export async function isBackgroundRunning() {
  return (await AsyncStorage.getItem(RUN_KEY)) === '1';
}

async function checkRemoteStop(stopRef, getToken) {
  if (stopRef.current) return true;
  try {
    const token = await getToken();
    if (!token) return false;
    const settings = await fetchRemoteSettings(token);
    return settings.apk_enabled === false;
  } catch {
    return stopRef.current;
  }
}

/**
 * Un cycle d’upload (utilisé aussi en headless après boot).
 */
export async function runWorkerCycle({
  stopRef = defaultStopRef,
  getToken,
  ensureAuth = ensureServerAuthHeadless,
  onProgress,
  onQueueChange,
}) {
  if (!(await isNetworkGood())) {
    onProgress?.({
      status: 'stopped_offline',
      done: 0,
      total: 0,
      current: 'Pas d’Internet / mauvaise connexion — arrêté',
    });
    return { status: 'stopped_offline' };
  }

  if (await checkRemoteStop(stopRef, getToken)) {
    stopRef.current = true;
    onProgress?.({ status: 'stopped_remote', done: 0, total: 0, current: null });
    return { status: 'stopped_remote' };
  }

  let token;
  try {
    token = await ensureAuth();
  } catch (e) {
    onProgress?.({
      status: 'stopped_offline',
      done: 0,
      total: 0,
      current: e.message,
    });
    return { status: 'stopped_offline' };
  }

  let maxFiles = 20;
  try {
    const settings = await fetchRemoteSettings(token);
    if (settings.apk_enabled === false) {
      stopRef.current = true;
      onProgress?.({ status: 'stopped_remote', done: 0, total: 0, current: null });
      return { status: 'stopped_remote' };
    }
    maxFiles = settings.upload_batch_limit;
  } catch {
    // garde défaut
  }

  if (!(await ensureMediaPermission())) {
    onProgress?.({
      status: 'idle',
      done: 0,
      total: 0,
      current: 'Permission galerie refusée',
    });
    return { status: 'idle' };
  }

  onProgress?.({
    status: 'scanning',
    done: 0,
    total: 0,
    current: 'Lecture de la galerie…',
  });

  const batch = await fetchNextImageBatch(maxFiles);
  const assets = batch.assets || [];
  onQueueChange?.(assets);

  if (!assets.length) {
    onProgress?.({
      status: 'idle',
      done: 0,
      total: batch.totalCount || 0,
      current: `Galerie vide ou inaccessible (total=${batch.totalCount ?? 0})`,
    });
    return { status: 'idle' };
  }

  try {
    const result = await runUploadQueue({
      token,
      assets,
      stopRef,
      onProgress,
      maxFiles,
      checkRemoteStop: () => checkRemoteStop(stopRef, async () => token),
    });

    if (result.status === 'done') {
      await savePendingQueue([]);
      onQueueChange?.([]);
    } else if (result.remaining) {
      await savePendingQueue(result.remaining);
      onQueueChange?.(result.remaining);
    }

    return result;
  } catch (e) {
    onProgress?.({
      status: 'error',
      done: 0,
      total: assets.length,
      current: e.message || 'Erreur upload',
      error: e.message,
    });
    return { status: 'idle' };
  }
}

/**
 * Boucle continue (dans le foreground service Android).
 */
export function startBackgroundLoop({
  stopRef,
  getToken,
  ensureAuth,
  onProgress,
  onStopped,
  onQueueChange,
}) {
  if (loopPromise) return loopPromise;

  stopRef.current = false;

  loopPromise = (async () => {
    await setBackgroundRunning(true);

    // eslint-disable-next-line no-constant-condition
    while (!stopRef.current) {
      const result = await runWorkerCycle({
        stopRef,
        getToken,
        ensureAuth,
        onProgress,
        onQueueChange,
      });

      if (result.status === 'stopped_remote' || stopRef.current) {
        stopRef.current = true;
        await setBackgroundRunning(false);
        break;
      }

      if (result.status === 'stopped_offline') {
        // Attendre le retour réseau sans quitter le service
        let offline = true;
        while (offline && !stopRef.current) {
          if (await checkRemoteStop(stopRef, getToken)) {
            stopRef.current = true;
            onProgress?.({ status: 'stopped_remote', done: 0, total: 0, current: null });
            break;
          }
          await new Promise((r) => setTimeout(r, 4000));
          offline = !(await isNetworkGood());
        }
        if (stopRef.current) break;
        continue;
      }

      // idle / done → veille courte puis re-check (site + galerie)
      await new Promise((r) => setTimeout(r, 3000));
    }

    await setBackgroundRunning(false);
    onStopped?.();
    loopPromise = null;
  })();

  return loopPromise;
}

export async function stopBackgroundLoop(stopRef) {
  if (stopRef) stopRef.current = true;
  await setBackgroundRunning(false);
  if (loopPromise) {
    try {
      await loopPromise;
    } catch {
      // ignore
    }
  }
  loopPromise = null;
}
