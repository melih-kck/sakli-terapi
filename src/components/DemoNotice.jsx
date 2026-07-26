import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { DEMO_DISCLOSURE, IS_DEMO_MODE } from '../config/runtime';
import './DemoNotice.css';

export default function DemoNotice() {
  const [isDismissed, setIsDismissed] = useState(false);
  const location = useLocation();

  if (!IS_DEMO_MODE || isDismissed || location.pathname.startsWith('/seans/')) return null;

  return (
    <aside className="demo-notice" aria-label="Demo sürümü bilgisi">
      <span className="demo-notice-dot" aria-hidden="true" />
      <div>
        <strong>{DEMO_DISCLOSURE.short}</strong>
        <span>Gerçek sağlık hizmeti sunmaz.</span>
      </div>
      <Link to="/hakkinda">Proje kapsamı</Link>
      <button
        type="button"
        className="demo-notice-close"
        aria-label="Demo bilgisini kapat"
        title="Demo bilgisini kapat"
        onClick={() => setIsDismissed(true)}
      >
        ×
      </button>
    </aside>
  );
}
