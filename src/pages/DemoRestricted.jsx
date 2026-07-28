import { Link } from 'react-router';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useLanguage } from '../context/LanguageContext';
import { IS_DEMO_MODE } from '../config/runtime';
import '../styles/pages/SupportPages.css';

export default function DemoRestricted({ title, description }) {
  const { t } = useLanguage();
  const mode = IS_DEMO_MODE ? 'demo' : 'live';
  const visibleTitle = title ?? t(`support.restricted.${mode}Title`);
  const visibleDescription = description ?? t(`support.restricted.${mode}Description`);

  return (
    <div className="page">
      <Navbar />
      <main className="content-page page-content">
        <div className="container container-md">
          <section className="content-hero">
            <span className="content-eyebrow">{t(`support.restricted.${mode}Eyebrow`)}</span>
            <h1>{visibleTitle}</h1>
            <p>{visibleDescription}</p>
          </section>
          <section className="content-layout">
            <div className="content-main">
              <div className="content-section">
                <h2>{t(`support.restricted.${mode}Heading`)}</h2>
                <p>{t(`support.restricted.${mode}Body`)}</p>
                <div className="flex gap-md mt-lg">
                  <Link to="/giris" className="btn btn-primary">{t(`support.restricted.${mode}Primary`)}</Link>
                  <Link to="/hakkinda" className="btn btn-outline">{t(`support.restricted.${mode}Secondary`)}</Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
