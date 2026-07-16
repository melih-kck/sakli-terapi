import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import '../styles/pages/Auth.css';

export default function Login() {
  const { login, isLoading } = useAuth();
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

  return (
    <div className="page">
      <Navbar />
      <main className="auth-page">
        <div className="split-layout">
          <div className="split-decorative">
            <div className="auth-decorative-content">
              <div className="auth-deco-shapes">
                <div className="auth-shape auth-shape-1"></div>
                <div className="auth-shape auth-shape-2"></div>
              </div>
              <h2>Hoş Geldiniz</h2>
              <p>Kimliğiniz gizli, sesiniz duyulur.</p>
              <div className="auth-deco-features">
                <div className="auth-deco-feat">🔒 Anonim Seanslar</div>
                <div className="auth-deco-feat">👨‍⚕️ Onaylı Psikolog Profilleri</div>
                <div className="auth-deco-feat">💜 Sosyal Sorumluluk</div>
              </div>
            </div>
          </div>
          <div className="split-content">
            <div className="auth-form-wrapper">
              <h2>Giriş Yap</h2>
              <p className="auth-subtitle">Hesabınıza giriş yaparak devam edin</p>

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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
