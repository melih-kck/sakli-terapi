# Teslim Hazırlığı

Son güncelleme: 18 Temmuz 2026

## Tamamlanan Teknik Yapı

- [x] GitHub özel depo, CI ve Vercel üretim dağıtımı
- [x] Supabase Auth, rol ayrımı ve RLS güvenlik sınırları
- [x] Danışan, psikolog ve yönetici temel akışları
- [x] Metin, ses ve bulanık görüntülü seans akışları
- [x] Bildirimler, yönetici işlem geçmişi ve Sentry izleme
- [x] Özel psikolog belge deposu ve yönetici doğrulama akışı
- [x] Belgesiz psikolog profilinin etkinleştirilmesini engelleyen veritabanı kuralı
- [x] Otomatik lint, test, build ve yüksek önem düzeyi bağımlılık denetimi
- [x] Yedekleme, geri dönüş, olay müdahalesi ve gerçek cihaz test prosedürleri

## Pilot Öncesi İnsan Onayı Gerekenler

- [x] `migration-015-psychologist-verification.sql` üretime uygulandı ve `verify-rls.sql` geçti
- [x] GitHub, Supabase, Vercel ve Sentry hesaplarında MFA etkin
- [x] `migration-016-admin-mfa.sql` üretime uygulandı ve uygulama yönetici hesabında TOTP etkin
- [x] `migration-017-public-view-security.sql` üretime uygulandı; RLS doğrulaması ve Supabase Advisor hata taraması geçti
- [x] Gerçek iPhone, Android ve bilgisayarda kabul matrisi geçti (18 Temmuz 2026, proje sahibi onayı)
- [x] İlk şifreli veritabanı ve Storage yedeği alındı; manifest ve geri açma kontrolü geçti (18 Temmuz 2026)
- [x] İlk yedek ayrı geçici Supabase projesine geri yüklenerek prova edildi (18 Temmuz 2026)
- [ ] Gizlilik politikası, açık rıza/aydınlatma metni ve kullanım koşulları hukuk danışmanı tarafından onaylandı
- [ ] Veri saklama ve hesap silme süreleri yazılı olarak kararlaştırıldı
- [ ] Destek sorumlusu, olay sorumlusu ve psikolog belge inceleme sorumlusu belirlendi

## Bilinçli Olarak Ertelenenler

- [ ] Ödeme sağlayıcısı sözleşmesi, ödeme akışı, iade ve mutabakat
- [ ] Özel alan adı, gönderici alan adı doğrulaması ve Resend üretim teslimatı
- [ ] Açık kullanıcı alımı; önce sınırlı ve davetli kapalı pilot yapılacak

## Teslim Kararı

Kod tabanı güvenli MVP/kapalı pilot adayıdır. Yukarıdaki pilot öncesi insan onayları tamamlanmadan geniş kitleye açık üretim hizmeti olarak ilan edilmemelidir. Ödeme özelliği etkinleştirilene kadar ödeme uçları ve arayüzü kapalı kalmalıdır.
