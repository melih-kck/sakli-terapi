import { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
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
            <h1 className="fade-in">GizliBiriz Nedir?</h1>
            <p className="fade-in delay-1">
              Rumuz temelli profiller ve bulanık görüntü seçenekleriyle mahremiyeti
              önceleyen bir psikolojik danışmanlık platformu.
            </p>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="section">
          <div className="container">
            <div className="about-grid animate-on-scroll">
              <div className="about-content">
                <h2>Misyonumuz</h2>
                <p>
                  Pek çok insan, etiketlenme veya yargılanma korkusuyla psikolojik destek 
                  almaktan çekiniyor. GizliBiriz olarak misyonumuz; yüzünüzü, isminizi ve 
                  kimliğinizi ifşa etmek zorunda kalmadan en üst düzey profesyonellerle 
                  görüşebileceğiniz güvenli bir dijital alan yaratmaktır.
                </p>
                <p>
                  Veri minimizasyonu yaklaşımımız ve blur teknolojimiz, danışanların
                  görüşme sırasında ne kadar görünür olacaklarını seçmesine yardımcı olur.
                </p>
              </div>
              <div className="card p-xl" style={{ borderStyle: 'dashed', borderColor: 'var(--border-medium)' }}>
                <h3 className="mb-sm text-center" style={{ color: 'var(--text-primary)' }}>Neden Gizlilik?</h3>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.8', listStyleType: 'square', paddingLeft: '20px' }}>
                  <li>Toplumsal baskı ve önyargılardan arınma</li>
                  <li>Kendini çok daha açık ve dürüst ifade edebilme</li>
                  <li>Rol bazlı erişim ve veri minimizasyonu</li>
                  <li>Kariyer veya statü endişesi taşımadan tedavi olma</li>
                </ul>
              </div>
            </div>
          </div>
        </section>



        {/* Our Values */}
        <section className="section">
          <div className="container">
            <div className="text-center mb-2xl animate-on-scroll">
              <h2>Temel Değerlerimiz</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Bizi biz yapan ilkeler</p>
            </div>
            <div className="values-grid animate-on-scroll">
              <div className="card value-card">
                <div className="value-icon">🛡️</div>
                <h4>Mahremiyet</h4>
                <p>Özel veriler amaçlarına göre ayrıştırılır ve erişim kullanıcı rolleriyle sınırlandırılır.</p>
              </div>
              <div className="card value-card">
                <div className="value-icon">👨‍⚕️</div>
                <h4>Yetkinlik</h4>
                <p>Yalnızca yönetici incelemesinden geçen psikolog profilleri katalogda yer alır.</p>
              </div>
              <div className="card value-card">
                <div className="value-icon">🌍</div>
                <h4>Erişilebilirlik</h4>
                <p>Mekandan ve zamandan bağımsız, herkesin nitelikli desteğe kolayca ulaşmasını sağlıyoruz.</p>
              </div>
              <div className="card value-card">
                <div className="value-icon">⚙️</div>
                <h4>İnovasyon</h4>
                <p>Blur teknolojisi ve akıllı eşleştirme ile sektörün sınırlarını zorluyoruz.</p>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
