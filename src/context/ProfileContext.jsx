/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastContext';

// ─── Context ──────────────────────────────────────────────────────────────────
const ProfileContext = createContext(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (name = '') => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .filter(word => !['dr.', 'uzm.', 'psk.'].includes(word.toLocaleLowerCase('tr-TR')))
    .slice(0, 2)
    .map(word => word.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('') || 'GB';
};

// ─── Local-storage utilities ──────────────────────────────────────────────────



const writeLocalJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const getClientProfileKey = (userId) => `gizlibiriz-client-profile-${userId}`;
const getClientMoodKey = (userId) => `gizlibiriz-client-mood-${userId}`;

// ─── Default shapes ──────────────────────────────────────────────────────────

const DEFAULT_PSYCHOLOGIST_PROFILE = {
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

const DEFAULT_CLIENT_PROFILE = {
  topics: [],
  preferredChannel: 'video-blur',
  emergencyName: '',
  emergencyPhone: '',
  city: '',
  privacyLevel: 5,
};

// ─── Normalization ────────────────────────────────────────────────────────────

const normalizePsychologistProfile = (profile = {}) => ({
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
  rating: Number(profile.rating || 0),
  reviewCount: Number(profile.review_count ?? profile.reviewCount ?? 0),
  sessionCount: Number(profile.session_count ?? profile.sessionCount ?? 0),
});

const normalizeClientProfile = (profile = {}) => ({
  topics: profile.topics || profile.clientTopics || DEFAULT_CLIENT_PROFILE.topics,
  preferredChannel: profile.preferred_channel || profile.preferredChannel || DEFAULT_CLIENT_PROFILE.preferredChannel,
  emergencyName: profile.emergency_name || profile.emergencyName || '',
  emergencyPhone: profile.emergency_phone || profile.emergencyPhone || '',
  city: profile.city || '',
  privacyLevel: Number(profile.privacy_level ?? profile.privacyLevel ?? DEFAULT_CLIENT_PROFILE.privacyLevel),
});

// ─── Payload builders (camelCase → snake_case) ────────────────────────────────

const toProfileUpdatePayload = (updates) => {
  const payload = {};
  if (updates.name !== undefined) payload.name = updates.name || null;
  if (updates.alias !== undefined) payload.alias = updates.alias || null;
  if (updates.privacyLevel !== undefined) payload.privacy_level = Number(updates.privacyLevel);
  return payload;
};

const toPsychologistUpdatePayload = (updates) => {
  const payload = {};
  if (updates.displayName !== undefined) {
    payload.display_name = updates.displayName || null;
    payload.avatar_initials = getInitials(updates.displayName || '');
  }
  if (updates.title !== undefined) payload.title = updates.title || null;
  if (updates.bio !== undefined) payload.bio = updates.bio || null;
  if (updates.shortBio !== undefined) payload.short_bio = updates.shortBio || null;
  if (updates.experience !== undefined) payload.experience = Number(updates.experience || 0);
  if (updates.basePrice !== undefined) payload.base_price = Number(updates.basePrice || 0);
  if (updates.specializations !== undefined) payload.specializations = updates.specializations || [];
  if (updates.approaches !== undefined) payload.approaches = updates.approaches || [];
  if (updates.channels !== undefined) payload.channels = updates.channels || [];
  if (updates.availability !== undefined) payload.availability = updates.availability || {};
  if (updates.languages !== undefined) {
    payload.languages = updates.languages?.length
      ? updates.languages
      : DEFAULT_PSYCHOLOGIST_PROFILE.languages;
  }
  if (updates.university !== undefined) payload.university = updates.university || null;
  if (updates.supervisor !== undefined) payload.supervisor = updates.supervisor || null;
  return payload;
};

const toClientProfileUpsertPayload = (userId, updates) => {
  const payload = {
    id: userId,
    updated_at: new Date().toISOString(),
  };
  if (updates.topics !== undefined) payload.topics = updates.topics || [];
  if (updates.preferredChannel !== undefined) payload.preferred_channel = updates.preferredChannel || 'video-blur';
  if (updates.emergencyName !== undefined) payload.emergency_name = updates.emergencyName || null;
  if (updates.emergencyPhone !== undefined) payload.emergency_phone = updates.emergencyPhone || null;
  if (updates.city !== undefined) payload.city = updates.city || null;
  if (updates.privacyLevel !== undefined) payload.privacy_level = Number(updates.privacyLevel || DEFAULT_CLIENT_PROFILE.privacyLevel);
  return payload;
};

const isMissingPrivacyLevelColumn = (err) =>
  err?.message?.includes('privacy_level') ||
  err?.details?.includes('privacy_level') ||
  err?.hint?.includes('privacy_level');

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProfileProvider({ user, setUser, children }) {
  const { success, error: showError } = useToast();

  // ── updateProfile ─────────────────────────────────────────────────────────
  const updateProfile = useCallback(
    async (updates) => {
      if (!user) {
        return { success: false, error: 'Profil güncellemek için giriş yapmalısınız.' };
      }

      const nextUser = {
        ...user,
        ...updates,
        privacyLevel:
          updates.privacyLevel !== undefined
            ? Number(updates.privacyLevel)
            : user.privacyLevel,
      };

      // ── Mock / dev fallback ───────────────────────────────────────────────
      if (user.id.startsWith('mock-')) {
        setUser(nextUser);
        localStorage.setItem('mock_user_session', JSON.stringify(nextUser));
        success('Profil Güncellendi', 'Değişiklikler kaydedildi.');
        return { success: true, profile: nextUser, isLocalFallback: true };
      }

      // ── Supabase update ───────────────────────────────────────────────────
      const saveProfile = (profilePayload) =>
        supabase
          .from('profiles')
          .update(profilePayload)
          .eq('id', user.id)
          .select('*')
          .single();

      const payload = toProfileUpdatePayload(updates);
      let { data, error } = await saveProfile(payload);
      let missingPrivacyColumn = false;

      // Retry without privacy_level if the column doesn't exist yet
      if (error && payload.privacy_level !== undefined && isMissingPrivacyLevelColumn(error)) {
        missingPrivacyColumn = true;
        const fallbackPayload = { ...payload };
        delete fallbackPayload.privacy_level;

        if (Object.keys(fallbackPayload).length > 0) {
          ({ data, error } = await saveProfile(fallbackPayload));
        } else {
          data = user;
          error = null;
        }
      }

      if (error) {
        showError('Profil Güncellenemedi', error.message);
        return { success: false, error: error.message };
      }

      // If the user is a psychologist and their name changed, sync it
      if (user.role === 'psychologist' && updates.name !== undefined) {
        const { error: psychologistError } = await supabase
          .from('psychologists')
          .update({
            display_name: updates.name || null,
            avatar_initials: getInitials(updates.name || ''),
          })
          .eq('id', user.id);

        if (psychologistError) {
          console.warn('Psikolog görünen adı güncellenemedi:', psychologistError);
        }
      }

      const updatedUser = {
        ...user,
        ...data,
        ...(missingPrivacyColumn ? updates : {}),
        privacyLevel:
          updates.privacyLevel !== undefined
            ? Number(updates.privacyLevel)
            : data.privacy_level || nextUser.privacyLevel,
        psychologistProfile:
          user.role === 'psychologist' && updates.name !== undefined
            ? {
                ...(user.psychologistProfile || normalizePsychologistProfile()),
                displayName: updates.name || '',
                avatarInitials: getInitials(updates.name || ''),
              }
            : user.psychologistProfile,
      };

      setUser(updatedUser);
      success('Profil Güncellendi', 'Değişiklikler kaydedildi.');
      return { success: true, profile: updatedUser, missingPrivacyColumn };
    },
    [user, setUser, success, showError],
  );

  // ── updatePsychologistProfile ─────────────────────────────────────────────
  const updatePsychologistProfile = useCallback(
    async (updates) => {
      if (!user || user.role !== 'psychologist') {
        return {
          success: false,
          error: 'Psikolog profilini güncellemek için psikolog hesabıyla giriş yapmalısınız.',
        };
      }

      const nextPsychologistProfile = normalizePsychologistProfile({
        ...(user.psychologistProfile || {}),
        ...updates,
        display_name: updates.displayName ?? user.psychologistProfile?.displayName ?? user.name,
        base_price: updates.basePrice ?? user.psychologistProfile?.basePrice,
        short_bio: updates.shortBio ?? user.psychologistProfile?.shortBio,
      });

      // ── Mock / dev fallback ───────────────────────────────────────────────
      if (user.id.startsWith('mock-')) {
        const nextUser = { ...user, psychologistProfile: nextPsychologistProfile };
        setUser(nextUser);
        localStorage.setItem('mock_user_session', JSON.stringify(nextUser));
        success('Psikolog Profili Güncellendi', 'Değişiklikler kaydedildi.');
        return {
          success: true,
          psychologistProfile: nextPsychologistProfile,
          isLocalFallback: true,
        };
      }

      // ── Supabase upsert ───────────────────────────────────────────────────
      const payload = {
        id: user.id,
        ...toPsychologistUpdatePayload(updates),
      };

      const { data, error } = await supabase
        .from('psychologists')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .single();

      if (error) {
        showError('Psikolog Profili Güncellenemedi', error.message);
        return { success: false, error: error.message };
      }

      const updatedPsychologistProfile = normalizePsychologistProfile(data);
      setUser((prev) => (prev ? { ...prev, psychologistProfile: updatedPsychologistProfile } : prev));
      success('Psikolog Profili Güncellendi', 'Değişiklikler kaydedildi.');
      return { success: true, psychologistProfile: updatedPsychologistProfile };
    },
    [user, setUser, success, showError],
  );

  // ── updateClientProfile ───────────────────────────────────────────────────
  const updateClientProfile = useCallback(
    async (updates) => {
      if (!user || user.role !== 'client') {
        return {
          success: false,
          error: 'Danışan tercihlerini güncellemek için danışan hesabıyla giriş yapmalısınız.',
        };
      }

      const nextClientProfile = {
        ...DEFAULT_CLIENT_PROFILE,
        ...(user.clientProfile || {}),
        ...updates,
        privacyLevel:
          updates.privacyLevel !== undefined
            ? Number(updates.privacyLevel)
            : user.privacyLevel,
      };

      if (user.id.startsWith('mock-')) {
        writeLocalJson(getClientProfileKey(user.id), nextClientProfile);

        setUser((prev) => {
          if (!prev) return prev;
          const nextUser = {
            ...prev,
            clientProfile: nextClientProfile,
            privacyLevel: nextClientProfile.privacyLevel,
          };
          localStorage.setItem('mock_user_session', JSON.stringify(nextUser));
          return nextUser;
        });

        success('Danışan Profili Güncellendi', 'Tercihleriniz kaydedildi.');
        return { success: true, clientProfile: nextClientProfile, isLocalFallback: true };
      }

      const { data, error } = await supabase
        .from('client_profiles')
        .upsert(toClientProfileUpsertPayload(user.id, nextClientProfile), { onConflict: 'id' })
        .select('*')
        .single();

      if (error) {
        showError('Danışan Profili Güncellenemedi', error.message);
        return { success: false, error: error.message };
      }

      const updatedClientProfile = normalizeClientProfile(data);
      writeLocalJson(getClientProfileKey(user.id), updatedClientProfile);

      setUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          clientProfile: updatedClientProfile,
          privacyLevel: updatedClientProfile.privacyLevel,
        };
      });

      success('Danışan Profili Güncellendi', 'Tercihleriniz kaydedildi.');
      return { success: true, clientProfile: updatedClientProfile };
    },
    [user, setUser, success, showError],
  );

  // ── updatePassword ────────────────────────────────────────────────────────
  const updatePassword = useCallback(
    async (newPassword) => {
      if (!user) {
        return { success: false, error: 'Şifre güncellemek için giriş yapmalısınız.' };
      }

      if (!newPassword || newPassword.length < 6) {
        const message = 'Yeni şifre en az 6 karakter olmalıdır.';
        showError('Şifre Güncellenemedi', message);
        return { success: false, error: message };
      }

      // ── Mock / dev fallback ───────────────────────────────────────────────
      if (user.id.startsWith('mock-')) {
        success('Şifre Güncellendi', 'Test hesabı için şifre değişikliği simüle edildi.');
        return { success: true, isLocalFallback: true };
      }

      // ── Supabase ──────────────────────────────────────────────────────────
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        showError('Şifre Güncellenemedi', error.message);
        return { success: false, error: error.message };
      }

      success('Şifre Güncellendi', 'Yeni şifreniz kaydedildi.');
      return { success: true };
    },
    [user, success, showError],
  );

  // ── addMoodEntry ──────────────────────────────────────────────────────────
  const addMoodEntry = useCallback(
    async (mood) => {
      if (!user || user.role !== 'client') {
        return { success: false, error: 'Ruh hali kaydı eklemek için danışan hesabıyla giriş yapmalısınız.' };
      }

      const today = new Date().toISOString().split('T')[0];
      const nextEntry = { date: today, mood: Number(mood) };

      // Build updated mood history (replace today's entry if it exists)
      const nextMoodHistory = [
        ...(user.moodHistory || []).filter((entry) => entry.date !== today),
        nextEntry,
      ].sort((a, b) => a.date.localeCompare(b.date));

      // ── Mock / dev fallback — always use localStorage ─────────────────────
      if (user.id.startsWith('mock-')) {
        writeLocalJson(getClientMoodKey(user.id), nextMoodHistory);
        setUser((prev) => {
          if (!prev) return prev;
          const nextUser = { ...prev, moodHistory: nextMoodHistory };
          localStorage.setItem('mock_user_session', JSON.stringify(nextUser));
          return nextUser;
        });
        success('Ruh Hali Kaydedildi', 'Bugünkü ruh hali notunuz güncellendi.');
        return { success: true, moodHistory: nextMoodHistory, isLocalFallback: true };
      }

      // ── Supabase upsert ───────────────────────────────────────────────────
      const { error } = await supabase
        .from('mood_entries')
        .upsert(
          {
            client_id: user.id,
            date: today,
            mood: Number(mood),
          },
          { onConflict: 'client_id,date' },
        );

      if (error) {
        // Fall back to localStorage on Supabase error
        console.warn("Ruh hali kaydı Supabase'e yazılamadı, localStorage'a düşülüyor:", error);
        writeLocalJson(getClientMoodKey(user.id), nextMoodHistory);
      }

      // Always update local state regardless of where persisted
      setUser((prev) => {
        if (!prev) return prev;
        return { ...prev, moodHistory: nextMoodHistory };
      });

      success('Ruh Hali Kaydedildi', 'Bugünkü ruh hali notunuz güncellendi.');
      return { success: true, moodHistory: nextMoodHistory };
    },
    [user, setUser, success],
  );

  // ── Context value (memoised) ──────────────────────────────────────────────
  const value = useMemo(
    () => ({
      updateProfile,
      updatePsychologistProfile,
      updateClientProfile,
      updatePassword,
      addMoodEntry,
    }),
    [updateProfile, updatePsychologistProfile, updateClientProfile, updatePassword, addMoodEntry],
  );

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
