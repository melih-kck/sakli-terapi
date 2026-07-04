import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import '../styles/pages/Auth.css';

export default function RegisterChoice() {
  return (
    <div className="page">
      <Navbar />
      <main className="page-content">
        <div className="container container-md" style={{ paddingTop: 'var(--space-3xl)', paddingBottom: 'var(--space-3xl)' }}>
          <div className="text-center mb-2xl">
            <h2>GizliBiriz'e Katılın</h2>
            <p className="section-subtitle" style={{ color: 'var(--text-secondary)' }}>Nasıl kayıt olmak istiyorsunuz?</p>
          </div>

          <div className="register-choice-grid">
            <Link to="/kayit/danisan" className="card card-glass card-interactive register-choice-card" id="register-as-client">
              <div className="card-body text-center">
                <span className="register-choice-icon">🧑</span>
                <h3>Danışan Olarak</h3>
                <p>Anonim olarak profesyonel psikolojik destek alın. Kimliğiniz her zaman gizli kalacaktır.</p>
                <div className="register-choice-features">
                  <span>🔒 Tam Anonimlik</span>
                  <span>💬 Çoklu İletişim</span>
                  <span>⭐ Psikolog Seçimi</span>
                </div>
                <span className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }}>Danışan Olarak Başla →</span>
              </div>
            </Link>

            <Link to="/kayit/psikolog" className="card card-glass card-interactive register-choice-card" id="register-as-psychologist">
              <div className="card-body text-center">
                <span className="register-choice-icon">👨‍⚕️</span>
                <h3>Psikolog Olarak</h3>
                <p>Platformumuza katılarak danışanlara anonim psikolojik destek sunun.</p>
                <div className="register-choice-features">
                  <span>✅ Kimlik Doğrulaması</span>
                  <span>📊 Değerlendirme Sistemi</span>
                  <span>💜 Sosyal Sorumluluk</span>
                </div>
                <span className="btn btn-outline" style={{ marginTop: 'var(--space-md)' }}>Psikolog Olarak Başla →</span>
              </div>
            </Link>
          </div>

          <p className="text-center mt-xl auth-switch">
            Zaten hesabınız var mı? <Link to="/giris" id="register-to-login">Giriş Yapın</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
