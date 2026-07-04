import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
const SessionRoom = lazy(() => import('./pages/SessionRoom'));
const About = lazy(() => import('./pages/About'));
const Settings = lazy(() => import('./pages/Settings'));

// SupportPages exports multiple components, lazy load doesn't easily support named exports
// So we import it normally or create wrapper files. Given its size, normal import is fine for now,
// or we can lazy load a wrapper. For simplicity, we lazy load the wrapper.
// Actually, let's keep normal import for SupportPages if we don't want to split them up right now.
// Since performance is a goal, we can create a small lazy wrapper trick or just import them normally.
// For now, let's import normally as they are relatively small text pages.
import {
  FaqPage,
  ForgotPasswordPage,
  PrivacyPolicyPage,
  ReviewPage,
  ReviewsPage,
  TermsPage,
} from './pages/SupportPages';

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

const ProtectedRoute = ({ children, role }) => {
  const { isAuthenticated, user, isClient, isPsychologist } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/giris" replace state={{ from: location }} />;
  }

  if (role === 'admin' && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Admin kullanıcıları her sayfaya (Danışan veya Psikolog paneli) serbestçe girebilir
  if (user?.role === 'admin') {
    return children;
  }

  if (role === 'client' && !isClient) {
    return <Navigate to="/psikolog-panel" replace />;
  }

  if (role === 'psychologist' && !isPsychologist) {
    return <Navigate to="/panel" replace />;
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
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        
        <Route path="/seans/:sessionId" element={<ProtectedRoute><SessionRoom /></ProtectedRoute>} />
        
        {/* Support Pages */}
        <Route path="/degerlendirme" element={<ProtectedRoute role="client"><ReviewPage /></ProtectedRoute>} />
        <Route path="/degerlendirmeler" element={<ProtectedRoute role="psychologist"><ReviewsPage /></ProtectedRoute>} />
        <Route path="/hakkinda" element={<About />} />
        <Route path="/ayarlar" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/sss" element={<FaqPage />} />
        <Route path="/gizlilik-politikasi" element={<PrivacyPolicyPage />} />
        <Route path="/kullanim-kosullari" element={<TermsPage />} />
        <Route path="/sifremi-unuttum" element={<ForgotPasswordPage />} />

        {/* Catch all route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default App;
