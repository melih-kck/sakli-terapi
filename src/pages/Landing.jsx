import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { SPECIALIZATIONS } from '../data/constants';
import { fetchApprovedPsychologists, getDemoPsychologists } from '../lib/psychologists';
import RatingStars from '../components/RatingStars';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { BRAND } from '../config/brand';
import { DEMO_DISCLOSURE, IS_DEMO_MODE } from '../config/runtime';
import '../styles/pages/Landing.css';

export default function Landing() {
  const { user } = useAuth();
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

  const faqs = [
    { q: `${BRAND.name} nasıl çalışır?`, a: 'Prototip; rumuz temelli danışan profili, uzman keşfi, randevu, yönetici doğrulaması ve kontrollü görüntü seçeneklerini üç ayrı kullanıcı rolünde gösterir.' },
    { q: 'Hangi bilgilerim gizli kalır?', a: 'Psikolog ekranlarında danışanlar rumuzlarıyla görünür. Hesap e-postası ve isteğe bağlı acil durum kişisi psikolog profillerine veya herkese açık sayfalara açılmaz. Görüşmede paylaşacağınız kişisel bilgiler sizin kontrolünüzdedir.' },
    { q: 'Psikologlar nasıl yayımlanıyor?', a: 'Demo yönetici paneli, mesleki belge inceleme ve başvuru kararının ürün akışını gösterir. Portföy sürümündeki bütün profiller kurgusaldır.' },
    { q: 'Acil durumda ne olur?', a: `${BRAND.name} portföy sürümü sağlık veya acil müdahale hizmeti değildir. Hayati risk veya acil durumda 112 Acil Çağrı Merkezi aranmalıdır.` },
    { q: 'Seans ücreti ne kadardır?', a: 'Portföy sürümünde gerçek ücret veya ödeme bulunmaz. Ödeme entegrasyonu, hukuki ve operasyonel onaylardan sonra ele alınacak üretim özelliğidir.' },
    { q: 'Gerçek hesap açabilir miyim?', a: 'Hayır. Bu sürüm yalnızca akademik değerlendirme ve portföy sunumu içindir. Hazır demo rolleri gerçek kişisel veri girmeden kullanılabilir.' },
  ];

  const getSpecLabel = (id) => SPECIALIZATIONS.find(s => s.id === id)?.label || id;

  return (
    <div className="page">
      <Navbar />
      <main>
        {/* Hero Section */}
        <section className="hero" id="hero-section">
          <div className="container hero-content">
            {IS_DEMO_MODE && <span className="hero-eyebrow">{DEMO_DISCLOSURE.title}</span>}
            <h1 className="hero-title fade-in">
              {BRAND.name}
            </h1>
            <p className="hero-subtitle fade-in delay-1">
              {IS_DEMO_MODE
                ? 'Mahremiyet odaklı bir psikolojik destek platformunun danışan, uzman ve yönetici deneyimlerini güvenli demo verileriyle keşfedin.'
                : `${BRAND.tagline} Rumuz temelli profil ve kontrollü görüntü seçenekleriyle doğrulanmış psikolog profillerinden çevrim içi destek alın.`}
            </p>
            <div className="hero-actions fade-in delay-2">
              {user ? (
                <Link to={user.role === 'admin' ? '/admin' : user.role === 'psychologist' ? '/psikolog-panel' : '/panel'} className="btn btn-primary btn-xl" id="hero-cta-start">
                  Panele Git
                </Link>
              ) : (
                <Link to={IS_DEMO_MODE ? '/giris' : '/kayit'} className="btn btn-primary btn-xl" id="hero-cta-start">
                  {IS_DEMO_MODE ? 'Etkileşimli Demoyu Aç' : 'Hemen Başla'}
                </Link>
              )}
              <Link to="/psikologlar" className="btn btn-outline btn-xl" id="hero-cta-browse" style={{ borderColor: '#fff', color: '#fff' }}>
                Psikologları İncele
              </Link>
            </div>
            <div className="hero-stats fade-in delay-3">
              <div className="hero-stat">
                <span className="hero-stat-value">3 Rol</span>
                <span className="hero-stat-label">Uçtan Uca Deneyim</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="hero-stat">
                <span className="hero-stat-value">0</span>
                <span className="hero-stat-label">Gerçek Kullanıcı Verisi</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="hero-stat">
                <span className="hero-stat-value">CI</span>
                <span className="hero-stat-label">Otomatik Kalite Hattı</span>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="section" id="how-it-works">
          <div className="container">
            <div className="text-center mb-2xl animate-on-scroll">
              <h2>Nasıl Çalışır?</h2>
              <p className="section-subtitle">Dört adımda ürün prototipini inceleyin</p>
            </div>
            <div className="steps-grid">
              {[
                { icon: '01', title: 'Rol Seçin', desc: 'Danışan, uzman veya yönetici deneyimini tek tıkla açın' },
                { icon: '02', title: 'Akışı İnceleyin', desc: 'Kurgusal profiller, paneller ve randevular arasında ilerleyin' },
                { icon: '03', title: 'Seans Odasını Deneyin', desc: 'Gizlilik seviyeleri, ses ve metin kontrollerini keşfedin' },
                { icon: '04', title: 'Mimariyi Görün', desc: 'Güvenlik sınırlarını ve üretim öncesi kapıları inceleyin' },
              ].map((step, i) => (
                <div key={i} className="step-card animate-on-scroll" style={{ animationDelay: `${i * 0.15}s` }}>
                  {i > 0 && <div className="step-connector-line"></div>}
                  <div className="step-icon-circle">
                    <span>{step.icon}</span>
                    <div className="step-num">{i + 1}</div>
                  </div>
                  <h4>{step.title}</h4>
                  <p>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Us */}
        <section className="section why-section" id="why-us">
          <div className="container">
            <div className="text-center mb-2xl animate-on-scroll">
              <h2>Neden <span className="text-gradient">{BRAND.name}</span>?</h2>
              <p className="section-subtitle">Güvenliğiniz ve konforunuz için tasarlandı</p>
            </div>
            <div className="grid grid-2 gap-xl">
              {[
                { icon: '🛡️', title: 'Rumuz Temelli İletişim', desc: 'Danışan profilleri psikolog ekranlarında seçilen rumuzla görünür.' },
                { icon: '👨‍⚕️', title: 'Onaylı Profiller', desc: 'Yalnızca yönetici incelemesinden geçen psikolog profilleri katalogda yayımlanır.' },
                { icon: '🎚️', title: 'Kademeli Açılma', desc: 'Hazır hissettiğinizde blur efektini kademeli olarak kaldırın.' },
                { icon: '🔒', title: 'Sınırlandırılmış Erişim', desc: 'Özel veriler, kullanıcı rolüne ve işlem ihtiyacına göre ayrıştırılır.' },
              ].map((feat, i) => (
                <div key={i} className="card feature-card animate-on-scroll">
                  <div className="card-body">
                    <span className="feature-icon">{feat.icon}</span>
                    <h3>{feat.title}</h3>
                    <p>{feat.desc}</p>
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
              <h2>Kurgusal Uzman Profilleri</h2>
              <p className="section-subtitle">Arama ve profil deneyimini göstermek için hazırlanmış demo verileri</p>
            </div>
            <div className="grid grid-4 gap-lg">
              {topPsychologists.map((psych) => (
                <Link to={`/psikolog/${psych.id}`} key={psych.id} className="card card-interactive psych-card">
                  <div className="card-body">
                    <div className="avatar avatar-xl" style={{ margin: '0 auto var(--space-md)' }}>
                      {psych.initials}
                    </div>
                    <h4 className="text-center">{psych.name}</h4>
                    <p className="text-center"><span className="badge badge-success">Kurgusal demo profili</span></p>
                    <p className="text-center" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }}>{psych.title}</p>
                    <div className="flex-center mb-sm">
                      <RatingStars rating={psych.rating} size="sm" count={psych.reviewCount} />
                    </div>
                    <div className="psych-badges">
                      {psych.specializations.slice(0, 2).map(s => (
                        <span key={s} className="badge badge-primary">{getSpecLabel(s)}</span>
                      ))}
                    </div>
                    <p className="psych-bio">{psych.shortBio}</p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-xl">
              <Link to="/psikologlar" className="btn btn-outline" id="see-all-psychologists">
                Tüm Psikologları Gör →
              </Link>
            </div>
          </div>
        </section>

        {/* Social Responsibility */}
        <section className="section donation-section animate-on-scroll" id="social-responsibility">
          <div className="container">
            <div className="card text-center p-xl w-full">
              <div className="donation-icon mb-md">🔒</div>
              <h3 className="mb-sm">Mahremiyet Odaklı Tasarım</h3>
              <p className="donation-desc" style={{ maxWidth: '800px' }}>
                Profil, seans ve değerlendirme verileri rol bazlı erişim kurallarıyla ayrılır.
                Ödeme özelliği güvenli sunucu doğrulaması tamamlanana kadar kapalı tutulur.
              </p>
              <div className="donation-amount">Rol Bazlı</div>
              <p style={{ color: 'var(--primary)', fontWeight: 600 }}>Erişim Kontrolü</p>
              <Link to="/hakkinda" className="btn btn-primary mt-lg" id="donation-details">
                Altyapımızı İnceleyin
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="section" id="faq-section">
          <div className="container container-md">
            <div className="text-center mb-2xl animate-on-scroll">
              <h2>Sık Sorulan Sorular</h2>
              <p className="section-subtitle">Merak ettikleriniz</p>
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
