import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE } from './config';

async function request(path, { method = 'GET', token, body, headers = {} } = {}) {
  const opts = {
    method,
    headers: { ...headers },
  };
  if (token) {
    opts.headers.Authorization = `Bearer ${token}`;
  }
  if (body && !(body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body) {
    opts.body = body;
  }

  const res = await fetch(`${API_BASE}/${path}`, opts);
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Réponse invalide (${res.status}): ${text.slice(0, 120)}`);
  }
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export function login(username, password, deviceUid, deviceLabel) {
  return request('login.php', {
    method: 'POST',
    body: {
      username,
      password,
      device_uid: deviceUid,
      device_label: deviceLabel,
    },
  });
}

export function getSettings(token) {
  return request('settings.php', { method: 'GET', token });
}

export function checkHashes(token, hashes) {
  return request('check_hashes.php', {
    method: 'POST',
    token,
    body: { hashes },
  });
}

/**
 * Upload multipart natif (évite "Unsupported FormDataPart implementation" de fetch RN).
 */
export async function uploadFile(token, { uri, name, type, localHash }) {
  if (!uri) throw new Error('URI fichier manquante');
  if (!localHash) throw new Error('local_hash manquant');

  const result = await FileSystem.uploadAsync(`${API_BASE}/upload.php`, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType: type || 'image/jpeg',
    parameters: {
      local_hash: String(localHash),
      // certains backends lisent aussi le nom via ce champ
      original_name: String(name || 'image.jpg'),
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  let data = {};
  try {
    data = result.body ? JSON.parse(result.body) : {};
  } catch {
    throw new Error(
      `Réponse upload invalide (${result.status}): ${String(result.body || '').slice(0, 120)}`
    );
  }

  if (result.status < 200 || result.status >= 300 || data.ok === false) {
    throw new Error(data.error || `HTTP ${result.status}`);
  }

  return data;
}
