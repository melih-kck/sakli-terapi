import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router';
import { useAuth } from './context/AuthContext';

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

const NotFound = () => (
  <div style={{ padding: '100px', textAlign: 'center' }}>
    <h1 style={{ fontSize: '4rem', color: 'var(--primary)', marginBottom: '20px' }}>404</h1>
    <h2>Sayfa Bulunamadı</h2>
    <p style={{ marginBottom: '20px' }}>Aradığınız sayfa mevcut değil veya taşınmış olabilir.</p>
    <a href="/" className="btn btn-primary">Ana Sayfaya Dön</a>
  </div>
);

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
    <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid var(--border-medium)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

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
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/giris" element={<Login />} />
        <Route path="/kayit" element={<RegisterChoice />} />
        <Route path="/kayit/danisan" element={<RegisterClient />} />
        <Route path="/kayit/psikolog" element={<RegisterPsychologist />} />
        
        <Route path="/psikologlar" element={<PsychologistList />} />
        <Route path="/psikolog/:id" element={<PsychologistProfile />} />
        
        <Route path="/panel" element={<ProtectedRoute role="client"><ClientDashboard /></ProtectedRoute>} />
        <Route path="/psikolog-panel" element={<ProtectedRoute role="psychologist"><PsychDashboard /></ProtectedRoute>} />
        <Route path="/admin-mfa" element={<ProtectedRoute role="admin" requireAdminMfa={false}><AdminMfa /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        
        <Route path="/seans/:sessionId" element={<ProtectedRoute><SessionRoom /></ProtectedRoute>} />
        
        {/* Support Pages */}
        <Route path="/degerlendirme" element={<ProtectedRoute role="client"><ReviewPage /></ProtectedRoute>} />
        <Route path="/degerlendirmeler" element={<ProtectedRoute role="psychologist"><ReviewsPage /></ProtectedRoute>} />
        <Route path="/hakkinda" element={<About />} />
        <Route path="/ayarlar" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/bildirimler" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/sss" element={<FaqPage />} />
        <Route path="/gizlilik-politikasi" element={<PrivacyPolicyPage />} />
        <Route path="/kullanim-kosullari" element={<TermsPage />} />
        <Route path="/sifremi-unuttum" element={<ForgotPasswordPage />} />
        <Route path="/sifre-yenile" element={<ResetPasswordPage />} />
        <Route path="/e-posta-dogrula" element={<EmailVerificationPage />} />
        <Route path="/hesap-dogrulandi" element={<EmailConfirmationPage />} />

        {/* Catch all route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default App;
