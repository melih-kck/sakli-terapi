# Yedekleme ve Geri Dönüş Planı

Bu plan veritabanını ve özel belge dosyalarını birlikte ele alır. Supabase veritabanı yedeği Storage nesnelerinin içeriğini kapsamaz; yalnızca dosya metadatası veritabanında bulunur. Bu nedenle iki kaynak aynı zaman damgasıyla yedeklenmelidir.

## Hedefler

- Kapalı pilot için hedef RPO: en fazla 24 saat veri kaybı.
- Kapalı pilot için hedef RTO: en fazla 4 saat hizmet kesintisi.
- Açık kullanıma geçmeden önce ücretli planda günlük yedek veya PITR kararı verilmelidir.
- Yedekler üretim hesabından ayrı, şifreli ve erişimi sınırlı bir konumda tutulmalıdır.

## Haftalık Yedek

1. Supabase Dashboard > Database > Backups ekranından son yedeğin başarılı olduğunu kontrol edin.
2. Ücretsiz planda veya bağımsız kopya için Supabase CLI ile rol, şema ve veri dökümlerini alın:

```bash
supabase db dump --db-url "$DATABASE_URL" -f roles.sql --role-only
supabase db dump --db-url "$DATABASE_URL" -f schema.sql
supabase db dump --db-url "$DATABASE_URL" -f data.sql --use-copy --data-only \
  -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

3. `psychologist-documents` özel kovasındaki dosyaları S3 uyumlu istemci veya Supabase Storage araçlarıyla dışarı aktarın.
4. Şu dosyaları aynı tarihli, şifreli arşivde saklayın: `roles.sql`, `schema.sql`, `data.sql`, Storage nesneleri, nesne envanteri ve uygulanan migration listesi.
5. Arşivin özet değerini üretip yedek günlüğüne yazın. Gizli anahtarları arşive eklemeyin.

Windows DPAPI ile korunan yerel arşivler yalnızca arşivi oluşturan Windows
kullanıcı profili tarafından açılabilir. Bu nedenle arşivi cihaz dışına
kopyalamak tek başına yeterli değildir; hedef ortamda geri açma testi de yapılmalıdır.
Uygulama içindeki yardımcı komut `scripts/decrypt-backup.ps1` dosyasındadır.

Supabase'in güncel davranışı ve komutları için [Database Backups](https://supabase.com/docs/guides/platform/backups), [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) ve [Download Objects](https://supabase.com/docs/guides/storage/management/download-objects) belgeleri esas alınır.

## Geri Dönüş Provası

Geri dönüş doğrudan üretim projesi üzerinde denenmez.

1. Ayrı bir geçici Supabase projesi oluşturun.
2. Uzantıları ve proje ayarlarını üretimle eşleştirin.
3. Rol, şema ve veri dökümlerini Supabase'in resmi geri yükleme sırasıyla uygulayın.
4. Storage kovasını ve dosyaları geri yükleyin; kovanın `public=false` olduğunu doğrulayın.
5. `src/lib/verify-rls.sql` dosyasını çalıştırın.
6. Danışan, psikolog ve yönetici rol testlerini uygulayın.
7. Rastgele seçilen en az üç belge kaydının nesnesiyle eşleştiğini doğrulayın.
8. Prova tarihini, süresini, sonucu ve bulunan sorunları yedek günlüğüne kaydedin.
9. Geçici projeyi ve geçici kimlik bilgilerini güvenli biçimde kaldırın.

## Olay Anında

1. Yazma işlemlerini durdurun ve olay saatini kaydedin.
2. Sentry, Vercel ve Supabase günlüklerinden etkilenen zaman aralığını belirleyin.
3. Geri dönüş noktasını veri kaybı etkisiyle birlikte onaylayın.
4. Kullanıcılara bakım durumunu bildirin; tahmini süre vermek yerine düzenli durum güncellemesi paylaşın.
5. Veritabanı ve Storage'ı aynı yedek setinden geri yükleyin.
6. RLS doğrulaması ve kritik kabul testleri geçmeden trafiği yeniden açmayın.

## Aylık Kontrol

- Son yedek yaşı 7 günden küçük mü?
- En son geri dönüş provası 90 günden yeni mi?
- Yedek konumuna yalnızca yetkili yönetici erişebiliyor mu?
- Storage envanterinde veritabanı kaydı olmayan veya nesnesi eksik kayıt var mı?
- RPO/RTO hedefleri mevcut kullanıcı hacmi için hâlâ yeterli mi?
