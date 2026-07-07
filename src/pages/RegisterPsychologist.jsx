import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SPECIALIZATIONS } from '../data/constants';
import Navbar from '../components/Navbar';
import '../styles/pages/Auth.css';

export default function RegisterPsychologist() {
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [isCandidate, setIsCandidate] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', passwordConfirm: '',
    university: '', graduationYear: '',
    supervisorName: '',
    specializations: [], approaches: [],
    shortBio: '', basePrice: '1000'
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  
  const handleSpecToggle = (id) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.includes(id) 
        ? prev.specializations.filter(s => s !== id)
        : prev.specializations.length >= 3
          ? prev.specializations
          : [...prev.specializations, id]
    }));
  };

  const handleNext = () => setStep(prev => prev + 1);
  const handlePrev = () => setStep(prev => prev - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.passwordConfirm) return;

    const graduationYear = Number(formData.graduationYear);
    const currentYear = new Date().getFullYear();
    const result = await register(formData.email, formData.password, {
      ...formData,
      title: isCandidate ? 'Aday Psikolog' : 'Psikolog',
      experience: Number.isFinite(graduationYear) ? Math.max(currentYear - graduationYear, 0) : 0,
      isCandidate,
      channels: ['video-blur', 'voice', 'text'],
    }, 'psychologist');

    if (result.success) {
      navigate('/giris');
    }
  };

  return (
    <div className="page auth-page">
      <Navbar />
      <main className="page-content" style={{ padding: 'var(--space-2xl) 0' }}>
        
        {/* Step Indicator */}
        <div className="register-steps">
          {[1, 2, 3, 4].map(num => (
            <div key={num} className="register-step-item">
              <div className={`step-circle ${step >= num ? 'active' : ''}`}>{num}</div>
              <span className={`step-label ${step >= num ? 'active' : ''}`}>
                {num === 1 ? 'Hesap' : num === 2 ? 'Mesleki' : num === 3 ? 'Profil' : 'Onay'}
              </span>
              {num < 4 && <div className={`step-connector ${step > num ? 'active' : ''}`}></div>}
            </div>
          ))}
        </div>

        <div className="register-card card card-elevated">
          <div className="card-body">
            <form onSubmit={step === 4 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
              
              {/* Step 1: Personal Info */}
              {step === 1 && (
                <div className="register-step-content slide-up">
                  <h3>1. Hesap Bilgileri</h3>
                  <div className="auth-info-box mb-lg">
                    Profil adınız yalnızca başvurunuz onaylandıktan sonra katalogda görünür.
                  </div>

                  <div className="grid grid-2 gap-md mb-md">
                    <div className="input-group">
                      <label>Ad Soyad</label>
                      <input type="text" name="name" className="input" placeholder="Örn: Ayşe Yılmaz" value={formData.name} onChange={handleChange} required />
                    </div>
                    <div className="input-group">
                      <label>E-posta Adresi</label>
                      <input type="email" name="email" className="input" value={formData.email} onChange={handleChange} required />
                    </div>
                  </div>

                  <div className="grid grid-2 gap-md mb-lg">
                    <div className="input-group">
                      <label>Şifre</label>
                      <input type="password" name="password" className="input" value={formData.password} onChange={handleChange} minLength="8" required />
                    </div>
                    <div className="input-group">
                      <label>Şifre Tekrar</label>
                      <input type="password" name="passwordConfirm" className="input" value={formData.passwordConfirm} onChange={handleChange} minLength="8" required />
                      {formData.password && formData.passwordConfirm && formData.password !== formData.passwordConfirm && (
                        <span className="input-hint" style={{ color: 'var(--danger)' }}>Şifreler eşleşmiyor.</span>
                      )}
                    </div>
                  </div>

                  <div className="input-group mb-lg">
                    <label className="checkbox-group">
                      <input type="checkbox" checked={isCandidate} onChange={(e) => setIsCandidate(e.target.checked)} />
                      <span><strong>Aday Psikologum (Son Sınıf)</strong><br/><small className="text-tertiary">Süpervizör eşliğinde stajyer olarak seans vermek istiyorum.</small></span>
                    </label>
                  </div>
                </div>
              )}

              {/* Step 2: Professional Info */}
              {step === 2 && (
                <div className="register-step-content slide-up">
                  <h3>2. Mesleki Yeterlilik</h3>
                  
                  <div className="grid grid-2 gap-md mb-md">
                    <div className="input-group">
                      <label>Üniversite</label>
                      <input type="text" name="university" className="input" value={formData.university} onChange={handleChange} required />
                    </div>
                    <div className="input-group">
                      <label>{isCandidate ? 'Beklenen Mezuniyet' : 'Mezuniyet Yılı'}</label>
                      <input type="number" name="graduationYear" className="input" value={formData.graduationYear} onChange={handleChange} required />
                    </div>
                  </div>

                  {isCandidate && (
                    <div className="input-group mb-md">
                      <label>Süpervizör (Danışman) Adı</label>
                      <input type="text" name="supervisorName" className="input" placeholder="Örn: Prof. Dr. Ayşe Yılmaz" value={formData.supervisorName} onChange={handleChange} required />
                      <span className="input-hint">Bu alan yönetici incelemesi içindir ve herkese açık profilde gösterilmez.</span>
                    </div>
                  )}

                  <div className="auth-info-box mb-md">
                    Başvurunuz yönetici incelemesine alınır. Gerekli mesleki belgeler,
                    herkese açık formda toplanmak yerine kayıtlı e-posta adresiniz üzerinden istenir.
                  </div>
                </div>
              )}

              {/* Step 3: Profile Setup */}
              {step === 3 && (
                <div className="register-step-content slide-up">
                  <h3>3. Uzmanlık ve Profil</h3>
                  
                  <div className="input-group mb-md">
                    <label>Uzmanlık Alanları (En fazla 3 adet)</label>
                    <div className="topic-grid">
                      {SPECIALIZATIONS.map(spec => (
                        <button
                          key={spec.id} 
                          type="button"
                          className={`btn btn-sm ${formData.specializations.includes(spec.id) ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => handleSpecToggle(spec.id)}
                          disabled={!formData.specializations.includes(spec.id) && formData.specializations.length >= 3}
                        >
                          {spec.icon} {spec.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="input-group mb-md">
                    <label>Kısa Biyografi (Profilde Görüntülenecek)</label>
                    <textarea 
                      name="shortBio" 
                      className="input" 
                      rows="3" 
                      placeholder="Danışanların sizi daha iyi tanıması için 1-2 cümlelik özet..."
                      value={formData.shortBio}
                      onChange={handleChange}
                      required
                    ></textarea>
                  </div>

                  <div className="input-group mb-lg">
                    <label>Taban Seans Ücreti (TL)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      <input type="number" name="basePrice" className="input" style={{ width: '150px' }} value={formData.basePrice} onChange={handleChange} min="500" required />
                      <span className="text-tertiary text-sm">₺ / Seans (Kendi ücretinizi belirleyebilirsiniz)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Application confirmation */}
              {step === 4 && (
                <div className="register-step-content slide-up">
                  <h3>4. Başvuru Onayı</h3>

                  <div className="contract-box">
                    <div className="contract-text">
                      <p><strong>PSİKOLOG BAŞVURU BEYANI</strong></p>
                      <p>Başvuruda verdiğim mesleki bilgilerin doğru olduğunu ve gerektiğinde doğrulayıcı belge sunacağımı beyan ederim.</p>
                      <p>Danışan mahremiyetini koruyacağımı; görüşme içeriğini, görüntüsünü veya sesini izinsiz kaydetmeyeceğimi kabul ederim.</p>
                      <p>Ödeme ve komisyon altyapısının henüz etkin olmadığını; finansal koşullar devreye alınmadan önce ayrıca bilgilendirileceğimi kabul ederim.</p>
                    </div>
                  </div>

                  <div className="input-group mb-md">
                    <label className="checkbox-group">
                      <input type="checkbox" required />
                      <span><Link to="/kullanim-kosullari">Kullanım Koşullarını</Link> okudum, kabul ediyorum.</span>
                    </label>
                  </div>
                  <div className="input-group mb-lg">
                    <label className="checkbox-group">
                      <input type="checkbox" required />
                      <span><Link to="/gizlilik-politikasi">Gizlilik Politikasını</Link> okudum ve danışan mahremiyetine uyacağımı taahhüt ederim.</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="register-nav">
                {step > 1 ? (
                  <button type="button" className="btn btn-outline" onClick={handlePrev}>Geri</button>
                ) : <div></div>}
                
                {step < 4 ? (
                  <button type="submit" className="btn btn-primary" disabled={isLoading}>İleri</button>
                ) : (
                  <button type="submit" className="btn btn-primary" disabled={isLoading}>
                    {isLoading ? 'Başvuru gönderiliyor...' : 'Başvuruyu Tamamla'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
