# Yedek Günlüğü

Bu belge, üretim kurtarma sürecinin kamuya açıklanabilir özetidir. Proje kimlikleri, bağlantı bilgileri ve yerel güvenlik ayrıntıları bilerek yayımlanmamıştır.

## 18 Temmuz 2026 - İlk Üretim Yedeği

- Kaynak: üretimden ayrı erişim kontrollerine sahip Supabase projesi
- Veritabanı: PostgreSQL 17.6
- Döküm aracı: PostgreSQL 17.10
- Kapsam: roller, uygulama şeması, Auth/Storage dahil veri dökümü ve özel belge kovasındaki nesneler
- Storage doğrulaması: nesne sayısı ve dosya boyutları veritabanı metadata kayıtlarıyla eşleştirildi
- Arşiv: kullanıcıya özel, DPAPI ile şifrelenmiş yerel yedek
- Koruma: Windows DPAPI `CurrentUser`; yalnızca yedeği oluşturan Windows kullanıcı profili açabilir
- Doğrulama: şifreli arşiv geri açıldı; manifestteki dosyaların boyut ve SHA-256 değerleri doğrulandı
- Düz metin SQL, belge ve geçici doğrulama kopyaları kontrolden sonra silindi
- Geri dönüş provası: üretimden ayrı geçici bir Supabase projesinde tamamlandı

## 18 Temmuz 2026 - Geri Dönüş Provası

- Roller, şema ve veri dökümleri PostgreSQL 17.6 hedefe PostgreSQL 17.10 istemcisiyle geri yüklendi
- Auth kullanıcıları, profiller, uzman kayıtları, seanslar ve doğrulama belgeleri örneklem üzerinden doğrulandı
- `migration-006` ile `migration-017` arasındaki güvenlik migration'ları yeniden uygulandı
- Güvenlik sonucu: uygulama tablolarında RLS açık, `anon` özel katalog tablolarını okuyamıyor ve belge kovası private
- Storage sonucu: yedek nesneleri yeniden yüklendi ve belge kayıtlarının fiziksel nesnelerle eşleştiği doğrulandı
- Sonuç: prova başarılı; üretim projesinde değişiklik yapılmadı
- Temizlik: geçici bağlantı parolaları, çözülmüş yerel kopyalar ve geri dönüş projesi prova sonrasında kaldırıldı

Şifreli arşivin kesin yolu, parolalar ve proje kimlikleri yalnızca proje sahibinin özel operasyon notlarında tutulur. Yerel yedek cihaz arızasına karşı tek başına yeterli değildir; gerçek kullanıcılarla kapalı pilot başlamadan önce şifreli kopya ayrı ve güvenilir bir depoya alınmalıdır.
