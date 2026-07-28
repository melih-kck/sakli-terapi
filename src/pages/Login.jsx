import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { DEMO_ROLE_OPTIONS } from '../data/demo-fixtures';
import { IS_DEMO_MODE } from '../config/runtime';
import Navbar from '../components/Navbar';
import BlurVideoDemo from '../components/BlurVideoDemo';
import '../styles/pages/Auth.css';

export default function Login() {
  const { login, loginAsDemo, isLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError(t('loginPage.fillAll'));
      return;
    }
    const result = await login(email, password);
    if (result.success) {
      if (result.role === 'admin') {
        navigate(result.mfa?.verified ? '/admin' : '/admin-mfa');
      } else {
        navigate(result.role === 'client' ? '/panel' : '/psikolog-panel');
      }
    } else if (result.needsEmailConfirmation) {
      navigate('/e-posta-dogrula', { state: { email: email.trim().toLowerCase() } });
    }
  };

  const handleDemoLogin = async (option) => {
    setError('');
    const result = await loginAsDemo(option.role);
    if (result.success) {
      navigate(option.destination);
    } else {
      setError(result.error || t('loginPage.demoError'));
    }
  };

  return (
    <div className="page">
      <Navbar />
      <main className="auth-page">
        <div className={`split-layout ${IS_DEMO_MODE ? 'demo-auth-layout' : ''}`}>
          <div className={`split-decorative ${IS_DEMO_MODE ? 'demo-blur-side' : ''}`}>
            <div className="auth-decorative-content">
              {IS_DEMO_MODE ? (
                <BlurVideoDemo />
              ) : (
                <>
                  <h2>{t('loginPage.welcome')}</h2>
                  <p>{t('loginPage.liveSubtitle')}</p>
                  <div className="auth-deco-features">
                    {t('loginPage.features').map((feature) => <div className="auth-deco-feat" key={feature}>{feature}</div>)}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="split-content">
            <div className="auth-form-wrapper">
              <h1>{IS_DEMO_MODE ? t('loginPage.titleDemo') : t('loginPage.titleLive')}</h1>
              <p className="auth-subtitle">
                {IS_DEMO_MODE
                  ? t('demo.description')
                  : t('loginPage.liveDescription')}
              </p>

              {IS_DEMO_MODE ? (
                <div className="demo-role-list">
                  {DEMO_ROLE_OPTIONS.map((option) => (
                    <button
                      type="button"
                      className="demo-role-option"
                      key={option.role}
                      onClick={() => handleDemoLogin(option)}
                      disabled={isLoading}
                      id={`demo-login-${option.role}`}
                    >
                      <span className="demo-role-mark" aria-hidden="true">
                        {option.role === 'client' ? 'D' : option.role === 'psychologist' ? 'U' : 'Y'}
                      </span>
                      <span>
                        <strong>{t(`loginPage.${option.role}Title`)}</strong>
                        <small>{t(`loginPage.${option.role}Description`)}</small>
                      </span>
                      <span className="demo-role-arrow" aria-hidden="true">›</span>
                    </button>
                  ))}
                  {error && <div className="auth-error">{error}</div>}
                  <p className="demo-safety-note">
                    {t('loginPage.safety')}
                  </p>
                </div>
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="auth-form">
                <div className="input-group">
                  <label htmlFor="login-email">{t('loginPage.email')}</label>
                  <input
                    type="email"
                    id="login-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@email.com"
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="login-password">{t('loginPage.password')}</label>
                  <input
                    type="password"
                    id="login-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="auth-options">
                  <span className="input-hint">{t('loginPage.accountTypeHint')}</span>
                  <Link to="/sifremi-unuttum" className="auth-forgot" id="login-forgot">{t('loginPage.forgotPassword')}</Link>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={isLoading} id="login-submit">
                  {isLoading ? t('loginPage.loggingIn') : t('common.login')}
                </button>
                  </form>

                  <div className="divider-text">{t('loginPage.or')}</div>

                  <p className="auth-switch">
                    {t('loginPage.noAccount')}{' '}
                    <Link to="/kayit" id="login-to-register">{t('common.freeStart')}</Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
