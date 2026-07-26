import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { DEMO_ROLE_OPTIONS } from '../data/demo-fixtures';
import { DEMO_DISCLOSURE, IS_DEMO_MODE } from '../config/runtime';
import Navbar from '../components/Navbar';
import '../styles/pages/Auth.css';

export default function Login() {
  const { login, loginAsDemo, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Lütfen tüm alanları doldurun.');
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
      setError(result.error || 'Demo hesabı açılamadı.');
    }
  };

  return (
    <div className="page">
      <Navbar />
      <main className="auth-page">
        <div className="split-layout">
          <div className="split-decorative">
            <div className="auth-decorative-content">
              <h2>{IS_DEMO_MODE ? 'Üç Rol, Tek Ürün Hikâyesi' : 'Hoş Geldiniz'}</h2>
              <p>{IS_DEMO_MODE ? 'Danışan, uzman ve yönetici deneyimlerini ayrı ayrı inceleyin.' : 'Kimliğiniz gizli, sesiniz duyulur.'}</p>
              <div className="auth-deco-features">
                <div className="auth-deco-feat">Rumuz temelli danışan deneyimi</div>
                <div className="auth-deco-feat">Kurgusal uzman doğrulama akışı</div>
                <div className="auth-deco-feat">Gizlilik kontrollü seans prototipi</div>
              </div>
            </div>
          </div>
          <div className="split-content">
            <div className="auth-form-wrapper">
              <h2>{IS_DEMO_MODE ? 'Demoyu Bir Rolle Açın' : 'Giriş Yap'}</h2>
              <p className="auth-subtitle">
                {IS_DEMO_MODE
                  ? DEMO_DISCLOSURE.description
                  : 'Hesabınıza giriş yaparak devam edin'}
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
                        <strong>{option.title}</strong>
                        <small>{option.description}</small>
                      </span>
                      <span className="demo-role-arrow" aria-hidden="true">›</span>
                    </button>
                  ))}
                  {error && <div className="auth-error">{error}</div>}
                  <p className="demo-safety-note">
                    Demo oturumları tarayıcınızda tutulur. Gösterilen adlar, belgeler,
                    randevular ve değerlendirmeler tamamen kurgusaldır.
                  </p>
                </div>
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="auth-form">
                <div className="input-group">
                  <label htmlFor="login-email">E-posta</label>
                  <input
                    type="email"
                    id="login-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@email.com"
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="login-password">Şifre</label>
                  <input
                    type="password"
                    id="login-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="auth-options">
                  <span className="input-hint">Hesap türünüz otomatik olarak belirlenir.</span>
                  <Link to="/sifremi-unuttum" className="auth-forgot" id="login-forgot">Şifremi Unuttum</Link>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={isLoading} id="login-submit">
                  {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </button>
                  </form>

                  <div className="divider-text">veya</div>

                  <p className="auth-switch">
                    Hesabınız yok mu?{' '}
                    <Link to="/kayit" id="login-to-register">Ücretsiz Başla</Link>
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
