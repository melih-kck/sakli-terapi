import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { SPECIALIZATIONS } from '../data/constants';
import Navbar from '../components/Navbar';
import { BRAND } from '../config/brand';
import { useLanguage } from '../context/LanguageContext';
import '../styles/pages/Auth.css';

// Splits a translated "{{link}}"-templated sentence around an inline <Link>,
// so the link can sit anywhere in the sentence regardless of language word order.
const LINK_MARKER = '\u0000';

export default function RegisterClient() {
  const { register, isLoading } = useAuth();
  const { t } = useLanguage();
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
    if (isLoading || !canProceed()) return;
    const result = await register(form.email, form.password, form, 'client');
    if (result.success) {
      navigate(result.needsEmailConfirmation ? '/e-posta-dogrula' : '/giris', {
        state: result.needsEmailConfirmation ? { email: result.email } : undefined,
      });
    }
  };

  const blurLabels = t('registerClient.blurLabels');
  const blurValues = [8, 12, 16, 22, 28];

  return (
    <div className="page">
      <Navbar />
      <main className="page-content">
        <div className="container container-md" style={{ padding: 'var(--space-2xl) var(--space-lg)' }}>
          <div className="text-center mb-xl">
            <h1>{t('registerClient.pageTitle')}</h1>
            <p style={{ color: 'var(--text-secondary)' }}>{t('registerClient.pageSubtitle')}</p>
          </div>

          {/* Steps Indicator */}
          <div className="register-steps">
            {t('registerClient.steps').map((label, i) => (
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
                  <h3>{t('registerClient.step1Title')}</h3>
                  <div className="auth-info-box">
                    {t('registerClient.step1InfoBox')}
                  </div>
                  <div className="auth-form">
                    <div className="input-group">
                      <label htmlFor="reg-alias">{t('registerClient.aliasLabel')}</label>
                      <input type="text" id="reg-alias" value={form.alias} onChange={(e) => update('alias', e.target.value)} placeholder={t('registerClient.aliasPlaceholder')} />
                      <span className="input-hint">{t('registerClient.aliasHint')}</span>
                    </div>
                    <div className="input-group">
                      <label htmlFor="reg-email">{t('registerClient.emailLabel')}</label>
                      <input type="email" id="reg-email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder={t('registerClient.emailPlaceholder')} />
                    </div>
                    <div className="grid grid-2 gap-md">
                      <div className="input-group">
                        <label htmlFor="reg-password">{t('registerClient.passwordLabel')}</label>
                        <input type="password" id="reg-password" value={form.password} onChange={(e) => update('password', e.target.value)} minLength="8" placeholder={t('registerClient.passwordPlaceholder')} />
                      </div>
                      <div className="input-group">
                        <label htmlFor="reg-password2">{t('registerClient.passwordConfirmLabel')}</label>
                        <input type="password" id="reg-password2" value={form.passwordConfirm} onChange={(e) => update('passwordConfirm', e.target.value)} minLength="8" placeholder={t('registerClient.passwordConfirmPlaceholder')} />
                      </div>
                    </div>
                    {form.password && form.passwordConfirm && form.password !== form.passwordConfirm && (
                      <p style={{ color: 'var(--danger)', fontSize: 'var(--text-xs)' }}>{t('registerClient.passwordMismatch')}</p>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="register-step-content slide-up">
                  <h3>{t('registerClient.step2Title')}</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    {t('registerClient.step2Subtitle')}
                  </p>
                  <div className="auth-form">
                    <div className="input-group">
                      <span className="input-group-label" id="reg-topics-label">{t('registerClient.topicsLabel')}</span>
                      <div className="topic-grid" role="group" aria-labelledby="reg-topics-label">
                        {SPECIALIZATIONS.map(spec => (
                          <button key={spec.id} type="button" className={`tag ${form.topics.includes(spec.id) ? 'active' : ''}`} aria-pressed={form.topics.includes(spec.id)} onClick={() => toggleTopic(spec.id)} id={`reg-topic-${spec.id}`}>
                            {spec.icon} {t(`specializations.${spec.id}`) || spec.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="input-group">
                      <span className="input-group-label" id="reg-style-label">{t('registerClient.styleLabel')}</span>
                      <div className="style-options" role="radiogroup" aria-labelledby="reg-style-label">
                        {[
                          { id: 'video-blur', label: t('registerClient.styleVideoLabel'), desc: t('registerClient.styleVideoDesc') },
                          { id: 'voice', label: t('registerClient.styleVoiceLabel'), desc: t('registerClient.styleVoiceDesc') },
                          { id: 'text', label: t('registerClient.styleTextLabel'), desc: t('registerClient.styleTextDesc') }
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
                  <h3>{t('registerClient.step3Title')}</h3>
                  <div className="auth-warning-box">
                    {t('registerClient.step3WarningBox', { brand: BRAND.name })}
                  </div>
                  <div className="auth-form">
                    <div className="input-group">
                      <label htmlFor="reg-emergency-name">{t('registerClient.emergencyNameLabel')}</label>
                      <input type="text" id="reg-emergency-name" value={form.emergencyName} onChange={(e) => update('emergencyName', e.target.value)} placeholder={t('registerClient.emergencyNamePlaceholder')} />
                    </div>
                    <div className="input-group">
                      <label htmlFor="reg-emergency-phone">{t('registerClient.emergencyPhoneLabel')}</label>
                      <input type="tel" id="reg-emergency-phone" value={form.emergencyPhone} onChange={(e) => update('emergencyPhone', e.target.value)} placeholder={t('registerClient.emergencyPhonePlaceholder')} />
                    </div>
                    <div className="auth-info-box">
                      {t('registerClient.step3InfoBox')}
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (() => {
                const [privacyBefore, privacyAfter] = t('registerClient.privacyCheckboxText', { link: LINK_MARKER }).split(LINK_MARKER);
                const [termsBefore, termsAfter] = t('registerClient.termsCheckboxText', { link: LINK_MARKER }).split(LINK_MARKER);
                return (
                <div className="register-step-content slide-up">
                  <h3>{t('registerClient.step4Title')}</h3>
                  <div className="contract-box">
                    <h4>{t('registerClient.contractTitle', { brand: BRAND.name })}</h4>
                    <div className="contract-text">
                      <p><strong>{t('registerClient.contractItem1Label')}</strong> {t('registerClient.contractItem1Text')}</p>
                      <p><strong>{t('registerClient.contractItem2Label')}</strong> {t('registerClient.contractItem2Text')}</p>
                      <p><strong>{t('registerClient.contractItem3Label')}</strong> {t('registerClient.contractItem3Text')}</p>
                      <p><strong>{t('registerClient.contractItem4Label')}</strong> {t('registerClient.contractItem4Text')}</p>
                      <p><strong>{t('registerClient.contractItem5Label')}</strong> {t('registerClient.contractItem5Text')}</p>
                    </div>
                  </div>
                  <div className="auth-form">
                    <label className="checkbox-group">
                      <input type="checkbox" checked={form.privacy} onChange={(e) => update('privacy', e.target.checked)} id="reg-privacy-policy" />
                      <span>{privacyBefore}<Link to="/gizlilik-politikasi">{t('registerClient.privacyPolicyLinkLabel')}</Link>{privacyAfter}</span>
                    </label>
                    <label className="checkbox-group">
                      <input type="checkbox" checked={form.terms} onChange={(e) => update('terms', e.target.checked)} id="reg-terms" />
                      <span>{termsBefore}<Link to="/kullanim-kosullari">{t('registerClient.termsLinkLabel')}</Link>{termsAfter}</span>
                    </label>
                  </div>
                </div>
                );
              })()}

              {step === 5 && (
                <div className="register-step-content slide-up">
                  <h3>{t('registerClient.step5Title')}</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    {t('registerClient.step5Subtitle')}
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
                          type="button"
                          className={`privacy-level-btn ${form.privacyLevel === level ? 'active' : ''}`}
                          aria-pressed={form.privacyLevel === level}
                          onClick={() => update('privacyLevel', level)}
                          id={`reg-privacy-${level}`}
                        >
                          <span className="privacy-level-num">{level}</span>
                          <span className="privacy-level-name">{blurLabels[level - 1]}</span>
                          <span className="privacy-level-desc">
                            {blurLabels[level - 1]} {t('registerClient.blurUnitWord')}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="auth-info-box">
                    {t('registerClient.privacyInfoBox')}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="card-footer register-nav">
              {step > 1 ? (
                <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)} id="reg-back">{t('registerClient.backButton')}</button>
              ) : (
                <Link to="/kayit" className="btn btn-ghost">{t('registerClient.backButton')}</Link>
              )}
              {step < totalSteps ? (
                <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)} disabled={!canProceed()} id="reg-next">
                  {t('registerClient.nextButton')}
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={isLoading} id="reg-submit">
                  {isLoading ? t('registerClient.submitting') : t('registerClient.submitButton')}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
