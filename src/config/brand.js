const envValue = (key, fallback) => {
  const value = import.meta.env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

export const BRAND = Object.freeze({
  name: 'Saklı Terapi',
  namePrimary: 'Saklı',
  nameAccent: 'Terapi',
  tagline: 'Kendin kal, güvende konuş.',
  description: 'Rumuz temelli profiller ve kontrollü görüntü seçenekleri sunan çevrim içi psikolojik destek platformu.',
  supportEmail: envValue('VITE_SUPPORT_EMAIL', 'destek@sakliterapi.com'),
  contactEmail: envValue('VITE_CONTACT_EMAIL', 'iletisim@sakliterapi.com'),
});

export const getMailto = (email, subject = '') => (
  `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`
);
