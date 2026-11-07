import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { getLang, t } from '../i18n';

export default function Login() {
  const nav = useNavigate();
  const i18n = t(getLang());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      localStorage.setItem('merde_token', res.token);
      localStorage.setItem('merde_user', JSON.stringify(res.user));
      nav('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" to="/">
          {i18n.brand}
        </Link>
      </header>
      <form className="panel" onSubmit={onSubmit}>
        <h1>{i18n.login}</h1>
        <label>{i18n.username}</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        <label>{i18n.password}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? <div className="error">{error}</div> : null}
        <div style={{ marginTop: '1rem' }}>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? '...' : i18n.login}
          </button>
        </div>
        <p style={{ marginTop: '1rem' }}>
          {i18n.noAccount} <Link to="/register">{i18n.register}</Link>
        </p>
      </form>
    </div>
  );
}
