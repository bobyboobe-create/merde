import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { downloadApkOrWarn } from '../apkDownload';
import { getLang, setLang, t } from '../i18n';

const SECTIONS = ['files', 'settings', 'config', 'apk', 'howto'];

function sortNewestFirst(list) {
  return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/** Force le téléchargement Cloudinary (évite d’ouvrir l’image dans un onglet). */
function cloudinaryAttachmentUrl(url, filename) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('res.cloudinary.com')) return null;
    // .../upload/v123/... → .../upload/fl_attachment:name/v123/...
    const safe = String(filename || 'file')
      .replace(/[^\w.\-()+]/g, '_')
      .replace(/\.+$/g, '');
    if (u.pathname.includes('/upload/')) {
      u.pathname = u.pathname.replace(
        '/upload/',
        `/upload/fl_attachment:${encodeURIComponent(safe)}/`
      );
      return u.toString();
    }
  } catch {
    // ignore
  }
  return null;
}

function triggerBlobDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename || 'file';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

async function downloadUrl(url, filename) {
  const name = filename || 'fichier';

  // 1) Fetch → blob (même origine / CORS Cloudinary)
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        triggerBlobDownload(blob, name);
        return;
      }
    }
  } catch {
    // CORS ou réseau → fallback
  }

  // 2) Transformation Cloudinary fl_attachment
  const attached = cloudinaryAttachmentUrl(url, name);
  if (attached) {
    try {
      const res = await fetch(attached, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          triggerBlobDownload(blob, name);
          return;
        }
      }
    } catch {
      // dernier recours : lien attachment
    }
    const a = document.createElement('a');
    a.href = attached;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  throw new Error('Téléchargement impossible');
}

