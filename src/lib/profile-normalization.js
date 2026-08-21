// Shared normalization helpers for psychologist and client profile shapes,
// used by AuthContext (initial profile hydration) and ProfileContext
// (profile updates) so both stay in sync on defaults and field mapping.

export const getInitials = (name = '') => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .filter(word => !['dr.', 'uzm.', 'psk.'].includes(word.toLocaleLowerCase('tr-TR')))
    .slice(0, 2)
    .map(word => word.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('') || 'ST';
};

export const DEFAULT_PSYCHOLOGIST_PROFILE = {
  title: 'Psikolog',
  bio: '',
  shortBio: '',
  experience: 0,
  basePrice: 1000,
  specializations: [],
  approaches: [],
  channels: ['video-blur', 'voice', 'text'],
  availability: {},
  languages: ['Türkçe'],
  university: '',
  supervisor: '',
  isCandidate: false,
  approvalStatus: 'pending',
  rating: 0,
  reviewCount: 0,
  sessionCount: 0,
};

export const DEFAULT_CLIENT_PROFILE = {
  topics: [],
  preferredChannel: 'video-blur',
  emergencyName: '',
  emergencyPhone: '',
  city: '',
  privacyLevel: 5,
};

export const normalizePsychologistProfile = (profile = {}) => ({
  displayName: profile.display_name || profile.displayName || '',
  avatarInitials:
    profile.avatar_initials ||
    profile.avatarInitials ||
    getInitials(profile.display_name || profile.displayName || ''),
  title: profile.title || DEFAULT_PSYCHOLOGIST_PROFILE.title,
  bio: profile.bio || '',
  shortBio: profile.short_bio || profile.shortBio || '',
  experience: Number(profile.experience || 0),
  basePrice: Number(profile.base_price ?? profile.basePrice ?? DEFAULT_PSYCHOLOGIST_PROFILE.basePrice),
  specializations: profile.specializations || [],
  approaches: profile.approaches || [],
  channels: profile.channels?.length
    ? profile.channels
    : DEFAULT_PSYCHOLOGIST_PROFILE.channels,
  availability: profile.availability || {},
  languages: profile.languages?.length
    ? profile.languages
    : DEFAULT_PSYCHOLOGIST_PROFILE.languages,
  university: profile.university || '',
  supervisor: profile.supervisor || '',
  isCandidate: Boolean(profile.is_candidate ?? profile.isCandidate),
  approvalStatus:
    profile.approval_status || profile.approvalStatus || DEFAULT_PSYCHOLOGIST_PROFILE.approvalStatus,
  reviewReason: profile.review_reason || profile.reviewReason || '',
  reviewedAt: profile.reviewed_at || profile.reviewedAt || null,
  rating: Number(profile.rating || 0),
  reviewCount: Number(profile.review_count ?? profile.reviewCount ?? 0),
  sessionCount: Number(profile.session_count ?? profile.sessionCount ?? 0),
});

export const normalizeClientProfile = (profile = {}) => ({
  topics: profile.topics || profile.clientTopics || DEFAULT_CLIENT_PROFILE.topics,
  preferredChannel: profile.preferred_channel || profile.preferredChannel || DEFAULT_CLIENT_PROFILE.preferredChannel,
  emergencyName: profile.emergency_name || profile.emergencyName || '',
  emergencyPhone: profile.emergency_phone || profile.emergencyPhone || '',
  city: profile.city || '',
  privacyLevel: Number(profile.privacy_level ?? profile.privacyLevel ?? DEFAULT_CLIENT_PROFILE.privacyLevel),
});
