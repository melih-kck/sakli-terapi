/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SessionProvider, useSession } from './context/SessionContext';
import { ReviewProvider } from './context/ReviewContext';
import { ProfileProvider } from './context/ProfileContext';
import { NotificationProvider } from './context/NotificationContext';
import { LanguageProvider } from './context/LanguageContext';
import AppErrorBoundary from './components/AppErrorBoundary';
import { initializeMonitoring } from './lib/monitoring';
import App from './App.jsx';

// Import design system and styles
import './styles/design-system.css';
import './styles/reset.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/animations.css';
import './index.css';

// Inner wrapper connects AuthContext → child providers via props
function InnerProviders() {
  const { user, setUser } = useAuth();
  return (
    <NotificationProvider user={user}>
      <ProfileProvider user={user} setUser={setUser}>
        <SessionProvider user={user}>
          <ReviewBridge user={user} />
        </SessionProvider>
      </ProfileProvider>
    </NotificationProvider>
  );
}

// Bridges SessionContext.markSessionReviewed → ReviewProvider
function ReviewBridge({ user }) {
  const { markSessionReviewed, sessions } = useSession();
  return (
    <ReviewProvider user={user} sessions={sessions} markSessionReviewed={markSessionReviewed}>
      <App />
    </ReviewProvider>
  );
}

initializeMonitoring().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <BrowserRouter>
          <LanguageProvider>
            <ToastProvider>
              <AuthProvider>
                <InnerProviders />
              </AuthProvider>
            </ToastProvider>
          </LanguageProvider>
        </BrowserRouter>
      </AppErrorBoundary>
    </React.StrictMode>,
  );
});
