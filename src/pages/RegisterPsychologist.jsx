import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    name: '', email: '', password: '', passwordConfirm: '', phone: '', tcNo: '',
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
                {num === 1 ? 'Kişisel' : num === 2 ? 'Mesleki' : num === 3 ? 'Profil' : 'Sözleşme'}
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
                  <h3>1. Kişisel Bilgiler</h3>
                  <div className="auth-info-box mb-lg">
                    🔒 Bu bilgiler yalnızca doğrulama süreçleri için kullanılacak olup, platform üzerinde tam isminiz görüntülenecektir.
                  </div>
                  
                  <div className="grid grid-2 gap-md mb-md">
                    <div className="input-group">
                      <label>Ad Soyad</label>
                      <input type="text" name="name" className="input" placeholder="Örn: Ayşe Yılmaz" value={formData.name} onChange={handleChange} required />
                    </div>
                    <div className="input-group">
                      <label>TC Kimlik No</label>
                      <input type="text" name="tcNo" className="input" placeholder="Doğrulama için" value={formData.tcNo} onChange={handleChange} required />
                    </div>
                  </div>
                  
                  <div className="grid grid-2 gap-md mb-lg">
                    <div className="input-group">
                      <label>E-posta Adresi</label>
                      <input type="email" name="email" className="input" value={formData.email} onChange={handleChange} required />
                    </div>
                    <div className="input-group">
                      <label>Telefon Numarası</label>
                      <input type="tel" name="phone" className="input" value={formData.phone} onChange={handleChange} required />
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
                      <label>Süpervizör (Danışman) Adı ve İletişimi</label>
                      <input type="text" name="supervisorName" className="input" placeholder="Örn: Prof. Dr. Ahmet Yılmaz - ahmetyilmaz@uni.edu.tr" value={formData.supervisorName} onChange={handleChange} required />
                    </div>
                  )}

                  <div className="input-group mb-md">
                    <label>Belge Yükleme (PDF/JPG)</label>
                    <div className="upload-box" style={{ padding: 'var(--space-xl)', border: '2px dashed var(--border-medium)', borderRadius: 'var(--radius-md)', textAlign: 'center', cursor: 'pointer' }}>
                      <span style={{ fontSize: '2rem' }}>📄</span>
                      <p className="mt-xs">{isCandidate ? 'Öğrenci Belgesi & Süpervizör Onayı' : 'Diploma & E-Devlet Kaydı'}</p>
                      <span className="btn btn-outline btn-sm mt-sm">Dosya Seç</span>
                    </div>
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

              {/* Step 4: Contract & Payment Terms (B2B) */}
              {step === 4 && (
                <div className="register-step-content slide-up">
                  <h3>4. İş Ortaklığı ve Komisyon Sözleşmesi</h3>
                  
                  <div className="contract-box">
                    <div className="contract-text">
                      <p><strong>GİZLİBİRİZ UZMAN/PSİKOLOG HİZMET SÖZLEŞMESİ</strong></p>
                      <p>1. TARAFLAR<br/>Bu sözleşme GizliBiriz Platformu ile sisteme kayıt olan Psikolog arasında akdedilmiştir.</p>
                      <p>2. KOMİSYON VE HAKEDİŞ MODELİ<br/>Platform üzerinden gerçekleşen her başarılı seans için, psikoloğun belirlediği taban seans ücreti üzerinden <strong>%20 Platform Hizmet Bedeli (Komisyon)</strong> kesilir. Kalan %80 tutar (Hakediş), seansın tamamlanmasını takip eden 3 iş günü içerisinde psikoloğun kayıtlı IBAN adresine yatırılır.</p>
                      <p>Örnek Hesaplama:<br/>Seans Ücreti: 1.000 ₺<br/>Platform Kesintisi (%20): 200 ₺<br/><strong>Psikolog Net Hakediş: 800 ₺</strong></p>
                      <p>3. GİZLİLİK VE GÜVENLİK (WebRTC/Blur)<br/>Psikolog, platform üzerinde danışanların bulanıklaştırılmış (blur) veya sesli görüntülerini hiçbir şekilde kaydetmemeyi, ekran görüntüsü almamayı kabul ve taahhüt eder. Gizlilik ihlali durumunda yasal süreç başlatılır.</p>
                    </div>
                  </div>

                  <div className="input-group mb-md">
                    <label className="checkbox-group">
                      <input type="checkbox" required />
                      <span>B2B İş Ortaklığı ve Hakediş Sözleşmesini okudum, kabul ediyorum.</span>
                    </label>
                  </div>
                  <div className="input-group mb-lg">
                    <label className="checkbox-group">
                      <input type="checkbox" required />
                      <span>Danışan Gizliliği (Zero-Knowledge) manifestosuna ve KVKK kurallarına uyacağımı taahhüt ederim.</span>
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
