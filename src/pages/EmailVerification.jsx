import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { maskEmail } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import '../styles/pages/SupportPages.css';

function VerificationShell({ title, subtitle, children }) {
  const { t } = useLanguage();
  return (
    <div className="page">
      <Navbar />
      <main className="content-page-main">
        <section className="content-hero">
          <div className="container">
            <span className="content-eyebrow">{t('emailVerification.accountSecurityEyebrow')}</span>
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
  const { t } = useLanguage();
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
      title={t('emailVerification.title')}
      subtitle={t('emailVerification.subtitle')}
    >
      <form className="content-form-panel" onSubmit={handleResend}>
        <div className="content-success-box">
          <h2>{t('emailVerification.linkSentTitle')}</h2>
          <p>
            {email
              ? t('emailVerification.checkInboxWithEmail', { email: maskEmail(email) })
              : t('emailVerification.checkInboxGeneric')}
          </p>
        </div>

        <div className="input-group">
          <label htmlFor="verification-email">{t('emailVerification.emailLabel')}</label>
          <input
            id="verification-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t('emailVerification.emailPlaceholder')}
            autoComplete="email"
            required
          />
          <span className="input-hint">{t('emailVerification.resendHint')}</span>
        </div>

        <div className="content-actions">
          <Link className="btn btn-ghost" to="/giris">{t('emailVerification.backToLogin')}</Link>
          <button className="btn btn-primary" type="submit" disabled={isSending || cooldown > 0}>
            {isSending ? t('emailVerification.sending') : cooldown > 0 ? t('emailVerification.resendCooldown', { seconds: cooldown }) : t('emailVerification.resendButton')}
          </button>
        </div>
      </form>
    </VerificationShell>
  );
}

export function EmailConfirmationPage() {
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState(() => t('emailVerification.checkingMessage'));

  useEffect(() => {
    let isMounted = true;
    let timeout;
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const authError = searchParams.get('error_description') || hashParams.get('error_description');

    const markSuccess = () => {
      if (!isMounted) return;
      setStatus('success');
      setMessage(t('emailVerification.successMessage'));
    };

    const verifySession = async () => {
      if (authError) {
        if (isMounted) {
          setStatus('error');
          setMessage(t('emailVerification.invalidLinkMessage'));
        }
        return;
      }

      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (isMounted) {
            setStatus('error');
            setMessage(t('emailVerification.codeExchangeFailedMessage'));
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
          setMessage(t('emailVerification.timeoutMessage'));
          return 'error';
        });
      }
    }, 6000);

    return () => {
      isMounted = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [t]);

  const dashboardPath = user?.role === 'admin'
    ? '/admin'
    : user?.role === 'psychologist'
      ? '/psikolog-panel'
      : '/panel';

  return (
    <VerificationShell
      title={status === 'success' ? t('emailVerification.successTitle') : t('emailVerification.confirmationTitle')}
      subtitle={message}
    >
      <div className="content-form-panel">
        {status === 'checking' && (
          <div className="content-empty-box">
            <h3>{t('emailVerification.checkingTitle')}</h3>
            <p>{t('emailVerification.checkingBody')}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="content-success-box">
            <h2>{t('emailVerification.readyTitle')}</h2>
            <p>{t('emailVerification.readyBody')}</p>
            <Link className="btn btn-primary" to={user && !isLoading ? dashboardPath : '/giris'}>
              {user && !isLoading ? t('emailVerification.continueToDashboard') : t('emailVerification.loginButton')}
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="content-empty-box">
            <h3>{t('emailVerification.errorTitle')}</h3>
            <p>{message}</p>
            <Link className="btn btn-primary" to="/e-posta-dogrula">{t('emailVerification.requestNewLink')}</Link>
          </div>
        )}
      </div>
    </VerificationShell>
  );
}
