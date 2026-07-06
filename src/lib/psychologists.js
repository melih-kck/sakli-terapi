import { supabase } from './supabase';
import { mockPsychologists } from '../data/mock-psychologists';

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
  if (words.length === 0) return 'GB';
  return words
    .filter(word => !['dr.', 'uzm.', 'psk.'].includes(word.toLocaleLowerCase('tr-TR')))
    .slice(0, 2)
    .map(word => word.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('') || 'GB';
};

const getShortBio = (bio = '') => {
  if (!bio) return 'Gizlilik odaklı çevrimiçi psikolojik danışmanlık.';
  return bio.length > 120 ? `${bio.slice(0, 117)}...` : bio;
};

export const normalizePsychologist = (psychologist) => {
  const name = psychologist.display_name || psychologist.name || psychologist.title || 'GizliBiriz Psikoloğu';
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
  };
};

export const getDemoPsychologists = () => (
  import.meta.env.DEV
    ? mockPsychologists.map(psychologist => (
      normalizePsychologist({ ...psychologist, source: 'demo' })
    ))
    : []
);

export const fetchApprovedPsychologists = async () => {
  const { data, error } = await supabase
    .from('public_psychologists')
    .select('*')
    .order('rating', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizePsychologist);
};

export const fetchApprovedPsychologistById = async (id) => {
  const { data, error } = await supabase
    .from('public_psychologists')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return normalizePsychologist(data);
};
