# Gerçek Cihaz Kabul Testi

Bu matris, otomatik tarayıcı testlerinin kapsamadığı kamera, mikrofon, izin ve ağ davranışlarını doğrular. Her satırda cihaz, işletim sistemi, tarayıcı sürümü, tarih ve sonucu kaydedin.

## Zorunlu Matris

| Rol | Cihaz | Tarayıcı | Ağ |
| --- | --- | --- | --- |
| Danışan | iPhone | Safari | Mobil veri |
| Danışan | Android telefon | Chrome | Wi-Fi |
| Psikolog | Windows/macOS bilgisayar | Chrome veya Edge | Wi-Fi/kablolu |

## Test Akışı

1. Danışan ve psikolog ayrı gerçek hesaplarla giriş yapar.
2. Psikolog belge yükler; yönetici belgenin yalnızca güvenli bağlantıyla açıldığını ve profil onay kapısını doğrular.
3. Danışan gelecekteki bir randevu oluşturur; iki panelde de aynı tarih, saat ve kanal görünür.
4. Kamera ve mikrofon izinleri ilk istemde verilir; reddedildiğinde ekran kullanılabilir hata gösterir.
5. Sesli görüşmede iki yönde ses, sessize alma ve görüşmeden ayrılma doğrulanır.
6. Bulanık görüntülü görüşmede danışan görüntüsünün gerçekten bulanık olduğu, psikolog görüntüsünün normal kaldığı doğrulanır.
7. Kamera kapatma/açma, mikrofon kapatma/açma ve ağ değişimi sonrası toparlanma test edilir.
8. Yazılı görüşmede iki yönde mesaj ve yeniden yükleme sonrası oturum erişimi kontrol edilir.
9. Psikolog görüşmeyi tamamlar; danışan değerlendirme bırakabilir.
10. Çıkış sonrasında önceki kullanıcının özel ekranlarına geri tuşuyla erişilemediği kontrol edilir.

## Kabul Ölçütü

- P1 veya P2 hata olmamalıdır.
- Ses ve görüntüde iki yönlü bağlantı kurulmalıdır.
- Danışan bulanıklığı karşı taraf ekranında doğrulanmalıdır.
- İzin reddi ve ağ kesintisi uygulamayı kilitlememelidir.
- Özel belge genel URL ile açılamamalıdır.
- Bulunan her hata Sentry kaydı, tekrar adımları ve cihaz bilgisiyle raporlanmalıdır.
