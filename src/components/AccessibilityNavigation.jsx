import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { BRAND } from '../config/brand';
import { useLanguage } from '../context/LanguageContext';

export default function AccessibilityNavigation() {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const previousPath = useRef(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const shouldMoveFocus = previousPath.current !== null && previousPath.current !== pathname;
    previousPath.current = pathname;
    let frameId;
    let observer;

    const preparePage = () => {
      const main = document.querySelector('main');
      if (!main) return false;

      main.id = 'main-content';
      main.tabIndex = -1;

      const heading = main.querySelector('h1');
      const pageName = heading?.textContent?.trim() || BRAND.name;
      document.title = pathname === '/'
        ? t('meta.homeTitle')
        : `${pageName} | ${BRAND.name}`;

      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) {
        const siteOrigin = new URL(canonical.href, window.location.origin).origin;
        const canonicalUrl = new URL(pathname, `${siteOrigin}/`).href;
        canonical.setAttribute('href', canonicalUrl);
        document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonicalUrl);
      }

      if (shouldMoveFocus) {
        main.focus({ preventScroll: true });
        setAnnouncement('');
        frameId = requestAnimationFrame(() => {
          setAnnouncement(t('common.pageLoaded', { page: pageName }));
        });
      }

      return true;
    };

    frameId = requestAnimationFrame(() => {
      if (preparePage()) return;
      observer = new MutationObserver(() => {
        if (preparePage()) observer.disconnect();
      });
      observer.observe(document.getElementById('root'), { childList: true, subtree: true });
    });

    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  }, [pathname, t]);

  const skipToContent = (event) => {
    const main = document.querySelector('main');
    if (!main) return;
    event.preventDefault();
    main.id = 'main-content';
    main.tabIndex = -1;
    main.focus();
    main.scrollIntoView({ block: 'start' });
  };

  return (
    <>
      <a className="skip-link" href="#main-content" onClick={skipToContent}>
        {t('common.skipToContent')}
      </a>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </>
  );
}
