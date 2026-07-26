import { supabase } from './supabase';
import { mockPsychologists } from '../data/mock-psychologists';
import { BRAND } from '../config/brand';
import { IS_DEMO_MODE } from '../config/runtime';

const ALLOWED_CHANNELS = ['text', 'voice', 'video-blur'];

const DEFAULT_AVAILABILITY = {
  Pazartesi: ['09:00', '10:00', '11:00', '14:00', '15:00'],
  Salı: ['09:00', '10:00', '14:00', '15:00'],
  Çarşamba: ['10:00', '11:00', '14:00'],
  Perşembe: ['09:00', '10:00', '11:00', '14:00'],
  Cuma: ['09:00', '10:00', '11:00'],
};

const getInitials = (name = '') => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'ST';
  return words
    .filter(word => !['dr.', 'uzm.', 'psk.'].includes(word.toLocaleLowerCase('tr-TR')))
    .slice(0, 2)
    .map(word => word.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('') || 'ST';
};

const getShortBio = (bio = '') => {
  if (!bio) return 'Gizlilik odaklı çevrimiçi psikolojik danışmanlık.';
  return bio.length > 120 ? `${bio.slice(0, 117)}...` : bio;
};

export const normalizePsychologist = (psychologist) => {
  const name = psychologist.display_name || psychologist.name || psychologist.title || `${BRAND.name} Psikoloğu`;
  const channels = (psychologist.channels?.length ? psychologist.channels : ['video-blur', 'voice', 'text'])
    .filter(channel => ALLOWED_CHANNELS.includes(channel));

  return {
    id: psychologist.id,
    name,
    title: psychologist.title || (psychologist.is_candidate ? 'Aday Psikolog' : 'Psikolog'),
    isCandidate: Boolean(psychologist.is_candidate ?? psychologist.isCandidate),
    avatar: psychologist.avatar || null,
    initials: psychologist.avatar_initials || psychologist.initials || getInitials(name),
    experience: Number(psychologist.experience || 0),
    rating: Number(psychologist.rating || 0),
    reviewCount: Number(psychologist.review_count ?? psychologist.reviewCount ?? 0),
    sessionCount: Number(psychologist.session_count ?? psychologist.sessionCount ?? 0),
    specializations: psychologist.specializations || [],
    approaches: psychologist.approaches || [],
    bio: psychologist.bio || psychologist.shortBio || 'Bu psikolog profili yakında detaylandırılacak.',
    shortBio: psychologist.short_bio || psychologist.shortBio || getShortBio(psychologist.bio),
    availability: psychologist.availability || DEFAULT_AVAILABILITY,
    channels: channels.length > 0 ? channels : ['video-blur'],
    isAvailable: psychologist.is_available ?? psychologist.isAvailable ?? true,
    sessionPrice: Number(psychologist.base_price ?? psychologist.sessionPrice ?? 0),
    languages: psychologist.languages || ['Türkçe'],
    supervisor: psychologist.supervisor || null,
    university: psychologist.university || null,
    source: psychologist.source || 'supabase',
    isDemo: psychologist.source === 'demo' || Boolean(psychologist.isDemo),
  };
};

const DEMO_PROFILE_NAMES = [
  'Klinik Psikolog Demo 01',
  'Klinik Psikolog Demo 02',
  'Klinik Psikolog Demo 03',
  'Klinik Psikolog Demo 04',
  'Klinik Psikolog Demo 05',
  'Klinik Psikolog Demo 06',
  'Klinik Psikolog Demo 07',
  'Klinik Psikolog Demo 08',
  'Klinik Psikolog Demo 09',
  'Klinik Psikolog Demo 10',
  'Klinik Psikolog Demo 11',
  'Klinik Psikolog Demo 12',
  'Aday Profil Demo 13',
  'Aday Profil Demo 14',
  'Aday Profil Demo 15',
];

export const getDemoPsychologists = () => (
  IS_DEMO_MODE || import.meta.env.DEV
    ? mockPsychologists.map(psychologist => (
      normalizePsychologist({
        ...psychologist,
        name: DEMO_PROFILE_NAMES[Number(psychologist.id) - 1] || `Kurgusal Uzman ${psychologist.id}`,
        title: psychologist.isCandidate ? 'Aday Profil' : 'Klinik Psikolog',
        bio: 'Bu profil, uzman keşfi ve randevu akışlarını göstermek için hazırlanmış tamamen kurgusal bir demo kaydıdır. Herhangi bir gerçek kişi, diploma, kurum veya mesleki yetkinlik iddiasını temsil etmez.',
        shortBio: 'Kurgusal demo profili. Uzman keşfi akışını göstermek için hazırlanmıştır.',
        university: psychologist.isCandidate ? 'Kurgusal eğitim kurumu' : null,
        supervisor: psychologist.isCandidate ? 'Kurgusal demo süpervizörü' : null,
        source: 'demo',
        isDemo: true,
      })
    ))
    : []
);

export const fetchApprovedPsychologists = async () => {
  if (IS_DEMO_MODE) return getDemoPsychologists();

  const { data, error } = await supabase
    .from('public_psychologists')
    .select('*')
    .order('rating', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizePsychologist);
};

export const fetchApprovedPsychologistById = async (id) => {
  if (IS_DEMO_MODE) {
    const psychologist = getDemoPsychologists().find(item => String(item.id) === String(id));
    if (!psychologist) throw new Error('Demo profili bulunamadı.');
    return psychologist;
  }

  const { data, error } = await supabase
    .from('public_psychologists')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return normalizePsychologist(data);
};
