import { ALLOW_LOCAL_SIMULATION } from '../config/runtime';

export const SESSION_JOIN_EARLY_MINUTES = 15;
export const SESSION_JOIN_LATE_MINUTES = 90;

export const formatLocalDateIso = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getSessionReference = (sessionId) => {
  const value = String(sessionId || '');
  const demoReferences = {
    'demo-session-privacy': 'DEMO-GZL',
    'demo-session-voice': 'DEMO-SES',
    'demo-session-text': 'DEMO-MTN',
    'demo-session-completed': 'DEMO-TMM',
  };

  if (demoReferences[value]) return demoReferences[value];

  const compact = value.replace(/[^a-z0-9]/gi, '');
  if (!compact) return 'ST-BELIRSIZ';
  if (compact.length <= 8) return compact.toLocaleUpperCase('tr-TR');
  return `${compact.slice(0, 4)}-${compact.slice(-4)}`.toLocaleUpperCase('tr-TR');
};

export const formatCurrency = (amount = 0) => (
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))
);

export const getSessionFee = (psychologist, session) => {
  const explicitFee = Number(session?.fee || session?.price || 0);
  const profileFee = Number(psychologist?.sessionPrice || psychologist?.basePrice || 0);
  return explicitFee || profileFee || 1000;
};

export const getSessionDateTime = (session) => {
  if (!session?.date || !session?.time) return null;
  const [hour = '0', minute = '0'] = String(session.time).split(':');
  const date = new Date(`${session.date}T12:00:00`);
  date.setHours(Number(hour), Number(minute), 0, 0);
  return date;
};

export const getSessionSlotKey = (date, time) => (
  date && time ? `${date}|${time}` : ''
);

export const isSessionSlotInPast = (date, time, now = new Date()) => {
  const startsAt = getSessionDateTime({ date, time });
  return !startsAt || startsAt <= now;
};

export const isSessionSlotBookable = ({
  date,
  time,
  bookedSlotKeys = [],
  now = new Date(),
}) => (
  !isSessionSlotInPast(date, time, now)
  && !bookedSlotKeys.includes(getSessionSlotKey(date, time))
);

export const getSessionJoinState = (session, now = new Date()) => {
  if (!session) {
    return {
      canJoin: false,
      code: 'missing',
      label: 'Randevu bulunamadı',
      helper: 'Bu seans kaydı artık mevcut değil.',
    };
  }

  if (session.status === 'cancelled') {
    return {
      canJoin: false,
      code: 'cancelled',
      label: 'Randevu iptal edildi',
      helper: 'İptal edilen randevular için seans odası açılamaz.',
    };
  }

  if (session.status === 'completed') {
    return {
      canJoin: false,
      code: 'completed',
      label: 'Seans tamamlandı',
      helper: 'Tamamlanan seanslar için değerlendirme adımına geçebilirsiniz.',
    };
  }

  if (session.paymentRequired && session.paymentStatus !== 'paid') {
    return {
      canJoin: false,
      code: 'payment',
      label: 'Ödeme bekleniyor',
      helper: 'Bu randevu için ödeme tamamlanmadan seans odası açılamaz.',
    };
  }

  // TEST ORTAMI İÇİN BYPASS (Saati beklemeden girebilme)
  if (ALLOW_LOCAL_SIMULATION) {
    return {
      canJoin: true,
      code: 'ready',
      label: 'Demo seansına katılabilir',
      helper: 'Portföy demosunda saat kısıtlaması uygulanmaz.',
    };
  }

  const startsAt = getSessionDateTime(session);
  if (!startsAt) {
    return {
      canJoin: false,
      code: 'schedule',
      label: 'Saat bilgisi eksik',
      helper: 'Seans saati netleşmeden oda açılamaz.',
    };
  }

  const openAt = new Date(startsAt.getTime() - SESSION_JOIN_EARLY_MINUTES * 60 * 1000);
  const closeAt = new Date(startsAt.getTime() + SESSION_JOIN_LATE_MINUTES * 60 * 1000);

  if (now < openAt) {
    return {
      canJoin: false,
      code: 'early',
      label: 'Saatini bekliyor',
      helper: `Seans odası randevudan ${SESSION_JOIN_EARLY_MINUTES} dakika önce açılır.`,
    };
  }

  if (now > closeAt) {
    return {
      canJoin: false,
      code: 'expired',
      label: 'Giriş süresi geçti',
      helper: 'Bu randevunun seans giriş penceresi kapandı.',
    };
  }

  return {
    canJoin: true,
    code: 'ready',
    label: 'Seansa katılabilir',
    helper: 'Seans odası hazır.',
  };
};
