import { Link } from 'react-router-dom';
import { downloadApkOrWarn } from '../apkDownload';
import { getLang, t } from '../i18n';

export default function Home() {
  const i18n = t(getLang());

  return (
    <div className="shell shell-home">
      <header className="topbar topbar-home">
        <div className="brand">{i18n.brand}</div>
        <nav className="nav nav-home">
          <button className="btn secondary btn-sm" type="button" onClick={() => downloadApkOrWarn()}>
            {i18n.downloadApk}
          </button>
          <Link className="btn secondary btn-sm" to="/login">
            {i18n.login}
          </Link>
          <Link className="btn btn-sm" to="/register">
            {i18n.register}
          </Link>
        </nav>
      </header>

      <section className="hero hero-home">
        <div className="hero-copy">
          <h1>{i18n.brand}</h1>
          <p>{i18n.homeTagline}</p>
          <div className="hero-actions">
            <Link className="btn" to="/register">
              {i18n.start}
            </Link>
            <Link className="btn secondary" to="/login">
              {i18n.hasAccount}
            </Link>
            <button className="btn secondary" type="button" onClick={() => downloadApkOrWarn()}>
              {i18n.downloadApk}
            </button>
          </div>
        </div>
        <div className="hero-logo-wrap">
          <img
            className="hero-logo"
            src="/bloody-cross-logo.png"
            alt="Bloody Cross — crâne rouge fendu à lueur verte et texte dripping"
          />
        </div>
      </section>
    </div>
  );
}
