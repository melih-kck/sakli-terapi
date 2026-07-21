# Saklı Terapi Marka Geçişi

Son güncelleme: 21 Temmuz 2026

## Tamamlananlar

- [x] Kullanıcıya görünen marka adı, sayfa başlıkları ve uygulama metinleri Saklı Terapi olarak güncellendi.
- [x] Marka sabitleri `src/config/brand.js` altında merkezileştirildi.
- [x] `migration-018-brand-defaults.sql` üretim veritabanında çalıştırıldı (proje sahibi onayı, 21 Temmuz 2026).
- [x] Lint, 64 otomatik test, üretim derlemesi ve bağımlılık güvenlik denetimi geçti.
- [x] Vercel üretim dağıtımı yeni marka başlığıyla erişilebilir durumda.

## Alan Adı Alındıktan Sonra

Bu adımlar aşağıdaki sırayla uygulanmalıdır:

1. Alan adını proje sahibinin kendi hesabı ve iletişim bilgileriyle kaydedin; MFA ve otomatik yenilemeyi etkinleştirin.
2. Alan adını Vercel projesine ekleyin ve `www`/çıplak alan adı yönlendirmesini tek bir ana adrese sabitleyin.
3. Vercel SSL sertifikası hazır olduktan sonra üretim ana adresini doğrulayın.
4. Supabase Auth `Site URL` ve izin verilen yönlendirme adreslerine yeni HTTPS adresini ekleyin. Eski Vercel adresini geçiş testleri tamamlanana kadar kaldırmayın.
5. Alan adını Resend'de doğrulayın; SPF ve DKIM kayıtlarının geçtiğini kontrol edin.
6. `EMAIL_FROM`, `PUBLIC_APP_URL`, `VITE_SUPPORT_EMAIL` ve `VITE_CONTACT_EMAIL` üretim değişkenlerini gerçek alan adı adresleriyle güncelleyin.
7. Yeni dağıtımı tetikleyin; kayıt, giriş, parola sıfırlama, bildirim bağlantısı ve e-posta teslimatını uçtan uca sınayın.
8. Eski Vercel adresinin yeni ana adrese yönlendiğini doğrulayın.

## Bilinçli Olarak Bekleyenler

- Alan adı satın alma ve DNS bağlantısı
- Alan adına bağlı destek ve gönderici e-posta adresleri
- GitHub depo ve Vercel proje adının isteğe bağlı olarak yeniden adlandırılması
- Sosyal medya kullanıcı adlarının alınması
- Marka vekiliyle TÜRKPATENT uygunluk ve tescil süreci

Alan adı bağlanana kadar `https://gizlibiriz.vercel.app` çalışan üretim adresi ve `PUBLIC_APP_URL` değeri olarak korunmalıdır. Hosting, ücretli SSL, site kurucu veya premium DNS paketi satın almak bu proje için gerekli değildir.
