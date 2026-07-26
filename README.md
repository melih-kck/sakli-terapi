# Saklı Terapi

Saklı Terapi; gizlilik odaklı çevrim içi psikolojik danışmanlık fikrinin danışan, uzman ve yönetici deneyimlerini gösteren etkileşimli bir akademik portföy demosudur.

## Sunum Sürümü

Uygulama varsayılan olarak `demo` modunda çalışır. Bu mod:

- Yalnızca kurgusal kullanıcı ve uzman verileri kullanır.
- Tek tıkla danışan, uzman ve yönetici rollerinin incelenmesini sağlar.
- Gerçek kayıt, başvuru, randevu, ödeme ve sağlık hizmeti akışlarını kapalı tutar.
- Demo randevularını ve yönetici kararlarını yalnızca tarayıcıda saklar.
- Supabase ve Sentry'ye demo kullanıcı verisi göndermez.

Canlı site: [gizlibiriz.vercel.app](https://gizlibiriz.vercel.app/)

Hocalara yönelik kısa sunum akışı için `docs/academic-demo-guide.md` dosyasını kullanın.

## Yerel Geliştirme

```bash
npm install
npm run dev
```

`.env.example` dosyasını `.env.local` olarak kopyalayın. Portföy demosu Supabase anahtarı olmadan da çalışır.

## Özellik Kapıları

Varsayılan güvenli ayarlar:

```env
VITE_APP_MODE=demo
VITE_ENABLE_PUBLIC_REGISTRATION=false
VITE_ENABLE_PROFESSIONAL_APPLICATIONS=false
VITE_ENABLE_LIVE_APPOINTMENTS=false
VITE_ENABLE_LIVE_SESSIONS=false
VITE_ENABLE_PAYMENTS=false
```

Gerçek hizmete geçiş yalnızca `VITE_APP_MODE=live` yapılarak tamamlanmaz. İlgili özellik ayrıca açıkça etkinleştirilmeli; hukuki metinler, profesyonel doğrulama, operasyon sorumluları, veri saklama kararı ve ödeme sağlayıcısı gibi üretim gereklilikleri önce tamamlanmalıdır.

`SUPABASE_SERVICE_ROLE_KEY` hiçbir zaman `VITE_` ile başlayan veya istemciye açılan bir ortam değişkenine konulmamalıdır.

## Kalite Kontrolleri

GitHub Actions ile aynı kontroller:

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npm run build
```

Projede Vitest, React Testing Library ve jsdom kullanılır. `main` dalına gönderilen değişikliklerde kalite hattı otomatik çalışır.

## Teknik Mimari

- React 19 ve Vite 8 istemci uygulaması
- Supabase Auth, PostgreSQL, RLS ve özel Storage alanı
- PeerJS/WebRTC tabanlı metin, ses ve bulanık görüntü seans prototipi
- Sentry hata izleme entegrasyonu
- GitHub Actions kalite hattı ve Vercel dağıtımı

Demo modu bu üretim entegrasyonlarını kullanıcı verisi işlemeden, yerel kurgusal durum ile sergiler.

## Veritabanı Kurulumu

Yeni bir Supabase projesinde önce `src/lib/supabase-complete-setup.sql`, ardından `src/lib/migration-009-privacy-boundaries.sql` ile `src/lib/migration-018-brand-defaults.sql` arasındaki artımlı migration dosyalarını sırayla çalıştırın.

Mevcut bir veritabanında `src/lib/migration-006-rls-hardening.sql` ile başlayan eksik migration dosyalarını sıra ile uygulayın. Ardından `src/lib/verify-rls.sql` çalıştırılmalıdır. Son blok, korunan tabloda RLS kapalıysa veya herkese açık görünüm özel kimlik yayıyorsa hata verir.

Güvenlik modeli `docs/security-model.md`, operasyon ve teslim prosedürleri şu dosyalarda belgelenmiştir:

```text
docs/academic-demo-guide.md
docs/backup-recovery.md
docs/backup-log.md
docs/brand-cutover.md
docs/operations-runbook.md
docs/real-device-acceptance.md
docs/release-readiness.md
```

## Canlı Hizmete Geçiş Sınırı

Ödeme bilinçli olarak ertelenmiştir. Ödeme API uçları `503 payments_disabled` döndürür ve kullanıcı arayüzünde etkin ödeme düğmesi bulunmaz. Gelecekteki ödeme uygulaması; çağıranı doğrulamalı, resmi seans ücretini sunucudan okumalı ve ödeme durumunu yalnızca sağlayıcı tarafındaki doğrulamadan sonra güncellemelidir.

Gerçek kullanıcı kabul edilmeden önce hukuk danışmanı onaylı gizlilik/aydınlatma ve kullanım metinleri, veri saklama-silme süreleri, uzman doğrulama sorumlusu, olay ve destek sorumluları, gönderici alan adı ve kapalı pilot kabul planı tamamlanmalıdır.
