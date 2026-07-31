import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router';
import { useAuth } from './context/AuthContext';
import DemoNotice from './components/DemoNotice';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AccessibilityNavigation from './components/AccessibilityNavigation';
import { FEATURES, IS_DEMO_MODE } from './config/runtime';
import { useLanguage } from './context/LanguageContext';

// Pages imported using React.lazy for performance
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const RegisterChoice = lazy(() => import('./pages/RegisterChoice'));
const RegisterClient = lazy(() => import('./pages/RegisterClient'));
const RegisterPsychologist = lazy(() => import('./pages/RegisterPsychologist'));
const PsychologistList = lazy(() => import('./pages/PsychologistList'));
const PsychologistProfile = lazy(() => import('./pages/PsychologistProfile'));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const PsychDashboard = lazy(() => import('./pages/PsychDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminMfa = lazy(() => import('./pages/AdminMfa'));
const SessionRoom = lazy(() => import('./pages/SessionRoom'));
const About = lazy(() => import('./pages/About'));
const Settings = lazy(() => import('./pages/Settings'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const DemoRestricted = lazy(() => import('./pages/DemoRestricted'));
const lazyNamed = (loader, exportName) => lazy(() => loader().then(module => ({ default: module[exportName] })));
const EmailVerificationPage = lazy(() => import('./pages/EmailVerification'));
const EmailConfirmationPage = lazyNamed(() => import('./pages/EmailVerification'), 'EmailConfirmationPage');
const FaqPage = lazyNamed(() => import('./pages/SupportPages'), 'FaqPage');
const ForgotPasswordPage = lazyNamed(() => import('./pages/SupportPages'), 'ForgotPasswordPage');
const PrivacyPolicyPage = lazyNamed(() => import('./pages/SupportPages'), 'PrivacyPolicyPage');
const ResetPasswordPage = lazyNamed(() => import('./pages/SupportPages'), 'ResetPasswordPage');
const ReviewPage = lazyNamed(() => import('./pages/SupportPages'), 'ReviewPage');
const ReviewsPage = lazyNamed(() => import('./pages/SupportPages'), 'ReviewsPage');
const TermsPage = lazyNamed(() => import('./pages/SupportPages'), 'TermsPage');

const NotFound = () => {
  const { t } = useLanguage();
  return (
    <div className="page not-found-page">
      <Navbar />
      <main className="page-content not-found-main">
        <section className="not-found-content">
          <span className="not-found-code" aria-hidden="true">404</span>
          <h1>{t('app.notFoundTitle')}</h1>
          <p>{t('app.notFoundDescription')}</p>
          <Link to="/" className="btn btn-primary">{t('app.returnHome')}</Link>
        </section>
      </main>
      <Footer />
    </div>
  );
};

const PageLoader = () => {
  const { t } = useLanguage();
  return (
    <div role="status" aria-label={t('app.loadingLabel')} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
      <div className="spinner" aria-hidden="true" style={{ width: '40px', height: '40px', border: '4px solid var(--border-medium)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const ProtectedRoute = ({ children, role, requireAdminMfa = true }) => {
  const { isAuthenticated, user, mfaStatus } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/giris" replace state={{ from: location }} />;
  }

  if (role && user?.role !== role) {
    const dashboardPath = user?.role === 'admin'
      ? '/admin'
      : user?.role === 'psychologist'
        ? '/psikolog-panel'
        : '/panel';
    return <Navigate to={dashboardPath} replace />;
  }

  if (role === 'admin' && requireAdminMfa) {
    if (mfaStatus.loading) return <PageLoader />;
    if (!mfaStatus.verified) {
      return <Navigate to="/admin-mfa" replace state={{ from: location }} />;
    }
  }

  return children;
};

function App() {
  const { t } = useLanguage();
  const registrationEnabled = FEATURES.publicRegistration || FEATURES.professionalApplications;
  const sessionExperienceEnabled = IS_DEMO_MODE || FEATURES.liveSessions;

  return (
    <>
      <AccessibilityNavigation />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/giris" element={<Login />} />
          <Route path="/kayit" element={registrationEnabled ? <RegisterChoice /> : <DemoRestricted />} />
          <Route path="/kayit/danisan" element={FEATURES.publicRegistration ? <RegisterClient /> : <DemoRestricted />} />
          <Route path="/kayit/psikolog" element={FEATURES.professionalApplications ? <RegisterPsychologist /> : <DemoRestricted />} />

          <Route path="/psikologlar" element={<PsychologistList />} />
          <Route path="/psikolog/:id" element={<PsychologistProfile />} />

          <Route path="/panel" element={<ProtectedRoute role="client"><ClientDashboard /></ProtectedRoute>} />
          <Route path="/psikolog-panel" element={<ProtectedRoute role="psychologist"><PsychDashboard /></ProtectedRoute>} />
          <Route path="/admin-mfa" element={<ProtectedRoute role="admin" requireAdminMfa={false}><AdminMfa /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />

          <Route
            path="/seans/:sessionId"
            element={(
              <ProtectedRoute>
                {sessionExperienceEnabled
                  ? <SessionRoom />
                  : (
                    <DemoRestricted
                      title={t('app.sessionsClosedTitle')}
                      description={t('app.sessionsClosedDescription')}
                    />
                  )}
              </ProtectedRoute>
            )}
          />

          {/* Support Pages */}
          <Route path="/degerlendirme" element={<ProtectedRoute role="client"><ReviewPage /></ProtectedRoute>} />
          <Route path="/degerlendirmeler" element={<ProtectedRoute role="psychologist"><ReviewsPage /></ProtectedRoute>} />
          <Route path="/hakkinda" element={<About />} />
          <Route path="/ayarlar" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/bildirimler" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/sss" element={<FaqPage />} />
          <Route path="/gizlilik-politikasi" element={<PrivacyPolicyPage />} />
          <Route path="/kullanim-kosullari" element={<TermsPage />} />
          <Route path="/sifremi-unuttum" element={IS_DEMO_MODE ? <DemoRestricted /> : <ForgotPasswordPage />} />
          <Route path="/sifre-yenile" element={IS_DEMO_MODE ? <DemoRestricted /> : <ResetPasswordPage />} />
          <Route path="/e-posta-dogrula" element={IS_DEMO_MODE ? <DemoRestricted /> : <EmailVerificationPage />} />
          <Route path="/hesap-dogrulandi" element={IS_DEMO_MODE ? <DemoRestricted /> : <EmailConfirmationPage />} />

          {/* Catch all route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <DemoNotice />
    </>
  );
}

export default App;
