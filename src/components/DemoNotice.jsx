import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { IS_DEMO_MODE } from '../config/runtime';
import { useLanguage } from '../context/LanguageContext';
import './DemoNotice.css';

export default function DemoNotice() {
  const [isDismissed, setIsDismissed] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();

  if (!IS_DEMO_MODE || isDismissed || location.pathname.startsWith('/seans/')) return null;

  return (
    <aside className="demo-notice" aria-label={t('demo.noticeLabel')}>
      <span className="demo-notice-dot" aria-hidden="true" />
      <div>
        <strong>{t('demo.short')}</strong>
        <span>{t('demo.noHealthService')}</span>
      </div>
      <Link to="/hakkinda">{t('demo.scope')}</Link>
      <button
        type="button"
        className="demo-notice-close"
        aria-label={t('demo.closeNotice')}
        title={t('demo.closeNotice')}
        onClick={() => setIsDismissed(true)}
      >
        ×
      </button>
    </aside>
  );
}
