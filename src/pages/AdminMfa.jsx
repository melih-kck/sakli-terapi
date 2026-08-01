import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  createTotpQrDataUrl,
  getUnverifiedTotpFactors,
  normalizeMfaCode,
} from '../lib/admin-mfa';
import { supabase } from '../lib/supabase';
import { BRAND } from '../config/brand';
import '../styles/pages/Auth.css';

export default function AdminMfa() {
  const { mfaStatus, refreshMfaStatus } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!mfaStatus.loading && mfaStatus.verified) {
      navigate('/admin', { replace: true });
    }
  }, [mfaStatus.loading, mfaStatus.verified, navigate]);

  const startEnrollment = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const factorsResult = await supabase.auth.mfa.listFactors();
      if (factorsResult.error) throw factorsResult.error;
      for (const factor of getUnverifiedTotpFactors(factorsResult.data)) {
        const { error: cleanupError } = await supabase.auth.mfa.unenroll({
          factorId: factor.id,
        });
        if (cleanupError) throw cleanupError;
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: t('adminMfa.friendlyName', { brand: BRAND.name }),
      });
      if (enrollError) throw enrollError;
      setEnrollment(data);
    } catch (enrollError) {
      console.error('Yönetici MFA kurulumu başlatılamadı:', enrollError);
      setError(t('adminMfa.setupFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    setError('');
    const normalizedCode = normalizeMfaCode(code);
    const factorId = enrollment?.id || mfaStatus.factorId;

    if (!normalizedCode) {
      setError(t('adminMfa.codeRequired'));
      return;
    }
    if (!factorId) {
      setError(t('adminMfa.factorMissing'));
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: normalizedCode,
      });
      if (verifyError) throw verifyError;

      await supabase.auth.refreshSession();
      const nextStatus = await refreshMfaStatus('admin');
      if (!nextStatus.verified) {
        throw new Error('AAL2 session could not be confirmed');
      }
      navigate('/admin', { replace: true });
    } catch (verifyError) {
      console.error('Yönetici MFA doğrulaması başarısız:', verifyError);
      setError(t('adminMfa.verificationFailed'));
      setCode('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const qrCodeUrl = createTotpQrDataUrl(enrollment?.totp?.qr_code);
  const needsEnrollment = !mfaStatus.loading && !mfaStatus.enrolled && !enrollment;

  return (
    <div className="page admin-mfa-page">
      <Navbar />
      <main className="admin-mfa-main">
        <section className="admin-mfa-panel" aria-labelledby="admin-mfa-title">
          <span className="admin-mfa-eyebrow">{t('adminMfa.eyebrow')}</span>
          <h1 id="admin-mfa-title">{t('adminMfa.title')}</h1>
          <p className="auth-subtitle">
            {t('adminMfa.subtitle')}
          </p>
          {(error || mfaStatus.error) && (
            <div className="auth-error admin-mfa-error">{error || mfaStatus.error}</div>
          )}

          {mfaStatus.loading ? (
            <div className="admin-mfa-status">{t('adminMfa.checking')}</div>
          ) : needsEnrollment ? (
            <div className="admin-mfa-enrollment-start">
              <p>{t('adminMfa.enrollmentIntro')}</p>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={startEnrollment}
                disabled={isSubmitting}
              >
                {isSubmitting ? t('adminMfa.preparing') : t('adminMfa.addApp')}
              </button>
            </div>
          ) : (
            <>
              {enrollment && (
                <div className="admin-mfa-qr-section">
                  {qrCodeUrl && (
                    <img
                      className="admin-mfa-qr"
                      src={qrCodeUrl}
                      alt={t('adminMfa.qrAlt')}
                    />
                  )}
                  <details className="admin-mfa-secret">
                    <summary>{t('adminMfa.qrHelp')}</summary>
                    <label htmlFor="admin-mfa-secret">{t('adminMfa.secretLabel')}</label>
                    <input
                      id="admin-mfa-secret"
                      type="text"
                      readOnly
                      value={enrollment.totp?.secret || ''}
                      onFocus={event => event.target.select()}
                    />
                  </details>
                </div>
              )}

              <form className="auth-form admin-mfa-form" onSubmit={verifyCode}>
                <div className="input-group">
                  <label htmlFor="admin-mfa-code">{t('adminMfa.codeLabel')}</label>
                  <input
                    id="admin-mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength="6"
                    value={code}
                    onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-block btn-lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t('adminMfa.verifying') : t('adminMfa.continue')}
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
