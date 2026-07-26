import { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { BRAND } from '../config/brand';
import '../styles/pages/About.css';

export default function About() {
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
            <h1 className="fade-in">{BRAND.name} Nedir?</h1>
            <p className="fade-in delay-1">
              Psikolojik desteğe ilk adımda mahremiyet hissinin nasıl güçlendirilebileceğini
              araştıran, çalışan bir ürün ve teknoloji prototipi.
            </p>
          </div>
        </section>

        {/* Problem and product hypothesis */}
        <section className="section">
          <div className="container">
            <div className="about-grid animate-on-scroll">
              <div className="about-content">
                <span className="content-eyebrow">Araştırma sorusu</span>
                <h2>Görünürlük kontrolü desteğe başlamayı kolaylaştırabilir mi?</h2>
                <p>
                  Proje; danışanın gerçek adı yerine rumuzla ilerleyebildiği, görüntüsünü
                  bulanık başlatabildiği ve hazır olduğunda görünürlüğünü kademeli olarak
                  değiştirebildiği bir görüşme deneyimini inceliyor.
                </p>
                <p>
                  Temel ürün hipotezi, kontrolün danışanda kalmasının güven hissini
                  güçlendirebileceği ve ilk görüşmeye başlama eşiğini azaltabileceğidir.
                  Bu hipotez henüz klinik bir sonuç iddiası değildir; akademik geri bildirim
                  ve ileride uygun araştırma tasarımıyla değerlendirilmelidir.
                </p>
              </div>
              <div className="card p-xl" style={{ borderStyle: 'dashed', borderColor: 'var(--border-medium)' }}>
                <h3 className="mb-sm" style={{ color: 'var(--text-primary)' }}>Prototipin Sınırı</h3>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.8', listStyleType: 'square', paddingLeft: '20px' }}>
                  <li>Sağlık veya acil müdahale hizmeti sunmaz</li>
                  <li>Gerçek danışan veya uzman kabul etmez</li>
                  <li>Gerçek ödeme ve klinik kayıt oluşturmaz</li>
                  <li>Bütün görünür profiller ve belgeler kurgusaldır</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="section why-section">
          <div className="container">
            <div className="text-center mb-2xl animate-on-scroll">
              <span className="content-eyebrow">Ürün kapsamı</span>
              <h2>Üç Kullanıcı Rolü, Tek Akış</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Her rol kendi veri ve işlem sınırları içinde çalışır.</p>
            </div>
            <div className="values-grid animate-on-scroll">
              <div className="card value-card">
                <div className="value-icon">D</div>
                <h4>Danışan</h4>
                <p>Rumuz, uzman keşfi, randevu, ruh hâli takibi ve gizlilik kontrollü seans odası.</p>
              </div>
              <div className="card value-card">
                <div className="value-icon">U</div>
                <h4>Uzman</h4>
                <p>Profil, uygunluk takvimi, danışan rumuzları ve rol sınırlandırılmış seans yönetimi.</p>
              </div>
              <div className="card value-card">
                <div className="value-icon">Y</div>
                <h4>Yönetici</h4>
                <p>Kurgusal mesleki belge inceleme, başvuru kararı, askıya alma ve işlem geçmişi.</p>
              </div>
              <div className="card value-card">
                <div className="value-icon">G</div>
                <h4>Güvenlik</h4>
                <p>Satır seviyesinde yetkilendirme, MFA, özel belge alanı ve denetlenebilir işlemler.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Technical structure */}
        <section className="section">
          <div className="container">
            <div className="text-center mb-2xl animate-on-scroll">
              <span className="content-eyebrow">Teknik yapı</span>
              <h2>Çalışan MVP Mimarisi</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Portföy demosu üretim veritabanına bağlanmadan yerel kurgusal verilerle çalışır.</p>
            </div>
            <div className="values-grid animate-on-scroll">
              <div className="card value-card">
                <div className="value-icon">R</div>
                <h4>React + Vite</h4>
                <p>Rol tabanlı, duyarlı ve erişilebilir kullanıcı arayüzleri.</p>
              </div>
              <div className="card value-card">
                <div className="value-icon">S</div>
                <h4>Supabase</h4>
                <p>Kimlik doğrulama, PostgreSQL, RLS politikaları ve özel belge deposu.</p>
              </div>
              <div className="card value-card">
                <div className="value-icon">W</div>
                <h4>WebRTC</h4>
                <p>Metin, ses ve bulanıklık kontrollü görüntülü görüşme prototipi.</p>
              </div>
              <div className="card value-card">
                <div className="value-icon">C</div>
                <h4>Kalite Hattı</h4>
                <p>GitHub Actions, otomatik testler, lint, derleme ve bağımlılık denetimi.</p>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
