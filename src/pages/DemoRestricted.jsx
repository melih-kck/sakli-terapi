import { Link } from 'react-router';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { DEMO_DISCLOSURE, IS_DEMO_MODE } from '../config/runtime';
import '../styles/pages/SupportPages.css';

export default function DemoRestricted({
  title = IS_DEMO_MODE ? 'Gerçek kullanıcı alımı kapalı' : 'Yeni kullanıcı alımı kapalı',
  description = IS_DEMO_MODE
    ? DEMO_DISCLOSURE.description
    : 'Bu özellik kontrollü pilot hazırlıkları tamamlanana kadar kullanıma açılmayacaktır.',
}) {
  return (
    <div className="page">
      <Navbar />
      <main className="content-page page-content">
        <div className="container container-md">
          <section className="content-hero">
            <span className="content-eyebrow">{IS_DEMO_MODE ? 'Portföy sürümü' : 'Kontrollü erişim'}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </section>
          <section className="content-layout">
            <div className="content-main">
              <div className="content-section">
                <h2>{IS_DEMO_MODE ? 'Demoyu güvenle inceleyin' : 'Mevcut hesabınızla devam edin'}</h2>
                <p>
                  {IS_DEMO_MODE
                    ? 'Hazır danışan, uzman ve yönetici hesaplarıyla tüm temel ürün akışlarını gerçek kişisel veri paylaşmadan deneyebilirsiniz.'
                    : 'Yeni erişimler yalnızca hazırlanan pilot kapsamı ve açık davet ile etkinleştirilecektir.'}
                </p>
                <div className="flex gap-md mt-lg">
                  <Link to="/giris" className="btn btn-primary">{IS_DEMO_MODE ? 'Demo rollerini aç' : 'Giriş sayfasına dön'}</Link>
                  <Link to="/hakkinda" className="btn btn-outline">{IS_DEMO_MODE ? 'Proje kapsamı' : 'Platform hakkında'}</Link>
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
