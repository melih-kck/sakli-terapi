import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer" id="main-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand */}
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
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
              <span className="logo-text">Gizli<span className="logo-highlight">Biriz</span></span>
            </Link>
            <p className="footer-description">
              Kimliğiniz gizli, sesiniz duyulur. Anonim psikolojik danışmanlık platformu.
            </p>
            <div className="footer-social">
              <span className="social-link" aria-label="Twitter" id="footer-twitter">𝕏</span>
              <span className="social-link" aria-label="Instagram" id="footer-instagram">📷</span>
              <span className="social-link" aria-label="LinkedIn" id="footer-linkedin">in</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-section">
            <h4 className="footer-title">Hızlı Bağlantılar</h4>
            <ul className="footer-links">
              <li><Link to="/psikologlar" id="footer-psychologists">Psikologlarımız</Link></li>
              <li><Link to="/kayit" id="footer-register">Ücretsiz Başla</Link></li>
              <li><Link to="/hakkinda" id="footer-about">Hakkımızda</Link></li>
              <li><a href="mailto:iletisim@gizlibiriz.com" id="footer-contact-link">İletişim</a></li>
            </ul>
          </div>

          {/* Support */}
          <div className="footer-section">
            <h4 className="footer-title">Destek & İletişim</h4>
            <ul className="footer-links">
              <li><a href="mailto:destek@gizlibiriz.com" id="footer-contact">Bize Ulaşın</a></li>
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
                  <strong>Acil Yardım Hattı</strong>
                  <p>182 (İntihar Önleme)</p>
                </div>
              </div>
              <div className="emergency-card">
                <span className="emergency-icon">📞</span>
                <div>
                  <strong>ALO 182</strong>
                  <p>7/24 Psikolojik Destek</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p>© 2026 GizliBiriz. Tüm hakları saklıdır.</p>
          <div className="footer-badges">
            <span className="footer-badge">🔒 256-bit SSL</span>
            <span className="footer-badge">🛡️ KVKK Uyumlu</span>
            <span className="footer-badge">⚡ %100 Uçtan Uca Şifreli</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
