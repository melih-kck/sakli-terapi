import { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { BRAND } from '../config/brand';
import { useLanguage } from '../context/LanguageContext';
import '../styles/pages/About.css';

export default function About() {
  const { t } = useLanguage();
  useEffect(() => {
    // Scroll to top when page loads
    window.scrollTo(0, 0);

    // Simple scroll animation observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="page">
      <Navbar />
      <main className="page-content" style={{ paddingTop: 0 }}>
        
        {/* Hero Section */}
        <section className="about-hero animate-on-scroll">
          <div className="container">
            <h1 className="fade-in">{t('aboutPage.title', { brand: BRAND.name })}</h1>
            <p className="fade-in delay-1">
              {t('aboutPage.intro')}
            </p>
          </div>
        </section>

        {/* Problem and product hypothesis */}
        <section className="section">
          <div className="container">
            <div className="about-grid animate-on-scroll">
              <div className="about-content">
                <span className="content-eyebrow">{t('aboutPage.researchQuestion')}</span>
                <h2>{t('aboutPage.question')}</h2>
                <p>{t('aboutPage.researchP1')}</p>
                <p>{t('aboutPage.researchP2')}</p>
              </div>
              <div className="card p-xl" style={{ borderStyle: 'dashed', borderColor: 'var(--border-medium)' }}>
                <h3 className="mb-sm" style={{ color: 'var(--text-primary)' }}>{t('aboutPage.limitsTitle')}</h3>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.8', listStyleType: 'square', paddingLeft: '20px' }}>
                  {t('aboutPage.limits').map((limit) => <li key={limit}>{limit}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="section why-section">
          <div className="container">
            <div className="text-center mb-2xl animate-on-scroll">
              <span className="content-eyebrow">{t('aboutPage.productScope')}</span>
              <h2>{t('aboutPage.rolesTitle')}</h2>
              <p style={{ color: 'var(--text-secondary)' }}>{t('aboutPage.rolesSubtitle')}</p>
            </div>
            <div className="values-grid animate-on-scroll">
              {t('aboutPage.roles').map(([title, description]) => (
                <div className="card value-card" key={title}>
                  <div className="value-icon">{title.charAt(0)}</div>
                  <h4>{title}</h4>
                  <p>{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Technical structure */}
        <section className="section">
          <div className="container">
            <div className="text-center mb-2xl animate-on-scroll">
              <span className="content-eyebrow">{t('aboutPage.technicalStructure')}</span>
              <h2>{t('aboutPage.architectureTitle')}</h2>
              <p style={{ color: 'var(--text-secondary)' }}>{t('aboutPage.architectureSubtitle')}</p>
            </div>
            <div className="values-grid animate-on-scroll">
              {t('aboutPage.architecture').map(([title, description], index) => (
                <div className="card value-card" key={title}>
                  <div className="value-icon">{['R', 'S', 'W', 'C'][index]}</div>
                  <h4>{title}</h4>
                  <p>{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
