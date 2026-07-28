/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../i18n/translations';

const LANGUAGE_STORAGE_KEY = 'sakli_terapi_language';
const SUPPORTED_LANGUAGES = new Set(['tr', 'en']);
const DEFAULT_TRANSLATIONS = {
  rating: {
    select: 'Puan seçin',
    outOf: '{{rating}} / {{max}} yıldız',
    star: '{{count}} yıldız',
  },
  moods: ['Çok Kötü', 'Kötü', 'Normal', 'İyi', 'Çok İyi'],
};

const interpolate = (value, variables = {}) => {
  if (Array.isArray(value)) return value.map((item) => interpolate(item, variables));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item, variables)]));
  }
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
};

const getTranslation = (catalog, key) => (
  key.split('.').reduce((value, segment) => value?.[segment], catalog)
);

const defaultContext = {
  language: 'tr',
  setLanguage: () => {},
  t: (key, variables) => interpolate(getTranslation(DEFAULT_TRANSLATIONS, key) ?? key, variables),
};

const LanguageContext = createContext(defaultContext);

const getInitialLanguage = () => {
  if (typeof window === 'undefined') return 'tr';
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return SUPPORTED_LANGUAGES.has(stored) ? stored : 'tr';
};

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  const setLanguage = useCallback((nextLanguage) => {
    if (!SUPPORTED_LANGUAGES.has(nextLanguage)) return;
    setLanguageState(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  }, []);

  const t = useCallback((key, variables) => {
    const translated = getTranslation(translations[language], key);
    const fallback = getTranslation(translations.tr, key);
    return interpolate(translated ?? fallback ?? key, variables);
  }, [language]);

  useEffect(() => {
    document.documentElement.lang = language;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', t('meta.description'));
  }, [language, t]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
