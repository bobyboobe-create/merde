import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { checkHashes, uploadFile } from './api';
import { isNetworkGood } from './network';

function guessMime(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'image/jpeg';
}

function isImage(asset) {
  const mime = String(asset.mimeType || asset.type || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  if (mime === 'image') return true;
  const name = String(asset.name || asset.fileName || asset.uri || '').toLowerCase();
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(name) || Boolean(asset.uri);
}

function safeFileName(name, fallbackExt = 'jpg') {
  const raw = String(name || `img-${Date.now()}.${fallbackExt}`);
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (/\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(cleaned)) return cleaned;
  return `${cleaned}.${fallbackExt}`;
}

/**
 * Expo Go / MediaLibrary donnent souvent content:// illisible pour FormData.
 * On copie vers le cache app (file://) avant hash + upload.
 */
async function materializeLocalFile(asset) {
  const sourceUri = asset.uri;
  if (!sourceUri) throw new Error('URI image manquante');

  const name = safeFileName(asset.name || asset.fileName || sourceUri.split('/').pop());
  const type =
    asset.mimeType && String(asset.mimeType).startsWith('image/')
      ? asset.mimeType
      : guessMime(name);

  let localUri = sourceUri;
  const needsCopy =
    !sourceUri.startsWith('file://') ||
    sourceUri.includes('content://') ||
    sourceUri.startsWith('ph://') ||
    sourceUri.startsWith('assets-library://');

  if (needsCopy || !sourceUri.startsWith('file://')) {
    const dest = `${FileSystem.cacheDirectory}bc-${Date.now()}-${name}`;
    try {
      await FileSystem.copyAsync({ from: sourceUri, to: dest });
      localUri = dest;
    } catch (e) {
      // parfois localUri file:// direct marche sans copy
      if (sourceUri.startsWith('file://')) {
        localUri = sourceUri;
      } else {
        throw new Error(`Copie galerie impossible: ${e.message || e}`);
      }
    }
  }

  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists) {
    throw new Error('Fichier local introuvable après copie');
  }
  if (!info.size || info.size < 1) {
    throw new Error('Fichier vide (accès galerie limité — build natif recommandé)');
  }

  const localHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${localUri}|${info.size}|${info.modificationTime || 0}|${name}`
  );

  return {
    uri: localUri,
    name,
    type,
    localHash,
    asset,
    size: info.size,
  };
}

async function resolveStopReason(stopRef, checkRemoteStop) {
  if (stopRef.current) return 'stopped_remote';
  if (!(await isNetworkGood())) return 'stopped_offline';
  if (checkRemoteStop && (await checkRemoteStop())) return 'stopped_remote';
  return null;
}

/**
 * Upload images (copie locale → hash → API).
 */
export async function runUploadQueue({
  token,
  assets,
  stopRef,
  onProgress,
  maxFiles = 0,
  checkRemoteStop,
}) {
  if (!(await isNetworkGood())) {
    onProgress({ status: 'stopped_offline', done: 0, total: 0, current: null });
    return { status: 'stopped_offline', remaining: assets };
  }

  const remote = checkRemoteStop ? await checkRemoteStop() : false;
  if (stopRef.current || remote) {
    onProgress({ status: 'stopped_remote', done: 0, total: 0, current: null });
    return { status: 'stopped_remote', remaining: assets };
  }

  const imagesOnly = assets.filter(isImage);
  const capped = maxFiles > 0 ? imagesOnly.slice(0, maxFiles) : imagesOnly;

  const prepared = [];
  for (const asset of capped) {
    const reason = await resolveStopReason(stopRef, checkRemoteStop);
    if (reason) {
      onProgress({ status: reason, done: 0, total: prepared.length, current: null });
      return { status: reason, remaining: capped };
    }
    try {
      onProgress({
        status: 'preparing',
        done: prepared.length,
        total: capped.length,
        current: asset.name || 'image',
      });
      const item = await materializeLocalFile(asset);
      prepared.push(item);
    } catch (e) {
      onProgress({
        status: 'retry',
        done: prepared.length,
        total: capped.length,
        current: asset.name || 'image',
        error: e.message,
        attempts: 1,
      });
      // on continue les autres images
    }
  }

  if (!prepared.length) {
    onProgress({
      status: 'error',
      done: 0,
      total: capped.length,
      current: 'Impossible de lire les images (permission / Expo Go)',
      error: 'materialize_failed',
    });
    return { status: 'done', remaining: capped };
  }

  const hashes = prepared.map((p) => p.localHash);
  let existing = [];
  try {
    if (!(await isNetworkGood())) {
      onProgress({ status: 'stopped_offline', done: 0, total: prepared.length, current: null });
      return { status: 'stopped_offline', remaining: capped };
    }
    const res = await checkHashes(token, hashes);
    existing = res.existing || [];
  } catch {
    if (!(await isNetworkGood())) {
      onProgress({ status: 'stopped_offline', done: 0, total: prepared.length, current: null });
      return { status: 'stopped_offline', remaining: capped };
    }
    existing = [];
  }

  const existingSet = new Set(existing);
  const todo = prepared.filter((p) => !existingSet.has(p.localHash));
  const skipped = prepared.length - todo.length;

  let done = skipped;
  const total = prepared.length;
  onProgress({ status: 'running', done, total, current: null, skipped });

  const remaining = [];

  for (let i = 0; i < todo.length; i += 1) {
    const item = todo[i];
    const reason = await resolveStopReason(stopRef, checkRemoteStop);
    if (reason) {
      const left = todo.slice(i).map((t) => t.asset || t);
      onProgress({ status: reason, done, total, current: null });
      return { status: reason, remaining: left };
    }

    onProgress({ status: 'running', done, total, current: item.name });
    let attempts = 0;
    let uploaded = false;
    let lastError = '';

    while (attempts < 3 && !uploaded) {
      const midReason = await resolveStopReason(stopRef, checkRemoteStop);
      if (midReason) {
        const left = todo.slice(i).map((t) => t.asset || t);
        onProgress({ status: midReason, done, total, current: null, error: lastError });
        return { status: midReason, remaining: left };
      }
      try {
        await uploadFile(token, item);
        done += 1;
        uploaded = true;
        onProgress({ status: 'running', done, total, current: item.name });
      } catch (e) {
        attempts += 1;
        lastError = e.message || String(e);
        if (!(await isNetworkGood())) {
          const left = todo.slice(i).map((t) => t.asset || t);
          onProgress({
            status: 'stopped_offline',
            done,
            total,
            current: item.name,
            error: lastError,
          });
          return { status: 'stopped_offline', remaining: left };
        }
        onProgress({
          status: 'retry',
          done,
          total,
          current: item.name,
          error: lastError,
          attempts,
        });
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    if (!uploaded) {
      remaining.push(item.asset || item);
      onProgress({
        status: 'error',
        done,
        total,
        current: item.name,
        error: lastError || 'Upload échoué après 3 essais',
      });
    }
  }

  onProgress({ status: 'done', done, total, current: null });
  return { status: 'done', remaining };
}
