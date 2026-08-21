import { Link } from 'react-router';
import Navbar from '../components/Navbar';
import { BRAND } from '../config/brand';
import { useLanguage } from '../context/LanguageContext';
import '../styles/pages/Auth.css';

export default function RegisterChoice() {
  const { t } = useLanguage();

  return (
    <div className="page">
      <Navbar />
      <main className="page-content">
        <div className="container container-md" style={{ paddingTop: 'var(--space-3xl)', paddingBottom: 'var(--space-3xl)' }}>
          <div className="text-center mb-2xl">
            <h1>{t('registerChoice.title', { brand: BRAND.name })}</h1>
            <p className="section-subtitle" style={{ color: 'var(--text-secondary)' }}>{t('registerChoice.subtitle')}</p>
          </div>

          <div className="register-choice-grid">
            <Link to="/kayit/danisan" className="card card-glass card-interactive register-choice-card" id="register-as-client">
              <div className="card-body text-center">
                <span className="register-choice-icon">🧑</span>
                <h3>{t('registerChoice.clientTitle')}</h3>
                <p>{t('registerChoice.clientDescription')}</p>
                <div className="register-choice-features">
                  <span>{t('registerChoice.clientFeature1')}</span>
                  <span>{t('registerChoice.clientFeature2')}</span>
                  <span>{t('registerChoice.clientFeature3')}</span>
                </div>
                <span className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }}>{t('registerChoice.clientCta')}</span>
              </div>
            </Link>

            <Link to="/kayit/psikolog" className="card card-glass card-interactive register-choice-card" id="register-as-psychologist">
              <div className="card-body text-center">
                <span className="register-choice-icon">👨‍⚕️</span>
                <h3>{t('registerChoice.psychologistTitle')}</h3>
                <p>{t('registerChoice.psychologistDescription')}</p>
                <div className="register-choice-features">
                  <span>{t('registerChoice.psychologistFeature1')}</span>
                  <span>{t('registerChoice.psychologistFeature2')}</span>
                  <span>{t('registerChoice.psychologistFeature3')}</span>
                </div>
                <span className="btn btn-outline" style={{ marginTop: 'var(--space-md)' }}>{t('registerChoice.psychologistCta')}</span>
              </div>
            </Link>
          </div>

          <p className="text-center mt-xl auth-switch">
            {t('registerChoice.alreadyHaveAccount')} <Link to="/giris" id="register-to-login">{t('registerChoice.loginLink')}</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
