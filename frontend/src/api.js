const API_BASE = import.meta.env.VITE_API_BASE || 'https://boby33.alwaysdata.net/api';

function token() {
  return localStorage.getItem('merde_token');
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (auth) {
    const t = token();
    if (!t) throw new Error('Non authentifié');
    headers.Authorization = `Bearer ${t}`;
  }
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  register: (username, password, password_confirm) =>
    request('register.php', {
      method: 'POST',
      body: { username, password, password_confirm },
    }),
  login: (username, password) =>
    request('login.php', { method: 'POST', body: { username, password } }),
  me: () => request('me.php', { auth: true }),
  files: () => request('files.php', { auth: true }),
  deleteFile: async (id) => {
    try {
      return await request('files.php', {
        method: 'DELETE',
        auth: true,
        body: { id },
      });
    } catch (err) {
      // Fallback si DELETE bloqué par l’hébergeur
      return request('files.php', {
        method: 'POST',
        auth: true,
        body: { action: 'delete', id },
      });
    }
  },
  devices: () => request('devices.php', { auth: true }),
  notes: () => request('notes.php', { auth: true }),
  createNote: (title, body) =>
    request('notes.php', { method: 'POST', auth: true, body: { title, body } }),
  deleteNote: (id) =>
    request('notes.php', { method: 'DELETE', auth: true, body: { id } }),
  settings: () => request('settings.php', { auth: true }),
  updateSettings: (payload) =>
    request('settings.php', {
      method: 'POST',
      auth: true,
      body: typeof payload === 'number' ? { upload_batch_limit: payload } : payload,
    }),
};
