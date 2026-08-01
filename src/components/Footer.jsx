import { Link } from 'react-router';
import { BRAND, getMailto } from '../config/brand';
import { IS_DEMO_MODE } from '../config/runtime';
import { useLanguage } from '../context/LanguageContext';
import './Footer.css';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="footer" id="main-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand */}
          <div className="footer-brand">
            <Link to="/" className="footer-logo" aria-label={`${BRAND.name} ${t('common.home')}`}>
              <div className="logo-icon">
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="14" fill="url(#footerLogoGrad)" />
                  <path d="M16 8C11.58 8 8 11.58 8 16s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 2.5c1.38 0 2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5-2.5-1.12-2.5-2.5 1.12-2.5 2.5-2.5zm0 11.5c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08s5.97 1.09 6 3.08c-1.29 1.94-3.5 3.22-6 3.22z" fill="#FFFAF0" opacity="0.9"/>
                  <defs>
                    <linearGradient id="footerLogoGrad" x1="2" y1="2" x2="30" y2="30">
                      <stop stopColor="#102F2D" />
                      <stop offset="1" stopColor="#1D4A46" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className="logo-text">{BRAND.namePrimary} <span className="logo-highlight">{BRAND.nameAccent}</span></span>
            </Link>
            <p className="footer-description">
              {IS_DEMO_MODE
                ? t('demo.description')
                : t('footer.liveDescription', { tagline: BRAND.tagline })}
            </p>
          </div>

          {/* Quick Links */}
          <div className="footer-section">
            <h4 className="footer-title">{t('footer.quickLinks')}</h4>
            <ul className="footer-links">
              <li><Link to="/psikologlar" id="footer-psychologists">{IS_DEMO_MODE ? t('footer.fictionalExperts') : t('footer.ourPsychologists')}</Link></li>
              <li><Link to={IS_DEMO_MODE ? '/giris' : '/kayit'} id="footer-register">{IS_DEMO_MODE ? t('common.openDemo') : t('common.freeStart')}</Link></li>
              <li><Link to="/hakkinda" id="footer-about">{t('footer.projectAbout')}</Link></li>
              {IS_DEMO_MODE
                ? <li><Link to="/kullanim-kosullari" id="footer-contact-link">{t('footer.demoLimits')}</Link></li>
                : <li><a href={getMailto(BRAND.contactEmail)} id="footer-contact-link">{t('footer.contact')}</a></li>}
            </ul>
          </div>

          {/* Support */}
          <div className="footer-section">
            <h4 className="footer-title">{t('footer.supportContact')}</h4>
            <ul className="footer-links">
              {IS_DEMO_MODE
                ? <li><Link to="/hakkinda" id="footer-contact">{t('footer.technicalScope')}</Link></li>
                : <li><a href={getMailto(BRAND.supportEmail)} id="footer-contact">{t('footer.contactUs')}</a></li>}
              <li><Link to="/sss" id="footer-faq">{t('footer.faq')}</Link></li>
              <li><Link to="/gizlilik-politikasi" id="footer-privacy">{t('footer.privacy')}</Link></li>
              <li><Link to="/kullanim-kosullari" id="footer-terms">{t('footer.terms')}</Link></li>
            </ul>
          </div>

          {/* Emergency */}
          <div className="footer-section">
            <h4 className="footer-title">{t('footer.emergencies')}</h4>
            <div className="footer-emergency">
              <div className="emergency-card">
                <span className="emergency-icon">🚨</span>
                <div>
                  <strong>{t('footer.emergencyRisk')}</strong>
                  <p>{t('footer.emergencyNumber')}</p>
                </div>
              </div>
              <div className="emergency-card">
                <span className="emergency-icon">📞</span>
                <div>
                  <strong>{t('footer.hospitalAppointment')}</strong>
                  <p>{t('footer.hospitalChannels')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p>© 2026 {BRAND.name}. {IS_DEMO_MODE ? t('footer.portfolio') : t('footer.rights')}</p>
          <div className="footer-badges">
            <span className="footer-badge">🔒 {t('footer.tls')}</span>
            <span className="footer-badge">🛡️ {t('footer.roleAccess')}</span>
            <span className="footer-badge">⚡ {t('footer.dataMinimization')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
