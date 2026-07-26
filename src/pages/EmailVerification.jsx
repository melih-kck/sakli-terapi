import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { maskEmail } from '../lib/auth';
import { supabase } from '../lib/supabase';
import '../styles/pages/SupportPages.css';

function VerificationShell({ title, subtitle, children }) {
  return (
    <div className="page">
      <Navbar />
      <main className="content-page-main">
        <section className="content-hero">
          <div className="container">
            <span className="content-eyebrow">Hesap Güvenliği</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </section>
        <div className="container content-layout content-layout-single">
          <div className="content-primary">{children}</div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function EmailVerificationPage() {
  const location = useLocation();
  const { resendVerification } = useAuth();
  const [email, setEmail] = useState(location.state?.email || '');
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown(current => Math.max(current - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleResend = async (event) => {
    event.preventDefault();
    if (!email.trim() || cooldown > 0) return;

    setIsSending(true);
    const result = await resendVerification(email);
    if (result.success) {
      setEmail(result.email);
      setCooldown(60);
    }
    setIsSending(false);
  };

  return (
    <VerificationShell
      title="E-postanızı Doğrulayın"
      subtitle="Hesabınızı etkinleştirmek için size gönderdiğimiz güvenli bağlantıyı açın."
    >
      <form className="content-form-panel" onSubmit={handleResend}>
        <div className="content-success-box">
          <h2>Doğrulama bağlantısı gönderildi</h2>
          <p>
            {email
              ? `${maskEmail(email)} adresinin gelen kutusunu ve spam klasörünü kontrol edin.`
              : 'Kayıtta kullandığınız e-posta adresinin gelen kutusunu ve spam klasörünü kontrol edin.'}
          </p>
        </div>

        <div className="input-group">
          <label htmlFor="verification-email">E-posta adresi</label>
          <input
            id="verification-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ornek@email.com"
            autoComplete="email"
            required
          />
          <span className="input-hint">Bağlantı gelmediyse aynı adrese yeniden gönderebilirsiniz.</span>
        </div>

        <div className="content-actions">
          <Link className="btn btn-ghost" to="/giris">Giriş Sayfasına Dön</Link>
          <button className="btn btn-primary" type="submit" disabled={isSending || cooldown > 0}>
            {isSending ? 'Gönderiliyor...' : cooldown > 0 ? `${cooldown} sn sonra yeniden gönder` : 'Bağlantıyı Yeniden Gönder'}
          </button>
        </div>
      </form>
    </VerificationShell>
  );
}

export function EmailConfirmationPage() {
  const { user, isLoading } = useAuth();
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Doğrulama bağlantınız kontrol ediliyor.');

  useEffect(() => {
    let isMounted = true;
    let timeout;
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const authError = searchParams.get('error_description') || hashParams.get('error_description');

    const markSuccess = () => {
      if (!isMounted) return;
      setStatus('success');
      setMessage('E-posta adresiniz doğrulandı. Hesabınız kullanıma hazır.');
    };

    const verifySession = async () => {
      if (authError) {
        if (isMounted) {
          setStatus('error');
          setMessage('Doğrulama bağlantısı geçersiz veya süresi dolmuş olabilir.');
        }
        return;
      }

      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (isMounted) {
            setStatus('error');
            setMessage('Doğrulama bağlantısı kullanılamadı. Yeni bir bağlantı isteyin.');
          }
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.email_confirmed_at) markSuccess();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user?.email_confirmed_at) {
        markSuccess();
      }
    });

    verifySession();
    timeout = window.setTimeout(() => {
      if (isMounted) {
        setStatus(current => {
          if (current !== 'checking') return current;
          setMessage('Doğrulama tamamlanamadı. Bağlantının süresi dolmuş olabilir.');
          return 'error';
        });
      }
    }, 6000);

    return () => {
      isMounted = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const dashboardPath = user?.role === 'admin'
    ? '/admin'
    : user?.role === 'psychologist'
      ? '/psikolog-panel'
      : '/panel';

  return (
    <VerificationShell
      title={status === 'success' ? 'E-posta Doğrulandı' : 'E-posta Doğrulama'}
      subtitle={message}
    >
      <div className="content-form-panel">
        {status === 'checking' && (
          <div className="content-empty-box">
            <h3>Bağlantı kontrol ediliyor</h3>
            <p>Bu işlem yalnızca birkaç saniye sürer.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="content-success-box">
            <h2>Hesabınız hazır</h2>
            <p>E-posta adresiniz başarıyla doğrulandı.</p>
            <Link className="btn btn-primary" to={user && !isLoading ? dashboardPath : '/giris'}>
              {user && !isLoading ? 'Panele Devam Et' : 'Giriş Yap'}
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="content-empty-box">
            <h3>Bağlantı doğrulanamadı</h3>
            <p>{message}</p>
            <Link className="btn btn-primary" to="/e-posta-dogrula">Yeni Bağlantı İste</Link>
          </div>
        )}
      </div>
    </VerificationShell>
  );
}
