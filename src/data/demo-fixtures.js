const dateKey = (offsetDays = 0) => {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
};

const timeKey = (offsetHours = 0) => {
  const value = new Date();
  value.setHours(value.getHours() + offsetHours, 0, 0, 0);
  return value.toTimeString().slice(0, 5);
};

export const createDemoSessions = () => ([
  {
    id: 'demo-session-privacy',
    clientId: 'mock-client',
    psychologistId: 'mock-psychologist',
    clientAlias: 'Mavi Defter',
    psychologistName: 'Klinik Psikolog Demo Uzmanı',
    psychologistInitials: 'DU',
    date: dateKey(),
    time: timeKey(),
    channel: 'video-blur',
    status: 'upcoming',
    paymentStatus: 'not-required',
    paymentRequired: false,
    reviewed: false,
    fee: 0,
  },
  {
    id: 'demo-session-voice',
    clientId: 'mock-client',
    psychologistId: 'mock-psychologist',
    clientAlias: 'Mavi Defter',
    psychologistName: 'Klinik Psikolog Demo Uzmanı',
    psychologistInitials: 'DU',
    date: dateKey(2),
    time: '14:00',
    channel: 'voice',
    status: 'upcoming',
    paymentStatus: 'not-required',
    paymentRequired: false,
    reviewed: false,
    fee: 0,
  },
  {
    id: 'demo-session-completed',
    clientId: 'mock-client',
    psychologistId: 'mock-psychologist',
    clientAlias: 'Mavi Defter',
    psychologistName: 'Klinik Psikolog Demo Uzmanı',
    psychologistInitials: 'DU',
    date: dateKey(-7),
    time: '11:00',
    channel: 'text',
    status: 'completed',
    paymentStatus: 'not-required',
    paymentRequired: false,
    reviewed: true,
    fee: 0,
    completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
]);

const baseUser = {
  sessions: [],
  moodHistory: [],
  reviews: [],
  privacyLevel: 5,
  isDemo: true,
};

export const createDemoUser = (role) => {
  const sessions = createDemoSessions();

  if (role === 'psychologist') {
    return {
      ...baseUser,
      id: 'mock-psychologist',
      email: 'uzman@demo.sakliterapi.local',
      role,
      name: 'Klinik Psikolog Demo Uzmanı',
      sessions,
      psychologistProfile: {
        displayName: 'Klinik Psikolog Demo Uzmanı',
        avatarInitials: 'DU',
        title: 'Klinik Psikolog',
        bio: 'Bu profil, uzman paneli ve randevu yönetimi akışlarını göstermek için hazırlanmış kurgusal bir demo kaydıdır.',
        shortBio: 'Kurgusal uzman paneli demonstrasyonu.',
        experience: 7,
        basePrice: 0,
        specializations: ['anxiety', 'stress', 'self-esteem'],
        approaches: ['cbt', 'act'],
        channels: ['video-blur', 'voice', 'text'],
        availability: {},
        languages: ['Türkçe'],
        university: 'Kurgusal Demo Üniversitesi',
        supervisor: '',
        isCandidate: false,
        approvalStatus: 'approved',
        reviewReason: '',
        rating: 4.8,
        reviewCount: 24,
        sessionCount: 118,
      },
      clientProfile: null,
    };
  }

  if (role === 'admin') {
    return {
      ...baseUser,
      id: 'mock-admin',
      email: 'yonetici@demo.sakliterapi.local',
      role,
      name: 'Demo Yöneticisi',
      alias: null,
      clientProfile: null,
      psychologistProfile: null,
    };
  }

  return {
    ...baseUser,
    id: 'mock-client',
    email: 'danisan@demo.sakliterapi.local',
    role: 'client',
    alias: 'Mavi Defter',
    sessions,
    moodHistory: [
      { date: dateKey(-4), mood: 3 },
      { date: dateKey(-3), mood: 4 },
      { date: dateKey(-2), mood: 3 },
      { date: dateKey(-1), mood: 4 },
    ],
    clientProfile: {
      topics: ['anxiety', 'stress'],
      preferredChannel: 'video-blur',
      emergencyName: '',
      emergencyPhone: '',
      city: '',
      privacyLevel: 5,
    },
    psychologistProfile: null,
  };
};

export const DEMO_ROLE_OPTIONS = Object.freeze([
  {
    role: 'client',
    title: 'Danışan deneyimi',
    description: 'Uzman keşfi, randevu, gizlilik tercihleri ve seans odası akışını inceleyin.',
    destination: '/panel',
  },
  {
    role: 'psychologist',
    title: 'Uzman deneyimi',
    description: 'Takvim, danışan rumuzları, seans yönetimi ve profil araçlarını inceleyin.',
    destination: '/psikolog-panel',
  },
  {
    role: 'admin',
    title: 'Yönetici deneyimi',
    description: 'Kurgusal belge doğrulama, başvuru kararı ve denetim kaydı akışını inceleyin.',
    destination: '/admin',
  },
]);
