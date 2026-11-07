import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  Alert,
  Platform,
  StyleSheet,
  PermissionsAndroid,
  AppState,
  Linking,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { StatusBar } from 'expo-status-bar';
import { getSettings, login } from './src/api';
import {
  clearSession,
  loadSession,
  saveBatchLimit,
  saveCredentials,
  saveToken,
} from './src/authStore';
import {
  isBackgroundRunning,
  savePendingQueue,
  setBackgroundRunning,
} from './src/backgroundWorker';
import { clearMediaCursor, ensureMediaPermission } from './src/mediaScan';
import { isNetworkGood } from './src/network';
import {
  getBackgroundModeLabel,
  hasNativeBackgroundService,
  isPersistentServiceRunning,
  registerBootFetch,
  setPersistentUiCallbacks,
  startPersistentService,
  stopPersistentService,
  unregisterBootFetch,
} from './src/persistentService';

function deviceUid() {
  return `dev-${Platform.OS}-${Platform.Version}`;
}

async function ensureAndroidRuntimePermissions() {
  if (Platform.OS !== 'android') return true;

  const asks = [];
  if (Platform.Version >= 33) {
    asks.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
    asks.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } else {
    asks.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
  }

  try {
    await PermissionsAndroid.requestMultiple(asks.filter(Boolean));
  } catch {
    // ignore
  }
  return true;
}

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [batchLimit, setBatchLimit] = useState(20);
  const [apkEnabled, setApkEnabled] = useState(true);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [permOk, setPermOk] = useState(false);
  const [lastBatchCount, setLastBatchCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState('En attente d’un ordre depuis le site…');
  const credsRef = useRef(null);
  const tokenRef = useRef(null);
  const startingRef = useRef(false);
  const busyRef = useRef(false);
  const lastEnabledRef = useRef(null); // null = pas encore lu le site

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    setPersistentUiCallbacks({
      onProgress: setProgress,
      onQueueChange: (q) => setLastBatchCount(Array.isArray(q) ? q.length : 0),
      onStopped: () => {
        busyRef.current = false;
        startingRef.current = false;
        setBusy(false);
        setStatusMsg('Arrêté — en attente du site');
        setProgress((p) =>
          p?.status?.startsWith('stopped')
            ? p
            : {
                status: 'stopped_remote',
                done: 0,
                total: 0,
                current: 'Arrêté (site / service)',
              }
        );
      },
    });
  }, []);

  async function applyBatchLimit(limit) {
    if (limit >= 1) {
      setBatchLimit(limit);
      await saveBatchLimit(limit);
      return limit;
    }
    return null;
  }

  async function refreshSettings(authToken) {
    try {
      const res = await getSettings(authToken);
      const enabled = res.settings?.apk_enabled !== false;
      setApkEnabled(enabled);
      await applyBatchLimit(Number(res.settings?.upload_batch_limit));
      return res.settings;
    } catch {
      return null;
    }
  }

  async function requestAllPermissions() {
    await ensureAndroidRuntimePermissions();
    const mediaOk = await ensureMediaPermission();
    setPermOk(mediaOk);
    return mediaOk;
  }

  async function ensureServerAuth() {
    const creds = credsRef.current;
    if (!creds?.username || !creds?.password) {
      throw new Error('Identifiants manquants. Reconnectez-vous.');
    }
    if (!(await isNetworkGood())) {
      throw new Error('Pas d’Internet / mauvaise connexion.');
    }
    const res = await login(
      creds.username,
      creds.password,
      deviceUid(),
      Platform.OS
    );
    await saveToken(res.token, res.user);
    setToken(res.token);
    tokenRef.current = res.token;
    setUser(res.user);
    await refreshSettings(res.token);
    return res.token;
  }

  async function beginPersistent() {
    if (startingRef.current || isPersistentServiceRunning()) {
      busyRef.current = true;
      setBusy(true);
      return;
    }
    startingRef.current = true;
    busyRef.current = true;
    setBusy(true);
    setStatusMsg('Récupération en cours…');
    try {
      await ensureAndroidRuntimePermissions();
      const result = await startPersistentService({ forceRestart: false });
      startingRef.current = false;
      if (result?.mode === 'native') {
        setStatusMsg('Récupération active — continue même app fermée (notification)');
      } else {
        setStatusMsg(
          'Récupération active en mode limité. Installe l’APK EAS pour continuer app fermée.'
        );
        if (!hasNativeBackgroundService()) {
          Alert.alert(
            'Arrière-plan limité',
            'Expo Go ne peut pas récupérer les fichiers app fermée.\n\nCompile un APK :\ncd apk && npx eas build -p android --profile preview\n\nPuis installe-le et autorise « Sans restriction » dans Batterie.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (e) {
      startingRef.current = false;
      busyRef.current = false;
      setBusy(false);
      setStatusMsg(e.message || 'Impossible de démarrer');
      throw e;
    }
  }

  async function stopFromRemote() {
    startingRef.current = false;
    busyRef.current = false;
    await stopPersistentService();
    setBusy(false);
    setStatusMsg('Arrêté depuis le site');
  }

  /** Écoute le dashboard : apk_enabled=true → lance la boucle */
  async function syncRemoteCommand() {
    if (!ready || !credsRef.current) return;

    try {
      if (!(await isNetworkGood())) {
        setStatusMsg('Hors ligne — en attente réseau');
        return;
      }

      let authToken = tokenRef.current;
      try {
        if (!authToken) authToken = await ensureServerAuth();
        else await refreshSettings(authToken);
      } catch {
        try {
          authToken = await ensureServerAuth();
        } catch (e) {
          setStatusMsg(e.message || 'Auth impossible');
          return;
        }
      }

      const settings = await refreshSettings(authToken);
      if (!settings) return;

      const enabled = settings.apk_enabled !== false;
      const running = busyRef.current || isPersistentServiceRunning();
      lastEnabledRef.current = enabled;

      if (!enabled) {
        if (running) await stopFromRemote();
        else setStatusMsg('En attente — lancez la récupération depuis le site');
        return;
      }

      if (!permOk) {
        const ok = await requestAllPermissions();
        if (!ok) {
          setStatusMsg('Permission fichiers refusée');
          return;
        }
      }

      // apk_enabled=true → démarrer (le poll 5s ratait souvent le kick off→on)
      if (!running) {
        setStatusMsg('Ordre site actif — démarrage…');
        await beginPersistent();
        return;
      }

      setStatusMsg('Récupération active (ordre site)');
    } catch (e) {
      setStatusMsg(e.message || 'Sync site échouée');
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await registerBootFetch();
        const session = await loadSession();
        if (session.creds?.username) {
          credsRef.current = session.creds;
          setUsername(session.creds.username);
          setUser(session.user || { username: session.creds.username });
          setReady(true);
        }
        if (session.token) {
          setToken(session.token);
          tokenRef.current = session.token;
        }
        if (session.batchLimit) setBatchLimit(session.batchLimit);

        if (session.creds?.username) {
          const ok = await requestAllPermissions();
          if (!ok) {
            setStatusMsg('Autorisez l’accès aux fichiers');
          }
        }

        if (session.token) {
          await refreshSettings(session.token);
        }

        // Si une récupération était en cours (app tuée / reboot) → relancer le service
        if (isPersistentServiceRunning()) {
          busyRef.current = true;
          setBusy(true);
        } else if (await isBackgroundRunning()) {
          try {
            await beginPersistent();
          } catch {
            // syncRemoteCommand reprendra si apk_enabled
          }
        }
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll le site toutes les 5s une fois connecté
  useEffect(() => {
    if (!ready || booting) return undefined;
    syncRemoteCommand();
    const id = setInterval(syncRemoteCommand, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, booting, permOk]);

  // Reprendre automatiquement au retour au premier plan
  useEffect(() => {
    if (!ready || booting) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncRemoteCommand();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, booting, permOk]);

  async function onLogin() {
    const u = username.trim();
    const p = password;
    if (!u || !p) {
      Alert.alert('Connexion', 'Nom et mot de passe requis.');
      return;
    }

    try {
      setBusy(true);
      const savedUser = await saveCredentials(u, p);
      credsRef.current = { username: u, password: p };
      setUser(savedUser);
      setPassword('');

      const ok = await requestAllPermissions();
      if (!ok) {
        Alert.alert(
          'Permission',
          'Autorisez l’accès aux photos / fichiers pour que la récupération fonctionne.'
        );
      }

      const net = await NetInfo.fetch();
      if (net.isConnected) {
        try {
          const res = await login(u, p, deviceUid(), Platform.OS);
          await saveToken(res.token, res.user);
          setToken(res.token);
          tokenRef.current = res.token;
          setUser(res.user);
          await refreshSettings(res.token);
        } catch {
          // Identifiants gardés ; auth serveur plus tard
        }
      }

      setReady(true);
      setStatusMsg(
        ok
          ? 'Connecté — en attente d’un ordre depuis Fichiers reçus'
          : 'Connecté — permission fichiers manquante'
      );
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await stopPersistentService();
    await unregisterBootFetch();
    await clearSession();
    await savePendingQueue([]);
    await clearMediaCursor();
    credsRef.current = null;
    startingRef.current = false;
    setToken(null);
    tokenRef.current = null;
    setUser(null);
    setReady(false);
    setUsername('');
    setPassword('');
    setLastBatchCount(0);
    setProgress(null);
    busyRef.current = false;
    setBusy(false);
    setPermOk(false);
    lastEnabledRef.current = null;
    setStatusMsg('Déconnecté');
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <Text style={styles.title}>Bloody Cross</Text>
          <Text style={styles.meta}>Chargement…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <Text style={styles.title}>Bloody Cross</Text>
          <Text style={styles.meta}>Connexion — les accès fichiers seront demandés</Text>
          <TextInput
            placeholder="Nom d'utilisateur"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            placeholder="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />
          <View style={styles.btnWrap}>
            <Button title={busy ? '...' : 'Entrer'} onPress={onLogin} disabled={busy} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const serviceOn = busy || isPersistentServiceRunning();

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.center}>
        <Text style={styles.title}>Bloody Cross</Text>
        <Text style={styles.meta}>Compte : {user?.username}</Text>
        <Text style={styles.meta}>
          Fichiers : {permOk ? 'autorisé' : 'refusé'} · Lot : {batchLimit}
        </Text>
        <Text style={styles.meta}>
          Site : {apkEnabled ? 'récupération ON' : 'récupération OFF'}
        </Text>
        <Text style={styles.meta}>Service : {serviceOn ? 'actif' : 'en veille'}</Text>
        <Text style={styles.meta}>Mode : {getBackgroundModeLabel()}</Text>
        <Text style={styles.progress}>{statusMsg}</Text>
        {lastBatchCount > 0 ? (
          <Text style={styles.meta}>Lot en cours : {lastBatchCount} image(s)</Text>
        ) : null}
        {progress ? (
          <Text style={styles.progress}>
            {progress.status}
            {progress.total ? ` — ${progress.done}/${progress.total}` : ''}
            {progress.attempts ? ` (essai ${progress.attempts}/3)` : ''}
            {progress.current ? `\n${progress.current}` : ''}
            {progress.error ? `\nErreur: ${progress.error}` : ''}
          </Text>
        ) : null}

        <View style={styles.btnWrap}>
          <Button
            title="Autoriser arrière-plan (batterie)"
            onPress={() => {
              Alert.alert(
                'Batterie',
                'Dans Réglages → Batterie, choisissez « Sans restriction » / autorisez l’activité en arrière-plan pour Bloody Cross.',
                [
                  { text: 'Plus tard', style: 'cancel' },
                  { text: 'Ouvrir réglages', onPress: () => Linking.openSettings() },
                ]
              );
            }}
          />
        </View>
        <View style={styles.btnWrap}>
          <Button title="Déconnexion" onPress={onLogout} color="#8a3b2b" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f6f2',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#14201a',
    marginBottom: 12,
    textAlign: 'center',
  },
  meta: {
    fontSize: 15,
    color: '#4a5b50',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 22,
  },
  progress: {
    fontSize: 14,
    color: '#1d4633',
    textAlign: 'center',
    marginVertical: 10,
    lineHeight: 20,
  },
  input: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#b7c7ba',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    backgroundColor: '#fff',
  },
  btnWrap: {
    width: '100%',
    maxWidth: 280,
    marginTop: 14,
  },
});
