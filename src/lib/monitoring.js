import { IS_DEMO_MODE } from '../config/runtime';

let sentryClient = null;

const sanitizeUrl = (value) => {
  if (!value) return value;

  try {
    const url = new URL(value, window.location.origin);
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
};

const sanitizeEvent = (event) => {
  const sanitized = { ...event };
  delete sanitized.user;

  if (sanitized.request) {
    sanitized.request = {
      method: sanitized.request.method,
      url: sanitizeUrl(sanitized.request.url),
    };
  }

  return sanitized;
};

export async function initializeMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || import.meta.env.DEV || IS_DEMO_MODE) return;

  try {
    sentryClient = await import('@sentry/react');
    sentryClient.init({
      dsn,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_RELEASE || undefined,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend: sanitizeEvent,
    });
  } catch (error) {
    console.error('Hata izleme başlatılamadı:', error);
  }
}

export function captureError(error, context = {}) {
  if (sentryClient) {
    sentryClient.withScope((scope) => {
      scope.setContext('gizlibiriz', context);
      sentryClient.captureException(error);
    });
    return;
  }

  if (import.meta.env.DEV) {
    console.error('Yakalanan uygulama hatası:', error, context);
  }
}
