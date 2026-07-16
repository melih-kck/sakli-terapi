# Operasyon El Kitabı

## Günlük Kontrol

1. Vercel üretim dağıtımının başarılı ve ana sayfanın erişilebilir olduğunu kontrol edin.
2. Sentry'de yeni kritik hata, artan hata oranı veya tekrarlayan oturum sorunu olup olmadığını inceleyin.
3. Supabase Auth, Database ve Storage durumunu kontrol edin.
4. Yönetici panelinde bekleyen psikolog belgelerini ve başvuruları inceleyin.
5. Açık destek taleplerini ve hesap silme taleplerini kayda alın.

## Yönetici Güvenliği

- Üretimde yalnızca görevli hesaplar `admin` rolüne sahip olmalıdır.
- Yönetici e-postası kişisel olmayan, yalnızca bu hizmet için kullanılan bir adres olmalıdır.
- En az 16 karakterlik benzersiz parola ve parola yöneticisi kullanılmalıdır.
- Supabase, GitHub, Vercel, Sentry ve Resend hesaplarında MFA zorunlu olmalıdır.
- Uygulama yöneticileri `/admin` erişiminden önce Supabase Auth TOTP ile AAL2 seviyesine çıkmalıdır.
- Kurtarma kodları çevrimdışı ve şifreli biçimde saklanmalıdır.
- Paylaşılan yönetici hesabı kullanılmamalı; yeni yönetici gerektiğinde ayrı hesap açılmalıdır.
- Yönetici rolü ve erişim kayıtları ayda bir kontrol edilmelidir.

## Psikolog Doğrulama

1. Belgeyi yönetici panelindeki kısa süreli güvenli bağlantıyla açın.
2. Ad, kurum, mezuniyet/üyelik bilgisi ve belgenin bütünlüğünü kontrol edin.
3. Aday psikologlarda öğrenci belgesi ve süpervizör bilgisini birlikte değerlendirin.
4. Uygunsa belgeyi onaylayın. En az bir belge onaylanmadan profil etkinleştirilemez.
5. Belge yetersizse kişisel veri içermeyen, açıklayıcı bir ret nedeni yazın.
6. Son onaylı belge geri çekilecekse önce psikolog profilini gerekçeyle askıya alın.
7. Belgeleri cihazınıza indirmeyin; zorunlu indirme olduysa işlem sonunda güvenli biçimde kaldırın.

## Olay Seviyeleri

- P1: Yetkisiz veri erişimi, kimlik bilgisi sızıntısı, hizmetin tamamen çalışmaması.
- P2: Randevu/seans akışının önemli bölümünde bozulma, belge erişim hatası, yaygın giriş sorunu.
- P3: Tek kullanıcıyı etkileyen hata, görsel bozulma veya gecikmeli bildirim.

## Olay Müdahalesi

1. Olayı, başlangıç saatini, kapsamı ve sorumluyu kaydedin.
2. Gerekirse Vercel dağıtımını önceki doğrulanmış sürüme alın veya etkilenen özelliği kapatın.
3. Anahtar sızıntısında ilgili anahtarı derhal döndürün; istemciye servis rolü anahtarı koymayın.
4. Veri bütünlüğü riski varsa yazma işlemlerini durdurun ve `backup-recovery.md` planını uygulayın.
5. Etkilenen kullanıcıları, yasal bildirim gerekliliklerini ve destek mesajını değerlendirin.
6. Olay sonrası kök neden, düzeltme, tekrar önleme ve sorumlu/tarih bilgisiyle kısa rapor yazın.

## Sürüm Alma

1. `npm audit --omit=dev --audit-level=high`, `npm run lint`, `npm test` ve `npm run build` çalışmalıdır.
2. Yeni migration önce yedek/geri dönüş planı kontrol edilerek uygulanmalıdır.
3. `src/lib/verify-rls.sql` migration sonrasında çalıştırılmalıdır.
4. Vercel üretim dağıtımı, giriş ve rol yönlendirmeleri kontrol edilmelidir.
5. Kritik kullanıcı akışları `real-device-acceptance.md` ile doğrulanmalıdır.
6. Sürüm etiketi, migration numarası ve doğrulayan kişi kayıt altına alınmalıdır.

## Dış Bağımlılıklar

- Ödeme: Bilinçli olarak kapalı; ödeme API'leri `503 payments_disabled` döndürür.
- Operasyon e-postası: Alan adı ve doğrulanmış gönderici olmadan devreye alınmaz.
- Hukuk: Gizlilik politikası ve kullanım koşulları açık kullanımdan önce Türkiye'de yetkili hukuk danışmanı tarafından incelenmelidir.
