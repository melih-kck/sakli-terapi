import { Link } from 'react-router';
import { BRAND, getMailto } from '../config/brand';
import { DEMO_DISCLOSURE, IS_DEMO_MODE } from '../config/runtime';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer" id="main-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand */}
          <div className="footer-brand">
            <Link to="/" className="footer-logo" aria-label={`${BRAND.name} ana sayfa`}>
              <div className="logo-icon">
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="14" fill="url(#footerLogoGrad)" />
                  <path d="M16 8C11.58 8 8 11.58 8 16s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 2.5c1.38 0 2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5-2.5-1.12-2.5-2.5 1.12-2.5 2.5-2.5zm0 11.5c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08s5.97 1.09 6 3.08c-1.29 1.94-3.5 3.22-6 3.22z" fill="white" opacity="0.9"/>
                  <defs>
                    <linearGradient id="footerLogoGrad" x1="2" y1="2" x2="30" y2="30">
                      <stop stopColor="#4A3AFF" />
                      <stop offset="1" stopColor="#7B68EE" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className="logo-text">{BRAND.namePrimary} <span className="logo-highlight">{BRAND.nameAccent}</span></span>
            </Link>
            <p className="footer-description">
              {IS_DEMO_MODE
                ? DEMO_DISCLOSURE.description
                : `${BRAND.tagline} Rumuz temelli çevrim içi psikolojik destek platformu.`}
            </p>
          </div>

          {/* Quick Links */}
          <div className="footer-section">
            <h4 className="footer-title">Hızlı Bağlantılar</h4>
            <ul className="footer-links">
              <li><Link to="/psikologlar" id="footer-psychologists">{IS_DEMO_MODE ? 'Kurgusal Uzmanlar' : 'Psikologlarımız'}</Link></li>
              <li><Link to={IS_DEMO_MODE ? '/giris' : '/kayit'} id="footer-register">{IS_DEMO_MODE ? 'Demoyu Aç' : 'Ücretsiz Başla'}</Link></li>
              <li><Link to="/hakkinda" id="footer-about">Proje Hakkında</Link></li>
              {IS_DEMO_MODE
                ? <li><Link to="/kullanim-kosullari" id="footer-contact-link">Demo Sınırları</Link></li>
                : <li><a href={getMailto(BRAND.contactEmail)} id="footer-contact-link">İletişim</a></li>}
            </ul>
          </div>

          {/* Support */}
          <div className="footer-section">
            <h4 className="footer-title">Destek & İletişim</h4>
            <ul className="footer-links">
              {IS_DEMO_MODE
                ? <li><Link to="/hakkinda" id="footer-contact">Teknik Kapsam</Link></li>
                : <li><a href={getMailto(BRAND.supportEmail)} id="footer-contact">Bize Ulaşın</a></li>}
              <li><Link to="/sss" id="footer-faq">Sık Sorulan Sorular</Link></li>
              <li><Link to="/gizlilik-politikasi" id="footer-privacy">Gizlilik Politikası</Link></li>
              <li><Link to="/kullanim-kosullari" id="footer-terms">Kullanım Koşulları</Link></li>
            </ul>
          </div>

          {/* Emergency */}
          <div className="footer-section">
            <h4 className="footer-title">Acil Durumlar</h4>
            <div className="footer-emergency">
              <div className="emergency-card">
                <span className="emergency-icon">🚨</span>
                <div>
                  <strong>Hayati risk veya acil durum</strong>
                  <p>112 Acil Çağrı Merkezi</p>
                </div>
              </div>
              <div className="emergency-card">
                <span className="emergency-icon">📞</span>
                <div>
                  <strong>Hastane randevusu</strong>
                  <p>MHRS veya ALO 182</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p>© 2026 {BRAND.name}. {IS_DEMO_MODE ? 'Akademik değerlendirme prototipi.' : 'Tüm hakları saklıdır.'}</p>
          <div className="footer-badges">
            <span className="footer-badge">🔒 TLS bağlantısı</span>
            <span className="footer-badge">🛡️ Rol bazlı erişim</span>
            <span className="footer-badge">⚡ Veri minimizasyonu</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
