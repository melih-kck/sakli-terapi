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

export const sanitizeMonitoringBreadcrumb = (breadcrumb) => {
  if (!breadcrumb) return breadcrumb;

  const sanitized = { ...breadcrumb };
  if (sanitized.data) {
    sanitized.data = { ...sanitized.data };
    for (const key of ['from', 'to', 'url']) {
      if (sanitized.data[key]) {
        sanitized.data[key] = sanitizeUrl(sanitized.data[key]);
      }
    }
  }

  if (sanitized.category === 'ui.input') {
    sanitized.message = 'Input interaction';
    delete sanitized.data;
  }

  return sanitized;
};

export const sanitizeMonitoringEvent = (event) => {
  const sanitized = { ...event };
  delete sanitized.user;

  if (sanitized.request) {
    sanitized.request = {
      method: sanitized.request.method,
      url: sanitizeUrl(sanitized.request.url),
    };
  }

  if (Array.isArray(sanitized.breadcrumbs)) {
    sanitized.breadcrumbs = sanitized.breadcrumbs.map(sanitizeMonitoringBreadcrumb);
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
      beforeBreadcrumb: sanitizeMonitoringBreadcrumb,
      beforeSend: sanitizeMonitoringEvent,
    });
  } catch (error) {
    console.error('Hata izleme başlatılamadı:', error);
  }
}

export function captureError(error, context = {}) {
  if (sentryClient) {
    sentryClient.withScope((scope) => {
      scope.setContext('sakli-terapi', context);
      sentryClient.captureException(error);
    });
    return;
  }

  if (import.meta.env.DEV) {
    console.error('Yakalanan uygulama hatası:', error, context);
  }
}
