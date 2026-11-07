import { AppState, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { loadSession } from './authStore';
import { ensureServerAuthHeadless } from './headlessAuth';
import {
  isBackgroundRunning,
  setBackgroundRunning,
  startBackgroundLoop,
  stopBackgroundLoop,
} from './backgroundWorker';

export const BOOT_FETCH_TASK = 'MERDE_BOOT_FETCH_TASK';
const KEEP_AWAKE_TAG = 'bloody-cross-recovery';
const MODE_KEY = 'merde_bg_mode';

const hasNativeBg = Boolean(NativeModules.RNBackgroundActions);
let BackgroundService = null;
if (hasNativeBg) {
  try {
    BackgroundService = require('react-native-background-actions').default;
  } catch {
    BackgroundService = null;
  }
}

const FetchResult = BackgroundFetch.BackgroundFetchResult || {
  NewData: 1,
  NoData: 2,
  Failed: 3,
};

const stopRef = { current: false };
let jsLoopActive = false;
let appStateSub = null;
let watchdogTimer = null;
let uiCallbacks = {
  onProgress: null,
  onQueueChange: null,
  onStopped: null,
};

export function setPersistentUiCallbacks(cbs = {}) {
  uiCallbacks = { ...uiCallbacks, ...cbs };
}

function buildServiceOptions() {
  return {
    taskName: 'BloodyCrossBackup',
    taskTitle: 'Bloody Cross',
    taskDesc: 'Récupération en arrière-plan…',
    taskIcon: {
      name: 'ic_launcher',
      type: 'mipmap',
    },
    color: '#2f6b4f',
    linkingURI: 'merdebackup://main',
    parameters: {
      startedAt: Date.now(),
    },
    // Android 10+ : type obligatoire pour FGS
    foregroundServiceType: Platform.OS === 'android' ? ['dataSync'] : undefined,
    progressBar: {
      max: 100,
      value: 0,
      indeterminate: true,
    },
  };
}

async function getTokenHeadless() {
  const session = await loadSession();
  return session.token;
}

function nativeIsRunning() {
  try {
    return Boolean(BackgroundService?.isRunning?.());
  } catch {
    return false;
  }
}

async function saveMode(mode) {
  try {
    await AsyncStorage.setItem(MODE_KEY, mode || '');
  } catch {
    // ignore
  }
}

async function enableKeepAwake() {
  try {
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
  } catch {
    // ignore
  }
}

async function disableKeepAwake() {
  try {
    await deactivateKeepAwake(KEEP_AWAKE_TAG);
  } catch {
    // ignore
  }
}

async function updateNativeNotification(progress) {
  if (!BackgroundService || !nativeIsRunning()) return;
  try {
    const label = progress?.current || progress?.status || 'Récupération en cours';
    const done = Number(progress?.done) || 0;
    const total = Number(progress?.total) || 0;
    await BackgroundService.updateNotification({
      taskTitle: 'Bloody Cross',
      taskDesc: total > 0 ? `${label} (${done}/${total})` : String(label),
      progressBar:
        total > 0
          ? { max: total, value: Math.min(done, total), indeterminate: false }
          : { max: 100, value: 0, indeterminate: true },
    });
  } catch {
    // ignore
  }
}

TaskManager.defineTask(BOOT_FETCH_TASK, async () => {
  try {
    const shouldRun = await isBackgroundRunning();
    if (!shouldRun) return FetchResult.NoData;

    // Recharge le service même si le flag JS isRunning est faux après kill
    await startPersistentService({ forceRestart: !nativeIsRunning() && !jsLoopActive });
    return FetchResult.NewData;
  } catch {
    return FetchResult.Failed;
  }
});

export async function registerBootFetch() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus?.Denied ||
      status === BackgroundFetch.BackgroundFetchStatus?.Restricted
    ) {
      console.warn('BackgroundFetch denied/restricted');
    }
    const registered = await TaskManager.isTaskRegisteredAsync(BOOT_FETCH_TASK);
    if (!registered) {
      await BackgroundFetch.registerTaskAsync(BOOT_FETCH_TASK, {
        minimumInterval: 60 * 15,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch (e) {
    console.warn('registerBootFetch', e?.message || e);
  }
}

export async function unregisterBootFetch() {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(BOOT_FETCH_TASK);
    if (registered) await BackgroundFetch.unregisterTaskAsync(BOOT_FETCH_TASK);
  } catch {
    // ignore
  }
}

function clearWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

function startWatchdog() {
  clearWatchdog();
  // Toutes les 60s : si le flag dit "doit tourner" mais rien ne tourne → relance
  watchdogTimer = setInterval(async () => {
    try {
      const shouldRun = await isBackgroundRunning();
      if (!shouldRun) return;
      if (!nativeIsRunning() && !jsLoopActive) {
        await startPersistentService({ forceRestart: true });
      }
    } catch {
      // ignore
    }
  }, 60000);
}

function ensureAppStateWatch() {
  if (appStateSub) return;
  appStateSub = AppState.addEventListener('change', async (state) => {
    if (state !== 'active') return;
    try {
      const shouldRun = await isBackgroundRunning();
      if (!shouldRun) return;
      if (!nativeIsRunning() && !jsLoopActive) {
        await startPersistentService({ forceRestart: true });
      }
    } catch {
      // ignore
    }
  });
}

async function runUploadLoop() {
  await enableKeepAwake();
  await startBackgroundLoop({
    stopRef,
    getToken: getTokenHeadless,
    ensureAuth: ensureServerAuthHeadless,
    onProgress: (p) => {
      uiCallbacks.onProgress?.(p);
      updateNativeNotification(p);
    },
    onQueueChange: (q) => uiCallbacks.onQueueChange?.(q),
    onStopped: async () => {
      jsLoopActive = false;
      await disableKeepAwake();
      try {
        if (nativeIsRunning()) await BackgroundService.stop();
      } catch {
        // ignore
      }
      uiCallbacks.onStopped?.();
    },
  });
}

/**
 * @param {{ forceRestart?: boolean }} [opts]
 * @returns {Promise<{ mode: 'native' | 'js' }>}
 */
export async function startPersistentService(opts = {}) {
  const forceRestart = Boolean(opts.forceRestart);
  stopRef.current = false;
  await setBackgroundRunning(true);
  await registerBootFetch();
  ensureAppStateWatch();
  startWatchdog();
  await enableKeepAwake();

  if (!forceRestart && (nativeIsRunning() || jsLoopActive)) {
    return { mode: nativeIsRunning() ? 'native' : 'js' };
  }

  // Relancer proprement si demandé
  if (forceRestart) {
    try {
      if (nativeIsRunning()) await BackgroundService.stop();
    } catch {
      // ignore
    }
    jsLoopActive = false;
    stopRef.current = false;
  }

  if (BackgroundService) {
    try {
      // Petit délai pour laisser Android libérer l’ancien service
      if (forceRestart) await new Promise((r) => setTimeout(r, 400));
      await BackgroundService.start(runUploadLoop, buildServiceOptions());
      await saveMode('native');
      return { mode: 'native' };
    } catch (e) {
      console.warn('BackgroundService.start failed', e?.message || e);
    }
  }

  // Fallback JS : marche SEULEMENT app ouverte / process vivant
  jsLoopActive = true;
  await saveMode('js');
  runUploadLoop().catch((e) => {
    jsLoopActive = false;
    disableKeepAwake();
    console.warn('JS upload loop failed', e?.message || e);
    uiCallbacks.onStopped?.();
  });
  return { mode: 'js' };
}

export async function stopPersistentService() {
  stopRef.current = true;
  jsLoopActive = false;
  clearWatchdog();
  await stopBackgroundLoop(stopRef);
  await setBackgroundRunning(false);
  await saveMode('');
  await disableKeepAwake();
  try {
    if (BackgroundService && BackgroundService.isRunning()) {
      await BackgroundService.stop();
    }
  } catch {
    // ignore
  }
  uiCallbacks.onStopped?.();
}

export function isPersistentServiceRunning() {
  return nativeIsRunning() || jsLoopActive;
}

export function hasNativeBackgroundService() {
  return Boolean(BackgroundService);
}

export function getBackgroundModeLabel() {
  if (nativeIsRunning()) return 'arrière-plan natif (notification)';
  if (jsLoopActive) {
    return BackgroundService
      ? 'mode JS temporaire'
      : 'Expo Go — APK EAS requis pour app fermée';
  }
  if (BackgroundService) return 'natif prêt';
  return 'Expo Go — build APK pour vrai arrière-plan';
}
