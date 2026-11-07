import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library/legacy';

const CURSOR_KEY = 'merde_media_cursor';
const OFFSET_KEY = 'merde_media_offset';

function guessMime(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'image/jpeg';
}

export async function ensureMediaPermission() {
  const current = await MediaLibrary.getPermissionsAsync();
  if (current.granted || current.accessPrivileges === 'limited') return true;
  const asked = await MediaLibrary.requestPermissionsAsync();
  return asked.granted === true || asked.accessPrivileges === 'limited';
}

async function loadCursor() {
  return (await AsyncStorage.getItem(CURSOR_KEY)) || null;
}

async function loadOffset() {
  const raw = await AsyncStorage.getItem(OFFSET_KEY);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function saveCursor(cursor) {
  if (!cursor) await AsyncStorage.removeItem(CURSOR_KEY);
  else await AsyncStorage.setItem(CURSOR_KEY, cursor);
}

async function saveOffset(offset) {
  await AsyncStorage.setItem(OFFSET_KEY, String(Math.max(0, offset || 0)));
}

export async function clearMediaCursor() {
  await AsyncStorage.multiRemove([CURSOR_KEY, OFFSET_KEY]);
}

/**
 * Récupère un lot d’images depuis la galerie (sans sélection manuelle).
 */
export async function fetchNextImageBatch(limit = 20) {
  const pageSize = Math.max(1, Math.min(Number(limit) || 20, 100));
  let after = await loadCursor();

  let page = await MediaLibrary.getAssetsAsync({
    first: pageSize,
    after: after || undefined,
    mediaType: [MediaLibrary.MediaType.photo],
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
  });

  if ((!page.assets || page.assets.length === 0) && after) {
    await clearMediaCursor();
    after = null;
    page = await MediaLibrary.getAssetsAsync({
      first: pageSize,
      mediaType: [MediaLibrary.MediaType.photo],
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
  }

  const assets = [];
  for (const asset of page.assets || []) {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset, {
        shouldDownloadFromNetwork: true,
      });
      let uri = info.localUri || info.uri || asset.uri;
      if (!uri) continue;
      // Android : FormData préfère souvent file://
      if (uri.startsWith('/') && !uri.startsWith('file:')) {
        uri = `file://${uri}`;
      }
      const name = asset.filename || uri.split('/').pop() || `img-${asset.id}.jpg`;
      assets.push({
        id: asset.id,
        uri,
        name,
        mimeType: guessMime(name),
        type: 'image',
      });
    } catch {
      // ignore asset illisible
    }
  }

  if (page.hasNextPage && page.endCursor) {
    await saveCursor(page.endCursor);
    const offset = await loadOffset();
    await saveOffset(offset + assets.length);
  } else {
    await clearMediaCursor();
  }

  return {
    assets,
    hasNextPage: Boolean(page.hasNextPage),
    totalCount: page.totalCount ?? assets.length,
  };
}