export default function Dashboard() {
  const nav = useNavigate();
  const [section, setSection] = useState('files');
  const [lang, setLangState] = useState(getLang());
  const i18n = t(lang);

  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [batchLimit, setBatchLimit] = useState('20');
  const [apkEnabled, setApkEnabled] = useState(true);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem('merde_user') || '{}');

  const sortedFiles = useMemo(() => sortNewestFirst(files), [files]);

  async function load() {
    try {
      const [filesRes, notesRes, settingsRes] = await Promise.all([
        api.files(),
        api.notes(),
        api.settings(),
      ]);
      setFiles(filesRes.files || []);
      setNotes(notesRes.notes || []);
      setBatchLimit(String(settingsRes.settings?.upload_batch_limit ?? 20));
      setApkEnabled(settingsRes.settings?.apk_enabled !== false);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Pendant une récupération active, rafraîchir la liste régulièrement
  useEffect(() => {
    if (section !== 'files' || !apkEnabled) return undefined;
    const id = setInterval(() => load(), 10000);
    return () => clearInterval(id);
  }, [section, apkEnabled]);

  function changeLang(next) {
    setLang(next);
    setLangState(next);
  }

  function logout() {
    localStorage.removeItem('merde_token');
    localStorage.removeItem('merde_user');
    nav('/login');
  }

  async function remove(id) {
    if (!window.confirm(i18n.confirmDelete || 'Supprimer ce fichier ?')) return;
    try {
      await api.deleteFile(id);
      setFiles((prev) => prev.filter((f) => Number(f.id) !== Number(id)));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function addNote(e) {
    e.preventDefault();
    try {
      await api.createNote(noteTitle.trim(), noteBody.trim());
      setNoteTitle('');
      setNoteBody('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeNote(id) {
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => Number(n.id) !== Number(id)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveBatchLimit(e) {
    e.preventDefault();
    setSettingsMsg('');
    try {
      const res = await api.updateSettings({ upload_batch_limit: Number(batchLimit) });
      setBatchLimit(String(res.settings.upload_batch_limit));
      setApkEnabled(res.settings.apk_enabled !== false);
      setSettingsMsg(i18n.settingsSaved);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleApk(enabled) {
    setSettingsMsg('');
    try {
      const res = await api.updateSettings({ apk_enabled: enabled });
      setApkEnabled(res.settings.apk_enabled !== false);
      setSettingsMsg(enabled ? i18n.recoveryStarted : i18n.recoveryStopped);
      setError('');
      if (enabled) {
        setTimeout(() => load(), 5000);
        setTimeout(() => load(), 15000);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function downloadOne(f) {
    setError('');
    try {
      await downloadUrl(f.url, f.original_name || `file-${f.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function downloadAll() {
    if (!sortedFiles.length) return;
    setDownloading(true);
    setError('');
    try {
      for (const f of sortedFiles) {
        await downloadUrl(f.url, f.original_name || `file-${f.id}`);
        // petit délai pour éviter que le navigateur bloque les téléchargements multiples
        await new Promise((r) => setTimeout(r, 350));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  function go(id) {
    if (!SECTIONS.includes(id)) return;
    setSection(id);
    setSidebarOpen(false);
  }

  const navItems = [
    { id: 'files', label: i18n.filesReceived },
    { id: 'settings', label: i18n.settings },
    { id: 'config', label: i18n.config },
    { id: 'apk', label: i18n.apk },
    { id: 'howto', label: i18n.howto },
  ];

  return (
    <div className="dash-layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Link to="/">{i18n.brand}</Link>
          <span className="meta">{user.username}</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link ${section === item.id ? 'active' : ''}`}
              onClick={() => go(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="btn secondary" type="button" onClick={load}>
            {i18n.refresh}
          </button>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Fermer"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="dash-main">
        <header className="dash-top">
          <button
            className="btn secondary menu-btn"
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            Menu
          </button>
          <h1>{navItems.find((n) => n.id === section)?.label || i18n.dashboard}</h1>
        </header>

        {error ? <div className="error">{error}</div> : null}

        {section === 'files' ? (
          <section className="dash-section">
            <div className="notes-panel">
              <h2>{i18n.startRecovery}</h2>
              <p className="meta">{i18n.recoveryHelp}</p>
              <p className="meta">
                {apkEnabled ? i18n.apkOn : i18n.apkOff}
              </p>
              <div className="file-actions" style={{ marginTop: '0.75rem' }}>
                <button className="btn" type="button" onClick={() => toggleApk(true)}>
                  {i18n.startRecovery}
                </button>
                <button
                  className="btn danger"
                  type="button"
                  onClick={() => toggleApk(false)}
                  disabled={!apkEnabled}
                >
                  {i18n.stopRecovery}
                </button>
                <button className="btn secondary" type="button" onClick={load}>
                  {i18n.refresh}
                </button>
              </div>
              {settingsMsg ? <p className="meta">{settingsMsg}</p> : null}
            </div>

            <div className="section-toolbar">
              <p className="meta">{i18n.filesCount(sortedFiles.length)}</p>
              <button
                className="btn"
                type="button"
                disabled={!sortedFiles.length || downloading}
                onClick={downloadAll}
              >
                {downloading ? i18n.downloading : i18n.downloadAll}
              </button>
            </div>

            {sortedFiles.length === 0 ? (
              <p className="empty">{i18n.noFiles}</p>
            ) : (
              <div className="grid">
                {sortedFiles.map((f) => (
                  <article className="file" key={f.id}>
                    {String(f.resource_type).includes('video') ||
                    String(f.mime_type).startsWith('video/') ? (
                      <video src={f.url} controls />
                    ) : (
                      <img src={f.url} alt={f.original_name} />
                    )}
                    <div className="file-body">
                      <div className="file-name">{f.original_name}</div>
                      <div className="meta">
                        {f.device_label || f.device_uid || 'appareil'} ·{' '}
                        {new Date(f.created_at).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR')}
                      </div>
                      <div className="file-actions">
                        <button
                          className="btn secondary"
                          type="button"
                          onClick={() => downloadOne(f)}
                        >
                          {i18n.download}
                        </button>
                        <button className="btn danger" type="button" onClick={() => remove(f.id)}>
                          {i18n.delete}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {section === 'settings' ? (
          <section className="dash-section">
            <div className="notes-panel">
              <h2>{i18n.language}</h2>
              <div className="lang-switch">
                <button
                  type="button"
                  className={`btn ${lang === 'fr' ? '' : 'secondary'}`}
                  onClick={() => changeLang('fr')}
                >
                  Français
                </button>
                <button
                  type="button"
                  className={`btn ${lang === 'en' ? '' : 'secondary'}`}
                  onClick={() => changeLang('en')}
                >
                  English
                </button>
              </div>
            </div>

            <div className="notes-panel">
              <h2>{i18n.leaveComment}</h2>
              <form className="note-form" onSubmit={addNote}>
                <input
                  placeholder={i18n.commentTitle}
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                />
                <textarea
                  placeholder={i18n.commentBody}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  required
                  rows={3}
                />
                <button className="btn" type="submit">
                  {i18n.sendComment}
                </button>
              </form>
              {notes.length === 0 ? (
                <p className="empty">{i18n.noComments}</p>
              ) : (
                <ul className="notes-list">
                  {notes.map((n) => (
                    <li key={n.id}>
                      <strong>{n.title || '—'}</strong>
                      <p>{n.body}</p>
                      <button
                        className="btn danger"
                        type="button"
                        onClick={() => removeNote(n.id)}
                      >
                        {i18n.delete}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="notes-panel">
              <button className="btn danger" type="button" onClick={logout}>
                {i18n.logout}
              </button>
            </div>
          </section>
        ) : null}

        {section === 'config' ? (
          <section className="dash-section">
            <div className="notes-panel">
              <h2>{i18n.config}</h2>
              <p className="meta">{i18n.batchLimit}</p>
              <form className="note-form settings-form" onSubmit={saveBatchLimit}>
                <label htmlFor="batch-limit">{i18n.batchLimit}</label>
                <input
                  id="batch-limit"
                  type="number"
                  min={1}
                  max={500}
                  value={batchLimit}
                  onChange={(e) => setBatchLimit(e.target.value)}
                  required
                />
                <button className="btn" type="submit">
                  {i18n.save}
                </button>
              </form>
              {settingsMsg ? <p className="meta">{settingsMsg}</p> : null}
            </div>

            <div className="notes-panel">
              <h2>{i18n.apkControl}</h2>
              <p className="meta">{i18n.apkControlHelp}</p>
              <p className="meta">
                {apkEnabled ? i18n.apkOn : i18n.apkOff}
              </p>
              <div className="file-actions" style={{ marginTop: '0.75rem' }}>
                {apkEnabled ? (
                  <button className="btn danger" type="button" onClick={() => toggleApk(false)}>
                    {i18n.stopApk}
                  </button>
                ) : (
                  <button className="btn" type="button" onClick={() => toggleApk(true)}>
                    {i18n.startApk}
                  </button>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {section === 'apk' ? (
          <section className="dash-section">
            <div className="notes-panel apk-panel">
              <h2>{i18n.apk}</h2>
              <p className="meta">{i18n.apkPageHelp}</p>
              <img
                className="apk-logo"
                src="/bloody-cross-logo.png"
                alt="Bloody Cross"
              />
              <button className="btn" type="button" onClick={() => downloadApkOrWarn()}>
                {i18n.downloadApk}
              </button>
            </div>
          </section>
        ) : null}

        {section === 'howto' ? (
          <section className="dash-section">
            <div className="notes-panel">
              <h2>{i18n.howtoTitle}</h2>
              <ol className="howto-list">
                {i18n.howtoSteps.map((step) => (
                  <li key={step.title}>
                    <strong>{step.title}</strong>
                    <p>{step.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

