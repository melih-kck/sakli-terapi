import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SPECIALIZATIONS } from '../data/constants';
import Navbar from '../components/Navbar';
import { BRAND } from '../config/brand';
import '../styles/pages/Auth.css';

export default function RegisterClient() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  const [form, setForm] = useState({
    alias: '', email: '', password: '', passwordConfirm: '',
    topics: [], style: 'video-blur',
    emergencyName: '', emergencyPhone: '',
    privacy: false, terms: false,
    privacyLevel: 5,
  });

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleTopic = (id) => {
    setForm(prev => ({
      ...prev,
      topics: prev.topics.includes(id)
        ? prev.topics.filter(t => t !== id)
        : [...prev.topics, id],
    }));
  };

  const canProceed = () => {
    switch (step) {
      case 1: return form.alias.trim().length >= 3
        && form.email.includes('@')
        && form.password.length >= 8
        && form.password === form.passwordConfirm;
      case 2: return form.topics.length > 0;
      case 3: return true;
      case 4: return form.privacy && form.terms;
      case 5: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    const result = await register(form.email, form.password, form, 'client');
    if (result.success) {
      navigate(result.needsEmailConfirmation ? '/e-posta-dogrula' : '/giris', {
        state: result.needsEmailConfirmation ? { email: result.email } : undefined,
      });
    }
  };

  const blurLabels = ['Hafif', 'Dengeli', 'Güçlü', 'Yüksek', 'Maksimum'];
  const blurValues = [8, 12, 16, 22, 28];

  return (
    <div className="page">
      <Navbar />
      <main className="page-content">
        <div className="container container-md" style={{ padding: 'var(--space-2xl) var(--space-lg)' }}>
          <div className="text-center mb-xl">
            <h2>Danışan Kaydı</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Anonim hesabınızı oluşturun</p>
          </div>

          {/* Steps Indicator */}
          <div className="register-steps">
            {['Bilgiler', 'Ön Anket', 'Acil Durum', 'Sözleşme', 'Gizlilik'].map((label, i) => (
              <div key={i} className="register-step-item">
                {i > 0 && <div className={`step-connector ${step > i ? 'completed' : ''}`}></div>}
                <div className={`step ${step > i + 1 ? 'completed' : ''} ${step === i + 1 ? 'active' : ''}`}>
                  <div className="step-number">{step > i + 1 ? '✓' : i + 1}</div>
                  <span className="step-label">{label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Step Content */}
          <div className="card card-elevated register-card">
            <div className="card-body">
              {step === 1 && (
                <div className="register-step-content slide-up">
                  <h3>Temel Bilgiler</h3>
                  <div className="auth-info-box">
                    Kayıtta gerçek adınız istenmez; psikolog ekranında seçtiğiniz rumuz görünür.
                  </div>
                  <div className="auth-form">
                    <div className="input-group">
                      <label htmlFor="reg-alias">Rumuz</label>
                      <input type="text" id="reg-alias" value={form.alias} onChange={(e) => update('alias', e.target.value)} placeholder="Örn: HuzurluGezgin" />
                      <span className="input-hint">Bu isim psikologunuzun sizi tanıyacağı isimdir</span>
                    </div>
                    <div className="input-group">
                      <label htmlFor="reg-email">E-posta</label>
                      <input type="email" id="reg-email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="ornek@email.com" />
                    </div>
                    <div className="grid grid-2 gap-md">
                      <div className="input-group">
                        <label htmlFor="reg-password">Şifre</label>
                        <input type="password" id="reg-password" value={form.password} onChange={(e) => update('password', e.target.value)} minLength="8" placeholder="En az 8 karakter" />
                      </div>
                      <div className="input-group">
                        <label htmlFor="reg-password2">Şifre Tekrar</label>
                        <input type="password" id="reg-password2" value={form.passwordConfirm} onChange={(e) => update('passwordConfirm', e.target.value)} minLength="8" placeholder="Şifrenizi tekrar yazın" />
                      </div>
                    </div>
                    {form.password && form.passwordConfirm && form.password !== form.passwordConfirm && (
                      <p style={{ color: 'var(--danger)', fontSize: 'var(--text-xs)' }}>Şifreler eşleşmiyor</p>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="register-step-content slide-up">
                  <h3>Ön Anket</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    Size en uygun psikoloğu eşleştirmemize yardımcı olun.
                  </p>
                  <div className="auth-form">
                    <div className="input-group">
                      <label>Hangi konularda destek arıyorsunuz? (Birden fazla seçebilirsiniz)</label>
                      <div className="topic-grid">
                        {SPECIALIZATIONS.map(spec => (
                          <button key={spec.id} type="button" className={`tag ${form.topics.includes(spec.id) ? 'active' : ''}`} onClick={() => toggleTopic(spec.id)} id={`reg-topic-${spec.id}`}>
                            {spec.icon} {spec.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="input-group">
                      <label>Tercih ettiğiniz seans / iletişim türü?</label>
                      <div className="style-options">
                        {[
                          { id: 'video-blur', label: '👤 Görüntülü (Blur)', desc: 'Yüzünüz gizlenerek kameralı görüşme' }, 
                          { id: 'voice', label: '🎙️ Sadece Sesli', desc: 'Kamera kapalı, sesli arama' }, 
                          { id: 'text', label: '💬 Metin / Yazışma', desc: 'Seans odasında gerçek zamanlı mesajlaşma' }
                        ].map(s => (
                          <label key={s.id} className={`style-option ${form.style === s.id ? 'selected' : ''}`}>
                            <input type="radio" name="style" value={s.id} checked={form.style === s.id} onChange={() => update('style', s.id)} />
                            <span className="style-label">{s.label}</span>
                            <span className="style-desc">{s.desc}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="register-step-content slide-up">
                  <h3>Acil Durum Bilgileri</h3>
                  <div className="auth-warning-box">
                    Bu alan isteğe bağlıdır. {BRAND.name} acil müdahale hizmeti değildir; hayati riskte 112 aranmalıdır.
                  </div>
                  <div className="auth-form">
                    <div className="input-group">
                      <label htmlFor="reg-emergency-name">Yakın Kişi Adı</label>
                      <input type="text" id="reg-emergency-name" value={form.emergencyName} onChange={(e) => update('emergencyName', e.target.value)} placeholder="Adı Soyadı" />
                    </div>
                    <div className="input-group">
                      <label htmlFor="reg-emergency-phone">Yakın Kişi Telefonu</label>
                      <input type="tel" id="reg-emergency-phone" value={form.emergencyPhone} onChange={(e) => update('emergencyPhone', e.target.value)} placeholder="0555 555 55 55" />
                    </div>
                    <div className="auth-info-box">
                      Acil kişi alanları psikolog ekranlarında görünmez; yetkili yönetici erişimiyle sınırlandırılır.
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="register-step-content slide-up">
                  <h3>Sözleşme Onayı</h3>
                  <div className="contract-box">
                    <h4>{BRAND.name} Hizmet Özeti</h4>
                    <div className="contract-text">
                      <p><strong>1. Profil ayrımı:</strong> Psikolog ekranlarında danışan rumuzu ve randevu için gerekli tercihler gösterilir; e-posta ve acil kişi alanları gösterilmez.</p>
                      <p><strong>2. Görüntü tercihi:</strong> Görüntülü seanslarda blur seviyesi danışan tarafından değiştirilebilir. Sesli ve metin kanalları ayrıca seçilebilir.</p>
                      <p><strong>3. Acil durum:</strong> Platform acil kriz müdahalesi yerine geçmez. Hayati risk veya acil durumda 112 Acil Çağrı Merkezi aranmalıdır.</p>
                      <p><strong>4. Ödeme:</strong> Ödeme entegrasyonu henüz etkin değildir ve finansal bilgi toplanmaz.</p>
                      <p><strong>5. Seans içeriği:</strong> Uygulama görüntü, ses veya yazışma içeriğini veritabanında kaydetmez.</p>
                    </div>
                  </div>
                  <div className="auth-form">
                    <label className="checkbox-group">
                      <input type="checkbox" checked={form.privacy} onChange={(e) => update('privacy', e.target.checked)} id="reg-privacy-policy" />
                      <span><Link to="/gizlilik-politikasi">Gizlilik Politikasını</Link> okudum.</span>
                    </label>
                    <label className="checkbox-group">
                      <input type="checkbox" checked={form.terms} onChange={(e) => update('terms', e.target.checked)} id="reg-terms" />
                      <span><Link to="/kullanim-kosullari">Kullanım Koşullarını</Link> kabul ediyorum.</span>
                    </label>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="register-step-content slide-up">
                  <h3>Gizlilik Tercihiniz</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    Varsayılan gizlilik seviyenizi seçin. Bu ayarı istediğiniz zaman değiştirebilirsiniz.
                  </p>
                  <div className="privacy-selector">
                    <div className="privacy-preview">
                      <div className="privacy-avatar" style={{ filter: `blur(${blurValues[form.privacyLevel - 1]}px)` }}>
                        <div className="avatar avatar-2xl">
                          {form.alias?.charAt(0) || '?'}
                        </div>
                      </div>
                      <p className="privacy-level-label">{blurLabels[form.privacyLevel - 1]}</p>
                    </div>
                    <div className="privacy-levels">
                      {[5, 4, 3, 2, 1].map(level => (
                        <button
                          key={level}
                          className={`privacy-level-btn ${form.privacyLevel === level ? 'active' : ''}`}
                          onClick={() => update('privacyLevel', level)}
                          id={`reg-privacy-${level}`}
                        >
                          <span className="privacy-level-num">{level}</span>
                          <span className="privacy-level-name">{blurLabels[level - 1]}</span>
                          <span className="privacy-level-desc">
                            {level === 5 ? 'Maksimum blur' : level === 4 ? 'Yüksek blur' : level === 3 ? 'Güçlü blur' : level === 2 ? 'Dengeli blur' : 'Hafif blur'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="auth-info-box">
                    ℹ️ Seans sırasında blur seviyesini istediğiniz zaman ayarlayabilirsiniz.
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="card-footer register-nav">
              {step > 1 ? (
                <button className="btn btn-ghost" onClick={() => setStep(step - 1)} id="reg-back">← Geri</button>
              ) : (
                <Link to="/kayit" className="btn btn-ghost">← Geri</Link>
              )}
              {step < totalSteps ? (
                <button className="btn btn-primary" onClick={() => setStep(step + 1)} disabled={!canProceed()} id="reg-next">
                  İleri →
                </button>
              ) : (
                <button className="btn btn-primary btn-lg" onClick={handleSubmit} id="reg-submit">
                  ✅ Kaydı Tamamla
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
