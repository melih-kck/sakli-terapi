# Saklı Terapi Marka Geçişi

Son güncelleme: 26 Temmuz 2026

## Tamamlananlar

- [x] Kullanıcıya görünen marka adı, sayfa başlıkları ve uygulama metinleri Saklı Terapi olarak güncellendi.
- [x] Marka sabitleri `src/config/brand.js` altında merkezileştirildi.
- [x] `migration-018-brand-defaults.sql` üretim veritabanında çalıştırıldı.
- [x] GitHub depo adı ve kamuya açık proje belgeleri Saklı Terapi markasına hazırlandı.
- [x] Vercel proje adı, varsayılan üretim adresi ve `PUBLIC_APP_URL` için `sakli-terapi` adı esas alındı.
- [x] Lint, otomatik test, üretim derlemesi ve bağımlılık güvenlik denetimi yayın öncesi kontrol zincirine alındı.

## Alan Adı Alındıktan Sonra

1. Alan adını proje sahibinin kendi hesabı ve iletişim bilgileriyle kaydedin; MFA ve otomatik yenilemeyi etkinleştirin.
2. Alan adını Vercel projesine ekleyin ve `www`/çıplak alan adı yönlendirmesini tek bir ana adrese sabitleyin.
3. Vercel SSL sertifikası hazır olduktan sonra üretim ana adresini doğrulayın.
4. Supabase Auth `Site URL` ve izin verilen yönlendirme adreslerine yeni HTTPS adresini ekleyin.
5. Alan adını e-posta sağlayıcısında doğrulayın; SPF ve DKIM kayıtlarının geçtiğini kontrol edin.
6. `EMAIL_FROM`, `PUBLIC_APP_URL`, `VITE_SUPPORT_EMAIL` ve `VITE_CONTACT_EMAIL` üretim değişkenlerini gerçek alan adı adresleriyle güncelleyin.
7. Yeni dağıtımı tetikleyin; kayıt, giriş, parola sıfırlama, bildirim bağlantısı ve e-posta teslimatını uçtan uca sınayın.
8. Eski Vercel adresinin yeni ana adrese yönlendiğini doğrulayın.

## Bilinçli Olarak Bekleyenler

- Özel alan adı satın alma ve DNS bağlantısı
- Alan adına bağlı destek ve gönderici e-posta adresleri
- Sosyal medya kullanıcı adlarının alınması
- Marka vekiliyle TÜRKPATENT uygunluk ve tescil süreci
- Gerçek kullanıcı kabulü için gerekli hukuki, klinik ve operasyonel onaylar

Özel alan adı alınana kadar ana üretim adresi `https://sakli-terapi.vercel.app` olarak kullanılacaktır. Hosting, ücretli SSL, site kurucu veya premium DNS paketi satın almak bu portföy sürümü için gerekli değildir.
