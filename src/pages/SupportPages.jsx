import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import RatingStars from '../components/RatingStars';
import { useAuth } from '../context/AuthContext';
import { useReview } from '../context/ReviewContext';
import { useSession } from '../context/SessionContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { getLocalReviewsForPsychologist } from '../lib/local-reviews';
import { mockReviews } from '../data/mock-reviews';
import '../styles/pages/SupportPages.css';

function PageShell({ eyebrow, title, subtitle, children, aside }) {
  return (
    <div className="page">
      <Navbar />
      <main className="content-page-main">
        <section className="content-hero">
          <div className="container">
            <span className="content-eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </section>

        <div className={`container content-layout ${aside ? '' : 'content-layout-single'}`}>
          <div className="content-primary">
            {children}
          </div>
          {aside && <aside className="content-aside">{aside}</aside>}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ContentSection({ title, children }) {
  return (
    <section className="content-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const reviewAreas = [
  { key: 'listening', label: 'Dinleme' },
  { key: 'empathy', label: 'Empati' },
  { key: 'clarity', label: 'Açıklık' },
  { key: 'trust', label: 'Güven' },
];

export function ReviewPage() {
  const { user, isClient } = useAuth();
  const { submitReview } = useReview();
  const { success, warning } = useToast();
  const { sessions } = useSession();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  
  const sessionToReview = sessions?.find(session => String(session.id) === String(sessionId)) 
                       || user?.sessions?.find(session => String(session.id) === String(sessionId));
  
  const canReviewSession = isClient && sessionToReview?.status === 'completed' && !sessionToReview?.reviewed;
  const [ratings, setRatings] = useState({ listening: 5, empathy: 5, clarity: 4, trust: 5 });
  const [comment, setComment] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const averageRating = useMemo(() => {
    const values = Object.values(ratings);
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [ratings]);

  const updateRating = (key, value) => {
    setRatings(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canReviewSession) {
      warning('Değerlendirme Gönderilemedi', 'Yalnızca tamamlanmış ve daha önce değerlendirilmemiş seanslar yorumlanabilir.');
      return;
    }

    if (comment.trim().length < 10) {
      warning('Kısa Değerlendirme', 'Yorum alanına en az birkaç cümle ekleyin.');
      return;
    }

    const result = await submitReview({
      sessionId,
      ratings,
      rating: averageRating,
      comment,
      anonymous,
    });

    if (!result.success) return;

    setSubmitted(true);
    success('Değerlendirme Alındı', 'Yorumunuz anonim biçimde incelemeye gönderildi.');
  };

  return (
    <PageShell
      eyebrow="Danışan Değerlendirmesi"
      title="Seans Deneyimini Paylaş"
      subtitle="Geri bildiriminiz psikologların hizmet kalitesini izlemesine ve diğer danışanların daha bilinçli seçim yapmasına yardımcı olur."
      aside={(
        <div className="content-info-panel">
          <h3>Gizlilik Notu</h3>
          <p>Değerlendirmeler rumuzla veya anonim olarak görünür. Kimlik, e-posta ve ödeme bilgileriniz paylaşılmaz.</p>
          <div className="content-metric">
            <span>Ortalama puan</span>
            <strong>{averageRating.toFixed(1)}/5</strong>
          </div>
        </div>
      )}
    >
      <form className="content-form-panel" onSubmit={handleSubmit}>
        {submitted ? (
          <div className="content-success-box">
            <h2>Teşekkürler</h2>
            <p>Değerlendirmeniz kaydedildi. Moderasyon sonrası psikolog profilindeki değerlendirme alanına yansıtılır.</p>
            <Link className="btn btn-primary" to={user?.role === 'client' || user?.role === 'admin' ? '/panel' : '/psikologlar'}>
              Devam Et
            </Link>
          </div>
        ) : !canReviewSession ? (
          <div className="content-empty-box">
            <h3>Değerlendirilecek seans bulunamadı</h3>
            <p>Değerlendirme bırakmak için tamamlanmış ve daha önce yorumlanmamış bir seans seçmelisiniz.</p>
            <Link className="btn btn-primary" style={{ marginTop: '15px' }} to="/panel">Panele Dön</Link>
          </div>
        ) : (
          <>
            <div className="content-form-header">
              <h2>Değerlendirme Formu</h2>
              <p>Son görüşmenizdeki deneyimi 1 ile 5 arasında puanlayın.</p>
            </div>

            <div className="review-rating-grid">
              {reviewAreas.map(area => (
                <div key={area.key} className="review-rating-row">
                  <span>{area.label}</span>
                  <RatingStars
                    rating={ratings[area.key]}
                    interactive
                    onChange={(value) => updateRating(area.key, value)}
                    showValue={false}
                    size="lg"
                  />
                </div>
              ))}
            </div>

            <div className="input-group">
              <label>Yorumunuz</label>
              <textarea
                rows="6"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Sizin için faydalı olan noktaları ve gelişmesini istediğiniz alanları yazın."
              />
            </div>

            <label className="checkbox-group content-checkbox">
              <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
              <span>Değerlendirmem anonim görünsün.</span>
            </label>

            <div className="content-actions">
              <Link className="btn btn-ghost" to="/panel">Vazgeç</Link>
              <button className="btn btn-primary" type="submit">Değerlendirmeyi Gönder</button>
            </div>
          </>
        )}
      </form>
    </PageShell>
  );
}

export function ReviewsPage() {
  const { user } = useAuth();
  const psychologistId = user?.psychologistId || user?.psychologistProfile?.id || user?.id;
  const ownReviews = psychologistId
    ? [
      ...getLocalReviewsForPsychologist(psychologistId),
      ...mockReviews.filter(review => String(review.psychologistId) === String(psychologistId)),
    ].sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];

  const average = ownReviews.length
    ? ownReviews.reduce((sum, review) => sum + review.rating, 0) / ownReviews.length
    : 0;

  return (
    <PageShell
      eyebrow="Psikolog Paneli"
      title="Değerlendirmeler"
      subtitle="Danışanlardan gelen yorumları, ortalama puanı ve geri bildirim başlıklarını tek yerde takip edin."
      aside={(
        <div className="content-info-panel">
          <h3>Özet</h3>
          <div className="content-metric">
            <span>Toplam değerlendirme</span>
            <strong>{ownReviews.length}</strong>
          </div>
          <div className="content-metric">
            <span>Ortalama puan</span>
            <strong>{average ? `${average.toFixed(1)}/5` : '-'}</strong>
          </div>
          <Link className="btn btn-outline btn-block" to="/psikolog-panel">Panele Dön</Link>
        </div>
      )}
    >
      <ContentSection title="Son Değerlendirmeler">
        {ownReviews.length === 0 ? (
          <div className="content-empty-box">
            <h3>Henüz değerlendirme yok</h3>
            <p>Danışanlar seans sonrası yorum bıraktığında burada listelenecek. Şimdilik randevu takibinizi panelden sürdürebilirsiniz.</p>
            <Link className="btn btn-primary" to="/psikolog-panel">Randevu Programına Git</Link>
          </div>
        ) : (
          <div className="review-list-page">
            {ownReviews.slice(0, 12).map(review => (
              <article key={review.id} className="review-detail-item">
                <div className="review-detail-head">
                  <div>
                    <strong>{review.clientAlias}</strong>
                    <span>{new Date(review.date).toLocaleDateString('tr-TR')} • {review.sessionNumber}. seans</span>
                  </div>
                  <RatingStars rating={review.rating} size="sm" />
                </div>
                <p>{review.comment}</p>
              </article>
            ))}
          </div>
        )}
      </ContentSection>

      <ContentSection title="Değerlendirme Kriterleri">
        <div className="content-grid-2">
          <div className="content-note">
            <h3>Kalite</h3>
            <p>Dinleme, empati, açıklık ve profesyonellik puanları genel ortalamaya dahil edilir.</p>
          </div>
          <div className="content-note">
            <h3>Anonimlik</h3>
            <p>Danışan kimliği korunur; yorumlar yalnızca rumuz veya anonim ifade ile gösterilir.</p>
          </div>
        </div>
      </ContentSection>
    </PageShell>
  );
}

const faqGroups = {
  genel: [
    ['GizliBiriz nasıl çalışır?', 'Danışan rumuzla kayıt olur, uygun psikoloğu seçer ve metin, ses veya blurlu görüntülü görüşme seçeneklerinden biriyle randevu alır.'],
    ['Gerçek kimliğim psikologla paylaşılır mı?', 'Hayır. Psikolog yalnızca platformdaki rumuzunuzu ve seans için gerekli tercihlerinizi görür.'],
    ['Acil durumda ne olur?', 'Platform acil krizlerde danışanın kayıt sırasında paylaştığı güvenli acil durum bilgisini yetkili destek akışı için kullanabilir.'],
  ],
  randevu: [
    ['Randevu aldıktan sonra nereden katılırım?', 'Danışan ve psikolog panellerinde randevu kartı görünür. Seans saati geldiğinde karttaki seans butonundan odaya geçilir.'],
    ['Görüşme tipini değiştirebilir miyim?', 'Randevu öncesinde psikolog profili üzerinden uygun kanal seçilir. Varsayılan tercihler ayarlar sayfasından güncellenebilir.'],
    ['Ödeme durumunu nereden görürüm?', 'Randevu kartlarında ödeme durumu ve kısa randevu kodu gösterilir.'],
  ],
  hesap: [
    ['Şifremi unuttum, ne yapmalıyım?', 'Giriş sayfasındaki Şifremi Unuttum bağlantısından e-posta adresinizi girerek sıfırlama isteği oluşturabilirsiniz.'],
    ['E-posta adresimi değiştirebilir miyim?', 'Güvenlik nedeniyle e-posta değişiklikleri destek ekibi üzerinden doğrulanır.'],
    ['Hesabımı silebilir miyim?', 'Ayarlar sayfasındaki hesap silme alanından talep oluşturabilirsiniz.'],
  ],
};

export function FaqPage() {
  const [activeGroup, setActiveGroup] = useState('genel');
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <PageShell
      eyebrow="Destek"
      title="Sık Sorulan Sorular"
      subtitle="Gizlilik, randevu ve hesap işlemleriyle ilgili en çok sorulan başlıklar."
      aside={(
        <div className="content-info-panel">
          <h3>Yanıt bulamadınız mı?</h3>
          <p>Destek ekibine e-posta göndererek hesabınız veya randevunuzla ilgili yardım alabilirsiniz.</p>
          <a className="btn btn-outline btn-block" href="mailto:destek@gizlibiriz.com">Destek Ekibine Yaz</a>
        </div>
      )}
    >
      <div className="content-tabs" role="tablist" aria-label="SSS kategorileri">
        {Object.keys(faqGroups).map(group => (
          <button
            key={group}
            className={activeGroup === group ? 'active' : ''}
            type="button"
            onClick={() => { setActiveGroup(group); setOpenIndex(0); }}
          >
            {group === 'genel' ? 'Genel' : group === 'randevu' ? 'Randevu' : 'Hesap'}
          </button>
        ))}
      </div>

      <div className="faq-list">
        {faqGroups[activeGroup].map(([question, answer], index) => (
          <div key={question} className={`faq-item ${openIndex === index ? 'open' : ''}`}>
            <button type="button" onClick={() => setOpenIndex(openIndex === index ? -1 : index)}>
              <span>{question}</span>
              <strong>{openIndex === index ? '-' : '+'}</strong>
            </button>
            {openIndex === index && <p>{answer}</p>}
          </div>
        ))}
      </div>
    </PageShell>
  );
}

export function PrivacyPolicyPage() {
  return (
    <PageShell
      eyebrow="Gizlilik"
      title="Gizlilik Politikası"
      subtitle="GizliBiriz, danışan gizliliğini ürünün temel çalışma ilkesi olarak ele alır."
      aside={(
        <div className="content-info-panel">
          <h3>Kısa Özet</h3>
          <p>Kimlik, sağlık ve ödeme bilgileri farklı amaçlarla işlenir; psikologlar danışanın gerçek kimliğini görmez.</p>
          <span className="content-date">Son güncelleme: 3 Haziran 2026</span>
        </div>
      )}
    >
      <ContentSection title="Toplanan Bilgiler">
        <p>Hesap oluşturma, randevu planlama, ödeme güvenliği ve acil durum desteği için gerekli minimum bilgiler alınır. Danışanlar psikologlarla rumuz üzerinden iletişim kurar.</p>
      </ContentSection>

      <ContentSection title="Bilgilerin Kullanımı">
        <div className="legal-table">
          <div><strong>Hesap bilgileri</strong><span>Giriş, kimlik doğrulama ve hesap güvenliği</span></div>
          <div><strong>Randevu bilgileri</strong><span>Seans planlama, hatırlatma ve panel gösterimi</span></div>
          <div><strong>Ödeme bilgileri</strong><span>Ödeme doğrulama ve finansal kayıtların tutulması</span></div>
          <div><strong>Acil durum bilgileri</strong><span>Yalnızca ciddi risk ve güvenlik durumlarında kontrollü erişim</span></div>
        </div>
      </ContentSection>

      <ContentSection title="Paylaşım İlkeleri">
        <p>GizliBiriz, kullanıcı verilerini reklam amaçlı satmaz. Psikologlar yalnızca seans yürütmek için gerekli anonim bilgileri görür. Yasal zorunluluklar ve hayati riskler dışında gerçek kimlik bilgileri paylaşılmaz.</p>
      </ContentSection>

      <ContentSection title="Haklarınız">
        <p>Hesap verilerinize erişme, düzeltme, silme ve işleme kısıtlama talepleri için destek ekibiyle iletişime geçebilirsiniz.</p>
      </ContentSection>
    </PageShell>
  );
}

export function TermsPage() {
  return (
    <PageShell
      eyebrow="Koşullar"
      title="Kullanım Koşulları"
      subtitle="Platformu kullanırken geçerli olan temel hak, sorumluluk ve güvenlik kuralları."
      aside={(
        <div className="content-info-panel">
          <h3>Önemli</h3>
          <p>GizliBiriz acil kriz müdahalesi yerine geçmez. Hayati risk varsa yerel acil yardım hatlarına başvurulmalıdır.</p>
          <span className="content-date">Son güncelleme: 3 Haziran 2026</span>
        </div>
      )}
    >
      <ContentSection title="Hizmetin Kapsamı">
        <p>GizliBiriz, danışanların doğrulanmış psikologlarla anonim biçimde randevu planlamasına ve seansa katılmasına yardımcı olan dijital bir platformdur.</p>
      </ContentSection>

      <ContentSection title="Kullanıcı Sorumlulukları">
        <ul className="content-list">
          <li>Hesap bilgilerinin doğru ve güncel tutulması gerekir.</li>
          <li>Seans sırasında üçüncü kişilerin gizliliğini ihlal eden içerik paylaşılmamalıdır.</li>
          <li>Platform güvenliğini zedeleyen davranışlar hesap kısıtlamasına neden olabilir.</li>
        </ul>
      </ContentSection>

      <ContentSection title="Psikolog Sorumlulukları">
        <p>Psikologlar mesleki etik ilkelere, gizlilik yükümlülüklerine ve platformun doğrulama kurallarına uymayı kabul eder.</p>
      </ContentSection>

      <ContentSection title="Ödeme ve Randevu">
        <p>Randevu, seçilen tarih ve saat için oluşturulur. Ödeme durumu panelde gösterilir. İptal ve iade süreçleri destek ekibi üzerinden değerlendirilir.</p>
      </ContentSection>
    </PageShell>
  );
}

export function ForgotPasswordPage() {
  const { success, error: showError } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/giris`,
      });

      if (error) throw error;
      setIsSent(true);
      success('Bağlantı Gönderildi', 'E-posta kutunuzu kontrol edin.');
    } catch (err) {
      showError('İşlem Tamamlanamadı', err.message || 'Şifre sıfırlama bağlantısı gönderilemedi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageShell
      eyebrow="Hesap Güvenliği"
      title="Şifremi Unuttum"
      subtitle="Kayıtlı e-posta adresinizi yazın; şifre yenileme bağlantısını size gönderelim."
      aside={(
        <div className="content-info-panel">
          <h3>Güvenlik</h3>
          <p>Bağlantı yalnızca belirli süre geçerlidir. E-postayı görmüyorsanız spam klasörünü kontrol edin.</p>
        </div>
      )}
    >
      <form className="content-form-panel" onSubmit={handleSubmit}>
        {isSent ? (
          <div className="content-success-box">
            <h2>E-postanızı kontrol edin</h2>
            <p>Hesabınız varsa sıfırlama bağlantısı gönderildi. Bağlantı üzerinden yeni şifrenizi belirleyebilirsiniz.</p>
            <Link className="btn btn-primary" to="/giris">Giriş Sayfasına Dön</Link>
          </div>
        ) : (
          <>
            <div className="input-group">
              <label>E-posta adresi</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ornek@mail.com"
                required
              />
            </div>
            <div className="content-actions">
              <Link className="btn btn-ghost" to="/giris">Geri Dön</Link>
              <button className="btn btn-primary" type="submit" disabled={isLoading}>
                {isLoading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
              </button>
            </div>
          </>
        )}
      </form>
    </PageShell>
  );
}
