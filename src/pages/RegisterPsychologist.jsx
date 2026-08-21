import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { SPECIALIZATIONS } from '../data/constants';
import Navbar from '../components/Navbar';
import { useLanguage } from '../context/LanguageContext';
import '../styles/pages/Auth.css';

// Splits a translated "{{link}}"-templated sentence around an inline <Link>,
// so the link can sit anywhere in the sentence regardless of language word
// order. Uses a control character as a sentinel that can't collide with
// real translated text.
const LINK_MARKER = '\u0000';

export default function RegisterPsychologist() {
  const { register, isLoading } = useAuth();
  const { t } = useLanguage();
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
  const currentYear = new Date().getFullYear();
  const hasPasswordMismatch = Boolean(
    formData.password
    && formData.passwordConfirm
    && formData.password !== formData.passwordConfirm
  );

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
  const handleStepSubmit = (event) => {
    event.preventDefault();
    if (step === 1 && hasPasswordMismatch) return;
    handleNext();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading || formData.password !== formData.passwordConfirm) return;

    const graduationYear = Number(formData.graduationYear);
    const result = await register(formData.email, formData.password, {
      ...formData,
      title: isCandidate ? 'Aday Psikolog' : 'Psikolog',
      experience: Number.isFinite(graduationYear) ? Math.max(currentYear - graduationYear, 0) : 0,
      isCandidate,
      channels: ['video-blur', 'voice', 'text'],
    }, 'psychologist');

    if (result.success) {
      navigate(result.needsEmailConfirmation ? '/e-posta-dogrula' : '/giris', {
        state: result.needsEmailConfirmation ? { email: result.email } : undefined,
      });
    }
  };

  return (
    <div className="page auth-page">
      <Navbar />
      <main className="page-content" style={{ padding: 'var(--space-2xl) 0' }}>
        <div className="container container-md text-center mb-xl">
          <h1>{t('registerPsychologist.pageTitle')}</h1>
          <p className="section-subtitle">{t('registerPsychologist.pageSubtitle')}</p>
        </div>

        {/* Step Indicator */}
        <div className="register-steps">
          {[1, 2, 3, 4].map(num => (
            <div key={num} className="register-step-item">
              <div className={`step-circle ${step >= num ? 'active' : ''}`}>{num}</div>
              <span className={`step-label ${step >= num ? 'active' : ''}`}>
                {num === 1 ? t('registerPsychologist.stepAccount') : num === 2 ? t('registerPsychologist.stepProfessional') : num === 3 ? t('registerPsychologist.stepProfile') : t('registerPsychologist.stepConfirm')}
              </span>
              {num < 4 && <div className={`step-connector ${step > num ? 'active' : ''}`}></div>}
            </div>
          ))}
        </div>

        <div className="register-card card card-elevated">
          <div className="card-body">
            <form onSubmit={step === 4 ? handleSubmit : handleStepSubmit}>
              
              {/* Step 1: Personal Info */}
              {step === 1 && (
                <div className="register-step-content slide-up">
                  <h3>{t('registerPsychologist.step1Title')}</h3>
                  <div className="auth-info-box mb-lg">
                    {t('registerPsychologist.step1InfoBox')}
                  </div>

                  <div className="grid grid-2 gap-md mb-md">
                    <div className="input-group">
                      <label htmlFor="psych-register-name">{t('registerPsychologist.nameLabel')}</label>
                      <input id="psych-register-name" type="text" name="name" className="input" placeholder={t('registerPsychologist.namePlaceholder')} value={formData.name} onChange={handleChange} required />
                    </div>
                    <div className="input-group">
                      <label htmlFor="psych-register-email">{t('registerPsychologist.emailLabel')}</label>
                      <input id="psych-register-email" type="email" name="email" className="input" value={formData.email} onChange={handleChange} autoComplete="email" required />
                    </div>
                  </div>

                  <div className="grid grid-2 gap-md mb-lg">
                    <div className="input-group">
                      <label htmlFor="psych-register-password">{t('registerPsychologist.passwordLabel')}</label>
                      <input id="psych-register-password" type="password" name="password" className="input" value={formData.password} onChange={handleChange} minLength="8" autoComplete="new-password" required />
                    </div>
                    <div className="input-group">
                      <label htmlFor="psych-register-password-confirm">{t('registerPsychologist.passwordConfirmLabel')}</label>
                      <input id="psych-register-password-confirm" type="password" name="passwordConfirm" className="input" value={formData.passwordConfirm} onChange={handleChange} minLength="8" autoComplete="new-password" aria-invalid={hasPasswordMismatch} aria-describedby={hasPasswordMismatch ? 'psych-password-error' : undefined} required />
                      {hasPasswordMismatch && (
                        <span className="input-hint" id="psych-password-error" role="alert" style={{ color: 'var(--danger)' }}>{t('registerPsychologist.passwordMismatch')}</span>
                      )}
                    </div>
                  </div>

                  <div className="input-group mb-lg">
                    <label className="checkbox-group">
                       <input id="psych-register-candidate" type="checkbox" checked={isCandidate} onChange={(e) => setIsCandidate(e.target.checked)} />
                      <span><strong>{t('registerPsychologist.candidateLabel')}</strong><br/><small className="text-tertiary">{t('registerPsychologist.candidateHint')}</small></span>
                    </label>
                  </div>
                </div>
              )}

              {/* Step 2: Professional Info */}
              {step === 2 && (
                <div className="register-step-content slide-up">
                  <h3>{t('registerPsychologist.step2Title')}</h3>

                  <div className="grid grid-2 gap-md mb-md">
                    <div className="input-group">
                      <label htmlFor="psych-register-university">{t('registerPsychologist.universityLabel')}</label>
                      <input id="psych-register-university" type="text" name="university" className="input" value={formData.university} onChange={handleChange} required />
                    </div>
                    <div className="input-group">
                      <label htmlFor="psych-register-graduation-year">{isCandidate ? t('registerPsychologist.graduationExpectedLabel') : t('registerPsychologist.graduationYearLabel')}</label>
                      <input id="psych-register-graduation-year" type="number" name="graduationYear" className="input" value={formData.graduationYear} onChange={handleChange} min={currentYear - 80} max={isCandidate ? currentYear + 10 : currentYear} required />
                    </div>
                  </div>

                  {isCandidate && (
                    <div className="input-group mb-md">
                      <label htmlFor="psych-register-supervisor">{t('registerPsychologist.supervisorLabel')}</label>
                      <input id="psych-register-supervisor" type="text" name="supervisorName" className="input" placeholder={t('registerPsychologist.supervisorPlaceholder')} value={formData.supervisorName} onChange={handleChange} required />
                      <span className="input-hint">{t('registerPsychologist.supervisorHint')}</span>
                    </div>
                  )}

                  <div className="auth-info-box mb-md">
                    {t('registerPsychologist.step2InfoBox')}
                  </div>
                </div>
              )}

              {/* Step 3: Profile Setup */}
              {step === 3 && (
                <div className="register-step-content slide-up">
                  <h3>{t('registerPsychologist.step3Title')}</h3>

                  <div className="input-group mb-md">
                    <span className="input-group-label" id="psych-register-specializations">{t('registerPsychologist.specializationsLabel')}</span>
                    <div className="topic-grid" role="group" aria-labelledby="psych-register-specializations">
                      {SPECIALIZATIONS.map(spec => (
                        <button
                          key={spec.id} 
                          type="button"
                          className={`btn btn-sm ${formData.specializations.includes(spec.id) ? 'btn-primary' : 'btn-outline'}`}
                          aria-pressed={formData.specializations.includes(spec.id)}
                          onClick={() => handleSpecToggle(spec.id)}
                          disabled={!formData.specializations.includes(spec.id) && formData.specializations.length >= 3}
                        >
                          {spec.icon} {t(`specializations.${spec.id}`) || spec.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="input-group mb-md">
                    <label htmlFor="psych-register-bio">{t('registerPsychologist.bioLabel')}</label>
                    <textarea
                      id="psych-register-bio"
                      name="shortBio"
                      className="input"
                      rows="3"
                      placeholder={t('registerPsychologist.bioPlaceholder')}
                      value={formData.shortBio}
                      onChange={handleChange}
                      maxLength="600"
                      required
                    ></textarea>
                  </div>

                  <div className="input-group mb-lg">
                    <label htmlFor="psych-register-price">{t('registerPsychologist.priceLabel')}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      <input id="psych-register-price" type="number" name="basePrice" className="input" style={{ width: '150px' }} value={formData.basePrice} onChange={handleChange} min="500" required />
                      <span className="text-tertiary text-sm">{t('registerPsychologist.priceHint')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Application confirmation */}
              {step === 4 && (() => {
                const [termsBefore, termsAfter] = t('registerPsychologist.termsCheckboxText', { link: LINK_MARKER }).split(LINK_MARKER);
                const [privacyBefore, privacyAfter] = t('registerPsychologist.privacyCheckboxText', { link: LINK_MARKER }).split(LINK_MARKER);
                return (
                <div className="register-step-content slide-up">
                  <h3>{t('registerPsychologist.step4Title')}</h3>

                  <div className="contract-box">
                    <div className="contract-text">
                      <p><strong>{t('registerPsychologist.declarationTitle')}</strong></p>
                      <p>{t('registerPsychologist.declarationItem1')}</p>
                      <p>{t('registerPsychologist.declarationItem2')}</p>
                      <p>{t('registerPsychologist.declarationItem3')}</p>
                    </div>
                  </div>

                  <div className="input-group mb-md">
                    <label className="checkbox-group">
                      <input type="checkbox" required />
                      <span>{termsBefore}<Link to="/kullanim-kosullari">{t('registerPsychologist.termsLinkLabel')}</Link>{termsAfter}</span>
                    </label>
                  </div>
                  <div className="input-group mb-lg">
                    <label className="checkbox-group">
                      <input type="checkbox" required />
                      <span>{privacyBefore}<Link to="/gizlilik-politikasi">{t('registerPsychologist.privacyLinkLabel')}</Link>{privacyAfter}</span>
                    </label>
                  </div>
                </div>
                );
              })()}

              {/* Navigation */}
              <div className="register-nav">
                {step > 1 ? (
                  <button type="button" className="btn btn-outline" onClick={handlePrev}>{t('registerPsychologist.backButton')}</button>
                ) : <div></div>}

                {step < 4 ? (
                  <button type="submit" className="btn btn-primary" disabled={isLoading || (step === 1 && hasPasswordMismatch)}>{t('registerPsychologist.nextButton')}</button>
                ) : (
                  <button type="submit" className="btn btn-primary" disabled={isLoading}>
                    {isLoading ? t('registerPsychologist.submitting') : t('registerPsychologist.submitButton')}
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
