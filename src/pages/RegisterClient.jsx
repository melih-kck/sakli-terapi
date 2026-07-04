import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SPECIALIZATIONS } from '../data/constants';
import Navbar from '../components/Navbar';
import '../styles/pages/Auth.css';

export default function RegisterClient() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  const [form, setForm] = useState({
    alias: '', email: '', password: '', passwordConfirm: '',
    feeling: 3, topics: [], style: 'video-blur',
    emergencyName: '', emergencyPhone: '', city: '',
    kvkk: false, terms: false, emergency: false,
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
      case 1: return form.alias && form.email && form.password && form.password === form.passwordConfirm;
      case 2: return form.topics.length > 0;
      case 3: return form.emergencyName && form.emergencyPhone && form.city;
      case 4: return form.kvkk && form.terms && form.emergency;
      case 5: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    const result = await register(form.email, form.password, form, 'client');
    if (result.success) {
      navigate('/giris');
    }
  };

  const blurLabels = ['Açık İletişim', 'Düşük Gizlilik', 'Orta Gizlilik', 'Yüksek Gizlilik', 'Maksimum Gizlilik'];
  const blurValues = [0, 4, 8, 14, 24];
  const cities = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep', 'Mersin', 'Diyarbakır', 'Kayseri', 'Eskişehir', 'Samsun', 'Trabzon', 'Erzurum', 'Diğer'];

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
                    🔒 Gerçek isminiz hiçbir zaman psikologunuzla paylaşılmayacaktır.
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
                        <input type="password" id="reg-password" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="••••••••" />
                      </div>
                      <div className="input-group">
                        <label htmlFor="reg-password2">Şifre Tekrar</label>
                        <input type="password" id="reg-password2" value={form.passwordConfirm} onChange={(e) => update('passwordConfirm', e.target.value)} placeholder="••••••••" />
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
                      <label>Şu an kendinizi nasıl hissediyorsunuz?</label>
                      <div className="mood-select">
                        {[{ v: 1, e: '😢', l: 'Çok Kötü' }, { v: 2, e: '😞', l: 'Kötü' }, { v: 3, e: '😐', l: 'Normal' }, { v: 4, e: '🙂', l: 'İyi' }, { v: 5, e: '😄', l: 'Çok İyi' }].map(m => (
                          <button key={m.v} type="button" className={`mood-btn ${form.feeling === m.v ? 'selected' : ''}`} onClick={() => update('feeling', m.v)} id={`reg-mood-${m.v}`}>
                            <span className="mood-emoji">{m.e}</span><span className="mood-label">{m.l}</span>
                          </button>
                        ))}
                      </div>
                    </div>
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
                          { id: 'text', label: '💬 Metin / Yazışma', desc: 'Gerçek zamanlı şifreli mesajlaşma' }
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
                    ⚠️ Bu bilgiler yalnızca kriz durumunda kullanılacak ve güvenli bir kasada saklanacaktır. Psikologunuz bu bilgilere erişemez.
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
                    <div className="input-group">
                      <label htmlFor="reg-city">Şehir / İl</label>
                      <select id="reg-city" value={form.city} onChange={(e) => update('city', e.target.value)}>
                        <option value="">Seçiniz</option>
                        {cities.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="auth-info-box">
                      ℹ️ Bu bilgilere yalnızca acil durumlarda, platform yönetimi tarafından erişilebilir.
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="register-step-content slide-up">
                  <h3>Sözleşme Onayı</h3>
                  <div className="contract-box">
                    <h4>GizliBiriz Hizmet Sözleşmesi ve Aydınlatma Metni</h4>
                    <div className="contract-text">
                      <p><strong>1. Veri Gizliliği:</strong> GizliBiriz platformu, danışanların kişisel verilerini 6698 sayılı KVKK kapsamında korumaktadır. Gerçek kimlik bilgileriniz yalnızca platform tarafından güvenli ortamda saklanır ve psikologlarla paylaşılmaz.</p>
                      <p><strong>2. Anonimlik:</strong> Seanslarınızda yalnızca seçtiğiniz rumuz ile tanınırsınız. Blur efekti, ses filtresi gibi gizlilik araçları tamamen sizin kontrolünüzdedir.</p>
                      <p><strong>3. Acil Durum Protokolü:</strong> İntihar riski, kendine zarar verme veya başkasına zarar verme durumlarında, platform yönetimi acil durum bilgilerinize erişerek gerekli müdahaleyi koordine etme hakkına sahiptir.</p>
                      <p><strong>4. Sosyal Sorumluluk:</strong> Seans ücretleri, her iki tarafın rızasıyla kız çocuklarına yardım derneğine bağışlanır.</p>
                      <p><strong>5. Veri Saklama:</strong> Seans içerikleri şifreli olarak saklanır. Hesap silme talebinizde tüm verileriniz kalıcı olarak silinir.</p>
                    </div>
                  </div>
                  <div className="auth-form">
                    <label className="checkbox-group">
                      <input type="checkbox" checked={form.kvkk} onChange={(e) => update('kvkk', e.target.checked)} id="reg-kvkk" />
                      KVKK Aydınlatma Metnini okudum ve onaylıyorum
                    </label>
                    <label className="checkbox-group">
                      <input type="checkbox" checked={form.terms} onChange={(e) => update('terms', e.target.checked)} id="reg-terms" />
                      Hizmet Sözleşmesini kabul ediyorum
                    </label>
                    <label className="checkbox-group">
                      <input type="checkbox" checked={form.emergency} onChange={(e) => update('emergency', e.target.checked)} id="reg-emergency-agree" />
                      Acil durum protokolünü anladım ve onaylıyorum
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
                            {level === 5 ? 'Yüz tamamen bulanık' : level === 4 ? 'Yüksek blur' : level === 3 ? 'Orta blur' : level === 2 ? 'Hafif blur' : 'Blur yok'}
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
