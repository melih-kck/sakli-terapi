import Iyzipay from 'iyzipay';

export default async function handler(req, res) {
  // CORS ayarları (özellikle lokal geliştirme ve farklı originlerden gelecek istekler için)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Preflight request (CORS OPTIONS isteği)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Sadece POST metoduna izin verilir' });
  }

  try {
    // 1. Gerekli verileri al
    const { sessionId, psychologistName, amount, buyerDetails } = req.body;

    if (!sessionId || !amount || !buyerDetails) {
      return res.status(400).json({ success: false, error: 'Eksik parametreler (sessionId, amount, buyerDetails zorunludur)' });
    }

    // 2. Iyzico Konfigürasyonunu Başlat
    const iyzipay = new Iyzipay({
      apiKey: process.env.IYZICO_API_KEY || 'sandbox-api-key',
      secretKey: process.env.IYZICO_SECRET_KEY || 'sandbox-secret-key',
      uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
    });

    // 3. Iyzico Ödeme Formu (Checkout Form) İsteği Oluştur
    // Gerçekte callbackUrl, uygulamanızın canlı (veya ngrok/vercel lokal) adresini göstermelidir.
    const baseUrl = process.env.PUBLIC_URL || (req.headers.origin || 'http://localhost:5173');
    
    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: sessionId, // Seans ID'yi takibi kolaylaştırmak için ekliyoruz
      price: String(amount),
      paidPrice: String(amount),
      currency: Iyzipay.CURRENCY.TRY,
      basketId: 'B67832', // Opsiyonel referans kodu
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: `${baseUrl}/api/payment-callback?sessionId=${sessionId}`, // Ödeme sonrası Iyzico'nun POST yapacağı URL
      enabledInstallments: [2, 3, 6, 9],
      buyer: {
        id: buyerDetails.id, // Supabase'deki user id
        name: buyerDetails.name?.split(' ')[0] || 'Gizli',
        surname: buyerDetails.name?.split(' ').slice(1).join(' ') || 'Danışan',
        gsmNumber: buyerDetails.phone || '+905555555555',
        email: buyerDetails.email,
        identityNumber: '11111111111',
        lastLoginDate: '2026-01-01 12:00:00', // Sadece mock format
        registrationDate: '2026-01-01 12:00:00',
        registrationAddress: buyerDetails.city || 'İstanbul',
        ip: req.headers['x-forwarded-for'] || '85.34.78.112',
        city: buyerDetails.city || 'Istanbul',
        country: 'Turkey',
        zipCode: '34732'
      },
      shippingAddress: {
        contactName: buyerDetails.name || 'Gizli Danışan',
        city: buyerDetails.city || 'Istanbul',
        country: 'Turkey',
        address: 'Dijital Hizmet - Fiziksel Teslimat Yok',
        zipCode: '34732'
      },
      billingAddress: {
        contactName: buyerDetails.name || 'Gizli Danışan',
        city: buyerDetails.city || 'Istanbul',
        country: 'Turkey',
        address: 'Dijital Hizmet - Fiziksel Teslimat Yok',
        zipCode: '34732'
      },
      basketItems: [
        {
          id: `PSY-${sessionId.slice(0, 5)}`,
          name: `${psychologistName || 'Psikolog'} - Psikolojik Danışmanlık Seansı`,
          category1: 'Sağlık',
          category2: 'Psikolojik Danışmanlık',
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: String(amount)
        }
      ]
    };

    // 4. Iyzico'ya İsteği Gönder
    iyzipay.checkoutFormInitialize.create(request, (err, result) => {
      if (err) {
        console.error("Iyzico form initialize error:", err);
        return res.status(500).json({ success: false, error: err.message || 'Ödeme başlatılırken bir hata oluştu' });
      }

      if (result.status === 'failure') {
        console.error("Iyzico failure result:", result);
        return res.status(400).json({ success: false, error: result.errorMessage, details: result });
      }

      // Başarılıysa Checkout Form Token ve HTML döner
      return res.status(200).json({
        success: true,
        token: result.token,
        checkoutFormContent: result.checkoutFormContent,
        paymentPageUrl: result.paymentPageUrl // Alternatif olarak iframe yerine direkt link yönlendirmesi
      });
    });

  } catch (error) {
    console.error("Ödeme başlatma sunucu hatası:", error);
    return res.status(500).json({ success: false, error: 'Sunucu hatası: ' + error.message });
  }
}
