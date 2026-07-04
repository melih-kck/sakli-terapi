import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SPECIALIZATIONS } from '../data/constants';
import { fetchApprovedPsychologists, getDemoPsychologists } from '../lib/psychologists';
import RatingStars from '../components/RatingStars';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
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
    { q: 'GizliBiriz nasıl çalışır?', a: 'Anonim bir rumuz ile kayıt olursunuz, psikologlarımızı inceler ve size uygun olanı seçersiniz. Seanslarınızda yüzünüz blur efektiyle gizlenir, psikologunuz gerçek kimliğinizi bilemez. Kendinizi hazır hissettiğinizde blur seviyesini kademeli olarak azaltabilirsiniz.' },
    { q: 'Gerçekten anonim miyim?', a: 'Evet. Psikologunuz gerçek adınızı, yüzünüzü veya kişisel bilgilerinizi göremez. Siz yalnızca seçtiğiniz rumuz ile tanınırsınız. Kişisel bilgileriniz yalnızca platform tarafından güvenli bir kasada saklanır ve hiçbir koşulda psikologla paylaşılmaz.' },
    { q: 'Psikologlar nasıl doğrulanıyor?', a: 'Tüm psikologlarımız kimlik, diploma ve mesleki sertifika doğrulamasından geçer. Aday psikologlar ise üniversite onay belgesi ve süpervizör bilgisiyle kayıt olur. Doğrulanmamış hiçbir psikolog platformda yer alamaz.' },
    { q: 'Acil durumda ne olur?', a: 'Kayıt sırasında verdiğiniz acil durum bilgileri güvenli bir kasada saklanır. Psikologunuz bir kriz tespit ettiğinde, platform yönetimi bu bilgilere kontrollü erişim sağlayarak gerekli acil müdahaleyi koordine eder.' },
    { q: 'Seans ücreti ne kadardır?', a: 'GizliBiriz\'de seans ücretleri psikologlarımızın uzmanlık seviyelerine göre değişiklik göstermektedir. Tüm ödemeleriniz %100 güvenli ödeme altyapısıyla şifrelenerek tahsil edilir.' },
    { q: 'Aday psikolog nedir?', a: 'Aday psikologlar, psikoloji bölümü son sınıf öğrencileridir ve bir süpervizör (danışman hoca) gözetiminde seans yaparlar. Deneyim kazanmak isteyen, eğitimli ve denetim altında çalışan genç profesyonellerdir.' },
  ];

  const getSpecLabel = (id) => SPECIALIZATIONS.find(s => s.id === id)?.label || id;

  return (
    <div className="page">
      <Navbar />
      <main>
        {/* Hero Section */}
        <section className="hero" id="hero-section">
          <div className="hero-bg">
            <div className="hero-shape hero-shape-1"></div>
            <div className="hero-shape hero-shape-2"></div>
            <div className="hero-shape hero-shape-3"></div>
          </div>
          <div className="container hero-content">
            <h1 className="hero-title fade-in">
              Kimliğiniz <span className="text-gradient">Gizli</span>,{' '}
              Sesiniz <span className="text-gradient">Duyulur</span>
            </h1>
            <p className="hero-subtitle fade-in delay-1">
              Anonim psikolojik danışmanlık platformunda, kimliğinizi gizleyerek
              profesyonel psikologlardan destek alın.
            </p>
            <div className="hero-actions fade-in delay-2">
              {user ? (
                <Link to={user.role === 'psychologist' ? '/psikolog-panel' : '/panel'} className="btn btn-primary btn-xl" id="hero-cta-start">
                  Panele Git
                </Link>
              ) : (
                <Link to="/kayit" className="btn btn-primary btn-xl" id="hero-cta-start">
                  Hemen Başla
                </Link>
              )}
              <Link to="/psikologlar" className="btn btn-outline btn-xl" id="hero-cta-browse" style={{ borderColor: '#fff', color: '#fff' }}>
                Psikologları İncele
              </Link>
            </div>
            <div className="hero-stats fade-in delay-3">
              <div className="hero-stat">
                <span className="hero-stat-value">820+</span>
                <span className="hero-stat-label">Seans</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="hero-stat">
                <span className="hero-stat-value">15</span>
                <span className="hero-stat-label">Uzman Psikolog</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="hero-stat">
                <span className="hero-stat-value">%98</span>
                <span className="hero-stat-label">Memnuniyet</span>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="section" id="how-it-works">
          <div className="container">
            <div className="text-center mb-2xl animate-on-scroll">
              <h2>Nasıl Çalışır?</h2>
              <p className="section-subtitle">4 basit adımda anonim danışmanlık</p>
            </div>
            <div className="steps-grid">
              {[
                { icon: '🔐', title: 'Anonim Kayıt', desc: 'Rumuz seçin, kimliğiniz gizli kalsın' },
                { icon: '🔍', title: 'Psikolog Seçin', desc: 'Yorum ve puanlara göre size uygun psikoloğu bulun' },
                { icon: '💬', title: 'Anonim Seans', desc: 'Blur efektiyle güvenli görüşmenizi yapın' },
                { icon: '⭐', title: 'Değerlendirin', desc: 'Deneyiminizi paylaşarak diğerlerine yol gösterin' },
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
              <h2>Neden <span className="text-gradient">GizliBiriz</span>?</h2>
              <p className="section-subtitle">Güvenliğiniz ve konforunuz için tasarlandı</p>
            </div>
            <div className="grid grid-2 gap-xl">
              {[
                { icon: '🛡️', title: 'Tam Anonimlik', desc: 'Psikologunuz gerçek kimliğinizi asla bilmez. Rumuzunuzla güvenle iletişim kurun.' },
                { icon: '👨‍⚕️', title: 'Lisanslı Uzmanlar', desc: 'Tüm psikologlarımız kimlik ve diploma doğrulamasından geçer.' },
                { icon: '🎚️', title: 'Kademeli Açılma', desc: 'Hazır hissettiğinizde blur efektini kademeli olarak kaldırın.' },
                { icon: '🔒', title: 'Uçtan Uca Güvenlik', desc: 'KVKK uyumlu, şifreli altyapı ile verileriniz güvende.' },
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
              <h2>Öne Çıkan Psikologlarımız</h2>
              <p className="section-subtitle">En yüksek puan alan uzmanlarımız</p>
            </div>
            <div className="grid grid-4 gap-lg">
              {topPsychologists.map((psych, i) => (
                <Link to={`/psikolog/${psych.id}`} key={psych.id} className="card card-interactive psych-card animate-on-scroll" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="card-body">
                    <div className="avatar avatar-xl" style={{ margin: '0 auto var(--space-md)' }}>
                      {psych.initials}
                    </div>
                    <h4 className="text-center">{psych.name}</h4>
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
              <h3 className="mb-sm">Tam Güvenlik & Gizlilik</h3>
              <p className="donation-desc" style={{ maxWidth: '800px' }}>
              GizliBiriz altyapısındaki tüm görüşmeleriniz ve ödeme işlemleriniz uçtan uca şifrelenir. 
              Psikologunuz dahil kimse gerçek kimliğinizi veya finansal verilerinizi göremez.
            </p>
            <div className="donation-amount">%100</div>
              <p style={{ color: 'var(--primary)', fontWeight: 600 }}>Güvenli Ödeme Garantisi</p>
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
