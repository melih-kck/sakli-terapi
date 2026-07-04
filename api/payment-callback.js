import Iyzipay from 'iyzipay';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Sadece POST metoduna izin verilir' });
  }

  try {
    // 1. Iyzico'dan dönen token'ı al
    const { token } = req.body;
    const { sessionId } = req.query; // callbackUrl'de parametre olarak verdik

    if (!token) {
      return res.status(400).send('Ödeme tokeni bulunamadı.');
    }

    // 2. Iyzico Konfigürasyonunu Başlat
    const iyzipay = new Iyzipay({
      apiKey: process.env.IYZICO_API_KEY || 'sandbox-api-key',
      secretKey: process.env.IYZICO_SECRET_KEY || 'sandbox-secret-key',
      uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
    });

    // 3. Iyzico'dan Ödeme Sonucunu Sorgula
    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: sessionId,
      token: token
    };

    return new Promise((resolve) => {
      iyzipay.checkoutForm.retrieve(request, async (err, result) => {
        if (err || result.status !== 'success' || result.paymentStatus !== 'SUCCESS') {
          console.error("Ödeme başarısız:", err || result.errorMessage);
          // Kullanıcıyı frontend üzerinde başarısız sayfasına yönlendir (örn: /odeme-basarisiz)
          // Bu endpoint tarayıcı tarafından (form submit) çağrıldığı için HTML/Redirect dönmeliyiz.
          res.redirect(302, `/panel?payment=failed&reason=${encodeURIComponent(result?.errorMessage || 'Bilinmeyen Hata')}`);
          return resolve();
        }

        // 4. ÖDEME BAŞARILI! Supabase'i Güncelle
        // Backend'de RLS'yi atlamak için Service Role Key kullanılmalı!
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY; 
        
        if (supabaseUrl && supabaseServiceKey && sessionId) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          
          const { error: updateError } = await supabase
            .from('sessions')
            .update({
              payment_status: 'paid',
              paid_at: new Date().toISOString()
            })
            .eq('id', sessionId);

          if (updateError) {
            console.error("Supabase payment update error:", updateError);
            // Uyarı: Ödeme alındı ama veritabanı güncellenemedi! 
            // Gerçek projede bunu Discord/Slack'e loglamak iyi olur.
          }
        }

        // 5. Başarılı Sayfasına Yönlendir
        res.redirect(302, `/panel?payment=success&session=${sessionId}`);
        resolve();
      });
    });

  } catch (error) {
    console.error("Callback hatası:", error);
    res.status(500).send("Sunucu hatası oluştu.");
  }
}
