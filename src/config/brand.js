const envValue = (key, fallback) => {
  const value = import.meta.env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

export const BRAND = Object.freeze({
  name: 'Saklı Terapi',
  namePrimary: 'Saklı',
  nameAccent: 'Terapi',
  tagline: 'Kendin kal, güvende konuş.',
  description: envValue(
    'VITE_BRAND_DESCRIPTION',
    'Rumuz temelli profiller ve kontrollü görüntü seçeneklerini araştıran mahremiyet odaklı ürün prototipi.',
  ),
  supportEmail: envValue('VITE_SUPPORT_EMAIL', 'destek@sakliterapi.com'),
  contactEmail: envValue('VITE_CONTACT_EMAIL', 'iletisim@sakliterapi.com'),
});

export const getMailto = (email, subject = '') => (
  `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`
);
