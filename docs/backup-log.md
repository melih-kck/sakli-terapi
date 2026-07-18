# Yedek Günlüğü

## 18 Temmuz 2026 - İlk Üretim Yedeği

- Kaynak proje: `mdwuaufrraafdcyzvuzg`
- Veritabanı: PostgreSQL 17.6
- Döküm aracı: PostgreSQL 17.10
- Kapsam: roller, uygulama şeması, Auth/Storage dahil veri dökümü ve `psychologist-documents` kovasındaki 1 nesne
- Storage doğrulaması: 1 nesne, 16.921 bayt; veritabanı metadatasındaki boyutla eşleşti
- Arşiv: `Documents/GizliBiriz-Backups/GizliBiriz-backup-20260718-103909.zip.dpapi`
- Arşiv SHA-256: `E41C67C98D1A62B9C1C2E9259EAC77BB6EE6FCB5024D3435FAC2781725D566BA`
- Koruma: Windows DPAPI `CurrentUser`; yalnızca yedeği oluşturan Windows kullanıcı profili açabilir
- Doğrulama: şifreli arşiv geri açıldı; manifestteki 4 asıl dosyanın boyut ve SHA-256 değerleri birebir eşti
- Düz metin SQL, PDF ve geçici doğrulama kopyaları kontrolden sonra silindi
- Geri dönüş provası: aşağıdaki geçici proje provasıyla tamamlandı

## 18 Temmuz 2026 - Geri Dönüş Provası

- Hedef proje: `irxsbxtiajuumrmxwrmh` (`GizliBiriz Restore Drill 20260718`), üretimden ayrı geçici Supabase projesi
- Roller, şema ve veri dökümleri PostgreSQL 17.6 hedefe PostgreSQL 17.10 istemcisiyle geri yüklendi
- Veri kontrolü: 4 Auth kullanıcısı, 4 profil, 1 psikolog, 2 seans ve 1 doğrulama belgesi kaydı geri geldi
- Temiz Supabase projesinin varsayılan tablo yetkileri nedeniyle ilk `verify-rls.sql` çalışması özel katalog erişiminde durdu
- `migration-006` ile `migration-017` arasındaki güvenlik migration'ları yeniden uygulandı; ikinci doğrulama geçti
- Güvenlik sonucu: 11/11 uygulama tablosunda RLS açık, `anon` özel katalog tablolarını okuyamıyor ve belge kovası private
- Storage sonucu: yedekteki tek PDF yeniden yüklendi; belge kaydı gerçek nesneyle eşleştirildi, nesne sayısı 1 ve boyut 16.921 bayt
- Dashboard yüklemesi mevcut metadata yoluna ` (1)` eklediği için geçici projedeki belge yolu yeni nesneyle uzlaştırıldı ve fiziksel karşılığı olmayan eski metadata satırı kaldırıldı
- Sonuç: prova başarılı; üretim projesinde hiçbir değişiklik yapılmadı

DPAPI arşivini açmak için aynı Windows kullanıcı hesabında:

```powershell
.\scripts\decrypt-backup.ps1 -InputPath "$HOME\Documents\GizliBiriz-Backups\GizliBiriz-backup-20260718-103909.zip.dpapi"
```

Bu yerel kopya cihaz arızasına karşı tek başına yeterli değildir. Kapalı pilot başlamadan önce şifreli arşiv ayrı bir fiziksel veya kurumsal depoya kopyalanmalı ve o ortamda kurtarılabilirliği yeniden doğrulanmalıdır.
