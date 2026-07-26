# Portföy Demo Rehberi

## Demo Amacı

Saklı Terapi, çevrim içi psikolojik danışmanlıkta mahremiyet kaygısının ürün tasarımı ve yazılım mimarisiyle nasıl ele alınabileceğini araştıran etkileşimli bir prototiptir. Demo; aktif sağlık hizmeti yerine problem tanımını, kullanıcı deneyimini, güvenlik sınırlarını ve teknik uygulamayı gösterir.

## Beş Dakikalık İnceleme Akışı

1. Ana sayfada problem hipotezini ve demo sınırını anlatın.
2. `Demoyu Aç` ile danışan rolüne girin; kurgusal uzman kataloğunu ve demo randevusunu gösterin.
3. Seans odasında metin, ses ve bulanık görüntü seçeneklerini; bluru kaldırırken çıkan açık onayı gösterin.
4. Uzman rolüne geçerek takvim ve rumuzla temsil edilen danışan deneyimini gösterin.
5. Yönetici rolünde kurgusal belgeyi inceleyip başvuruyu onaylayın ve denetim kaydını gösterin.

## Öne Çıkarılacak Kararlar

- Varsayılan anonimlik yerine kullanıcı tarafından kontrol edilen gizlilik seviyesi
- Danışanın gerçek adı yerine rumuz gösterimi
- Blursuz görüntü için geri alınabilir ve açık onay
- Rol tabanlı erişim ve PostgreSQL RLS politikaları
- Yönetici işlemleri için MFA ve denetim kaydı
- Profesyonel belgeyi herkese açık alandan ayıran özel depolama
- Gerçek veri olmadan tüm ürün yolculuğunu gösteren demo modu

## Teknik Çerçeve

- React ve Vite ile bileşen tabanlı istemci
- Supabase Auth, PostgreSQL, RLS ve Storage
- PeerJS/WebRTC ile gerçek zamanlı görüşme prototipi
- Vitest ve React Testing Library ile otomatik testler
- GitHub Actions, Sentry ve Vercel ile kalite ve dağıtım hattı

## Güvenlik ve Etik Sınır

Portföy sürümü sağlık hizmeti sunmaz, gerçek randevu kabul etmez, ödeme almaz ve gerçek kullanıcı verisi saklamaz. Demo sırasında gerçek kişi, diploma, sağlık bilgisi veya iletişim bilgisi girilmemelidir. Canlı hizmete geçiş; hukuk, klinik yönetişim, veri koruma ve operasyon onaylarından ayrı bir aşamadır.

## Ürün İncelemesinde Tartışılabilecek Sorular

- Mahremiyet kontrolü yardım arama eşiğini düşürür mü?
- Blur seviyesi ve iletişim kanalı seçimi güven duygusunu nasıl etkiler?
- Anonimlik, güvenlik ve profesyonel sorumluluk arasında nasıl denge kurulmalı?
- Bir üniversite ortamında kullanıcı araştırması ve etik kurul süreci nasıl tasarlanmalı?
- Kapalı pilot için hangi başarı ve güvenlik ölçütleri kullanılmalı?

## Kısa CV Açıklaması

“Gizlilik odaklı çevrim içi danışmanlık deneyimini araştıran Saklı Terapi prototipini geliştirdim. React, Supabase/PostgreSQL RLS ve WebRTC kullanan sistemde danışan, uzman ve yönetici akışları; rol tabanlı erişim, profesyonel belge doğrulama, MFA, denetim kaydı ve güvenli portföy demo modu tasarladım.”
