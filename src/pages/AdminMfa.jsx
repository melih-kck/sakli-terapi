import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import {
  createTotpQrDataUrl,
  getUnverifiedTotpFactors,
  normalizeMfaCode,
} from '../lib/admin-mfa';
import { supabase } from '../lib/supabase';
import '../styles/pages/Auth.css';

export default function AdminMfa() {
  const { mfaStatus, refreshMfaStatus } = useAuth();
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
        friendlyName: 'GizliBiriz Yönetici',
      });
      if (enrollError) throw enrollError;
      setEnrollment(data);
    } catch (enrollError) {
      console.error('Yönetici MFA kurulumu başlatılamadı:', enrollError);
      setError('Doğrulama kurulumu başlatılamadı. Sayfayı yenileyip tekrar deneyin.');
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
      setError('Doğrulama uygulamasındaki 6 haneli kodu girin.');
      return;
    }
    if (!factorId) {
      setError('Doğrulama anahtarı bulunamadı. Kurulumu yeniden başlatın.');
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
      setError('Kod doğrulanamadı. Yeni üretilen kodu kontrol edip tekrar deneyin.');
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
          <span className="admin-mfa-eyebrow">Yönetici Güvenliği</span>
          <h1 id="admin-mfa-title">İkinci doğrulama gerekli</h1>
          <p className="auth-subtitle">
            Yönetim paneline erişmek için doğrulama uygulamanızdaki kodu kullanın.
          </p>
          {(error || mfaStatus.error) && (
            <div className="auth-error admin-mfa-error">{error || mfaStatus.error}</div>
          )}

          {mfaStatus.loading ? (
            <div className="admin-mfa-status">Güvenlik durumu kontrol ediliyor...</div>
          ) : needsEnrollment ? (
            <div className="admin-mfa-enrollment-start">
              <p>Bu yönetici hesabında henüz doğrulama uygulaması kayıtlı değil.</p>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={startEnrollment}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Hazırlanıyor...' : 'Doğrulama Uygulaması Ekle'}
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
                      alt="Yönetici doğrulama uygulaması QR kodu"
                    />
                  )}
                  <details className="admin-mfa-secret">
                    <summary>QR kodu taranamıyorsa</summary>
                    <label htmlFor="admin-mfa-secret">Kurulum anahtarı</label>
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
                  <label htmlFor="admin-mfa-code">6 haneli doğrulama kodu</label>
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
                  {isSubmitting ? 'Doğrulanıyor...' : 'Yönetim Paneline Devam Et'}
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
