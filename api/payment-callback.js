export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Allow', 'POST');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Sadece POST metoduna izin verilir.' });
  }

  return res.status(503).json({
    success: false,
    code: 'payments_disabled',
    error: 'Ödeme geri çağrıları henüz etkin değil.',
  });
}
