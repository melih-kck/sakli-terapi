import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { SPECIALIZATIONS } from '../data/constants';
import { fetchApprovedPsychologists, getDemoPsychologists } from '../lib/psychologists';
import RatingStars from '../components/RatingStars';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { BRAND } from '../config/brand';
import { IS_DEMO_MODE } from '../config/runtime';
import '../styles/pages/Landing.css';

export default function Landing() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [openFaq, setOpenFaq] = useState(null);
  const [topPsychologists, setTopPsychologists] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadTopPsychologists = async () => {
      try {
        const data = await fetchApprovedPsychologists();
        const source = data.length > 0 ? data : getDemoPsychologists();
        if (!isMounted) return;
        setTopPsychologists(
          source
            .filter(p => !p.isCandidate)
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 4)
        );
      } catch (error) {
        console.warn('Öne çıkan psikologlar Supabase üzerinden çekilemedi:', error);
        if (isMounted) {
          setTopPsychologists(
            getDemoPsychologists()
              .filter(p => !p.isCandidate)
              .sort((a, b) => b.rating - a.rating)
              .slice(0, 4)
          );
        }
      }
    };

    loadTopPsychologists();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
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

  const faqs = t('landing.faqs', { brand: BRAND.name }).map(([q, a]) => ({ q, a }));
  const steps = t('landing.steps');
  const features = t('landing.features');

  const getSpecLabel = (id) => t(`specializations.${id}`) || SPECIALIZATIONS.find(s => s.id === id)?.label || id;
  const getPsychologistName = (name) => {
    if (language !== 'en') return name;
    return name
      .replace('Klinik Psikolog Demo', 'Clinical Psychologist Demo')
      .replace('Aday Profil Demo', 'Candidate Profile Demo');
  };

  return (
    <div className="page">
      <Navbar />
      <main>
        {/* Hero Section */}
        <section className="hero" id="hero-section">
          <div className="container hero-content">
            {IS_DEMO_MODE && <span className="hero-eyebrow">{t('demo.title')}</span>}
            <h1 className="hero-title fade-in">
              {BRAND.name}
            </h1>
            <p className="hero-subtitle fade-in delay-1">
              {IS_DEMO_MODE
                ? t('landing.subtitleDemo')
                : t('landing.subtitleLive', { tagline: BRAND.tagline })}
            </p>
            <div className="hero-actions fade-in delay-2">
              {user ? (
                <Link to={user.role === 'admin' ? '/admin' : user.role === 'psychologist' ? '/psikolog-panel' : '/panel'} className="btn btn-primary btn-xl" id="hero-cta-start">
                  {t('landing.goToPanel')}
                </Link>
              ) : (
                <Link to={IS_DEMO_MODE ? '/giris' : '/kayit'} className="btn btn-primary btn-xl" id="hero-cta-start">
                  {IS_DEMO_MODE ? t('landing.openInteractiveDemo') : t('landing.startNow')}
                </Link>
              )}
              <Link to="/psikologlar" className="btn btn-outline btn-xl" id="hero-cta-browse">
                {t('landing.browsePsychologists')}
              </Link>
            </div>
            <div className="hero-stats fade-in delay-3">
              <div className="hero-stat">
                <span className="hero-stat-value">{t('landing.rolesValue')}</span>
                <span className="hero-stat-label">{t('landing.rolesLabel')}</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="hero-stat">
                <span className="hero-stat-value">{t('landing.dataValue')}</span>
                <span className="hero-stat-label">{t('landing.dataLabel')}</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="hero-stat">
                <span className="hero-stat-value">{t('landing.qualityValue')}</span>
                <span className="hero-stat-label">{t('landing.qualityLabel')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="section" id="how-it-works">
          <div className="container">
            <div className="text-center mb-2xl animate-on-scroll">
              <h2>{t('landing.howTitle')}</h2>
              <p className="section-subtitle">{t('landing.howSubtitle')}</p>
            </div>
            <div className="steps-grid">
              {steps.map(([title, desc], i) => (
                <div key={i} className="step-card animate-on-scroll" style={{ animationDelay: `${i * 0.15}s` }}>
                  {i > 0 && <div className="step-connector-line"></div>}
                  <div className="step-icon-circle">
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <div className="step-num">{i + 1}</div>
                  </div>
                  <h4>{title}</h4>
                  <p>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Us */}
        <section className="section why-section" id="why-us">
          <div className="container">
            <div className="text-center mb-2xl animate-on-scroll">
              <h2>{t('landing.whyTitle', { brand: BRAND.name })}</h2>
              <p className="section-subtitle">{t('landing.whySubtitle')}</p>
            </div>
            <div className="grid grid-2 gap-xl">
              {features.map(([title, desc], i) => (
                <div key={i} className="card feature-card animate-on-scroll">
                  <div className="card-body">
                    <span className="feature-icon">{['🛡️', '👨‍⚕️', '🎚️', '🔒'][i]}</span>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Psychologists */}
        <section className="section" id="featured-psychologists">
          <div className="container">
            <div className="text-center mb-2xl animate-on-scroll">
              <h2>{t('landing.featuredTitle')}</h2>
              <p className="section-subtitle">{t('landing.featuredSubtitle')}</p>
            </div>
            <div className="grid grid-4 gap-lg">
              {topPsychologists.map((psych) => (
                <Link to={`/psikolog/${psych.id}`} key={psych.id} className="card card-interactive psych-card">
                  <div className="card-body">
                    <div className="avatar avatar-xl" style={{ margin: '0 auto var(--space-md)' }}>
                      {psych.initials}
                    </div>
                    <h4 className="text-center">{getPsychologistName(psych.name)}</h4>
                    <p className="text-center"><span className="badge badge-success">{t('landing.fictionalProfile')}</span></p>
                    <p className="text-center" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }}>{psych.isCandidate ? t('common.candidatePsychologist') : t('common.clinicalPsychologist')}</p>
                    <div className="flex-center mb-sm">
                      <RatingStars rating={psych.rating} size="sm" count={psych.reviewCount} />
                    </div>
                    <div className="psych-badges">
                      {psych.specializations.slice(0, 2).map(s => (
                        <span key={s} className="badge badge-primary">{getSpecLabel(s)}</span>
                      ))}
                    </div>
                    <p className="psych-bio">{psych.isDemo ? t('catalogue.demoBio') : psych.shortBio}</p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-xl">
              <Link to="/psikologlar" className="btn btn-outline" id="see-all-psychologists">
                {t('landing.seeAll')}
              </Link>
            </div>
          </div>
        </section>

        {/* Social Responsibility */}
        <section className="section donation-section animate-on-scroll" id="social-responsibility">
          <div className="container">
            <div className="card text-center p-xl w-full">
              <div className="donation-icon mb-md">🔒</div>
              <h3 className="mb-sm">{t('landing.privacyDesign')}</h3>
              <p className="donation-desc" style={{ maxWidth: '800px' }}>
                {t('landing.privacyDescription')}
              </p>
              <div className="donation-amount">{t('landing.roleBased')}</div>
              <p style={{ color: 'var(--primary)', fontWeight: 600 }}>{t('landing.accessControl')}</p>
              <Link to="/hakkinda" className="btn btn-primary mt-lg" id="donation-details">
                {t('landing.inspectInfrastructure')}
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="section" id="faq-section">
          <div className="container container-md">
            <div className="text-center mb-2xl animate-on-scroll">
              <h2>{t('landing.faqTitle')}</h2>
              <p className="section-subtitle">{t('landing.faqSubtitle')}</p>
            </div>
            <div className="faq-list">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className={`accordion-item ${openFaq === i ? 'open' : ''}`}
                  id={`faq-item-${i}`}
                >
                  <div className="accordion-header" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    <span>{faq.q}</span>
                    <span className="accordion-icon">{openFaq === i ? '−' : '+'}</span>
                  </div>
                  <div className="accordion-body">
                    <div className="accordion-content">{faq.a}</div>
                  </div>
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
