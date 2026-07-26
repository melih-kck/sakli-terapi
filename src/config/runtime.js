const readBoolean = (value, fallback = false) => {
  if (typeof value !== 'string') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

export const APP_MODE = import.meta.env.VITE_APP_MODE === 'live' ? 'live' : 'demo';
export const IS_DEMO_MODE = APP_MODE === 'demo';
export const ALLOW_LOCAL_SIMULATION = IS_DEMO_MODE || import.meta.env.DEV;

export const FEATURES = Object.freeze({
  liveAuthentication: !IS_DEMO_MODE,
  publicRegistration: !IS_DEMO_MODE && readBoolean(import.meta.env.VITE_ENABLE_PUBLIC_REGISTRATION),
  professionalApplications: !IS_DEMO_MODE && readBoolean(import.meta.env.VITE_ENABLE_PROFESSIONAL_APPLICATIONS),
  liveAppointments: !IS_DEMO_MODE && readBoolean(import.meta.env.VITE_ENABLE_LIVE_APPOINTMENTS),
  liveSessions: !IS_DEMO_MODE && readBoolean(import.meta.env.VITE_ENABLE_LIVE_SESSIONS),
  payments: !IS_DEMO_MODE && readBoolean(import.meta.env.VITE_ENABLE_PAYMENTS),
});

export const DEMO_DISCLOSURE = Object.freeze({
  short: 'Portföy demosu',
  title: 'Ürün ve mühendislik portföyü için hazırlanmış teknoloji prototipi',
  description: 'Bu sürüm sağlık hizmeti sunmaz, gerçek randevu kabul etmez ve yalnızca kurgusal veriler kullanır.',
});
