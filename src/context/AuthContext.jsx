/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastContext';

const AuthContext = createContext();

const isDevMockEmail = (email = '') => {
  if (!import.meta.env.DEV) return false;
  const normalizedEmail = email.toLowerCase();
  return (
    normalizedEmail === 'psikolog@gizlibiriz.com'
    || normalizedEmail.endsWith('@test.local')
    || normalizedEmail.includes('+bypass@')
  );
};

const getInitials = (name = '') => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .filter(word => !['dr.', 'uzm.', 'psk.'].includes(word.toLocaleLowerCase('tr-TR')))
    .slice(0, 2)
    .map(word => word.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('') || 'GB';
};

const normalizePsychologistProfile = (profile = {}) => ({
  displayName: profile.display_name || profile.displayName || '',
  avatarInitials: profile.avatar_initials || profile.avatarInitials || getInitials(profile.display_name || profile.displayName || ''),
  title: profile.title || 'Psikolog',
  bio: profile.bio || '',
  shortBio: profile.short_bio || profile.shortBio || '',
  experience: Number(profile.experience || 0),
  basePrice: Number(profile.base_price ?? profile.basePrice ?? 1000),
  specializations: profile.specializations || [],
  approaches: profile.approaches || [],
  channels: profile.channels?.length ? profile.channels : ['video-blur', 'voice', 'text'],
  availability: profile.availability || {},
  languages: profile.languages?.length ? profile.languages : ['Türkçe'],
  university: profile.university || '',
  supervisor: profile.supervisor || '',
  isCandidate: Boolean(profile.is_candidate ?? profile.isCandidate),
  approvalStatus: profile.approval_status || profile.approvalStatus || 'pending',
  rating: Number(profile.rating || 0),
  reviewCount: Number(profile.review_count ?? profile.reviewCount ?? 0),
  sessionCount: Number(profile.session_count ?? profile.sessionCount ?? 0),
});

const normalizeClientProfile = (profile = {}) => ({
  topics: profile.topics || profile.clientTopics || [],
  preferredChannel: profile.preferredChannel || profile.preferred_channel || 'video-blur',
  emergencyName: profile.emergencyName || profile.emergency_name || '',
  emergencyPhone: profile.emergencyPhone || profile.emergency_phone || '',
  city: profile.city || '',
  privacyLevel: Number(profile.privacyLevel || profile.privacy_level || 5),
});

const readLocalJson = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { success, error: showError } = useToast();

  const fetchPsychologistProfile = useCallback(async (userId) => {
    const { data, error } = await supabase.from('psychologists').select('*').eq('id', userId).single();
    if (error || !data) return normalizePsychologistProfile();
    return normalizePsychologistProfile(data);
  }, []);

  const fetchClientProfile = useCallback(async (userId) => {
    const { data, error } = await supabase.from('client_profiles').select('*').eq('id', userId).single();
    if (error || !data) {
      // Fallback: localStorage'dan oku (eski veriler için)
      return normalizeClientProfile(readLocalJson(`gizlibiriz-client-profile-${userId}`, {}));
    }
    return normalizeClientProfile(data);
  }, []);

  const fetchMoodHistory = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('mood_entries')
      .select('date, mood')
      .eq('client_id', userId)
      .order('date', { ascending: true });
    if (error || !data) {
      return readLocalJson(`gizlibiriz-client-mood-${userId}`, []);
    }
    return data;
  }, []);

  const fetchUserProfile = useCallback(async (userId, email = null) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

      if (error || !data) {
        // Auto-repair: If auth user exists but profile is missing, recreate it
        const fallbackRole = 'client';
        const fallbackAlias = 'Onarılmış Hesap';
        
        const { error: repairError } = await supabase.from('profiles').insert([{
          id: userId,
          email,
          role: fallbackRole,
          alias: fallbackAlias,
        }]);

        if (repairError) {
          console.error('Profil otomatik onarılamadı:', repairError);
        }

        setUser({
          id: userId, email, role: fallbackRole, alias: fallbackAlias,
          sessions: [], moodHistory: [], reviews: [],
          clientProfile: normalizeClientProfile({}),
          psychologistProfile: null,
          privacyLevel: 5,
        });
        return;
      }

      const psychologistProfile = data.role === 'psychologist' ? await fetchPsychologistProfile(userId) : null;
      const clientProfile = data.role === 'client' ? await fetchClientProfile(userId) : null;
      const moodHistory = data.role === 'client' ? await fetchMoodHistory(userId) : [];

      setUser({
        ...data,
        id: userId,
        email: data.email || email,
        name: data.name || psychologistProfile?.displayName || null,
        sessions: [],
        moodHistory,
        reviews: [],
        clientProfile,
        privacyLevel: data.privacy_level || clientProfile?.privacyLevel || 5,
        psychologistProfile,
      });
    } catch (err) {
      console.warn('Profil çekilemedi:', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPsychologistProfile, fetchClientProfile, fetchMoodHistory]);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      setSession(data.session);
      if (data.session?.user) {
        if (import.meta.env.DEV) {
          localStorage.removeItem('mock_user_session');
        }
        await fetchUserProfile(data.session.user.id, data.session.user.email);
        return;
      }

      const mockData = import.meta.env.DEV ? localStorage.getItem('mock_user_session') : null;
      if (mockData) {
        setUser(JSON.parse(mockData));
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        if (import.meta.env.DEV) {
          localStorage.removeItem('mock_user_session');
        }
        fetchUserProfile(nextSession.user.id, nextSession.user.email);
      } else {
        if (!import.meta.env.DEV || !localStorage.getItem('mock_user_session')) {
          setUser(null);
        }
        setIsLoading(false);
      }
    });

    return () => { isMounted = false; subscription.unsubscribe(); };
  }, [fetchUserProfile]);

  const login = useCallback(async (email, password, requestedRole = null) => {
    setIsLoading(true);
    try {
      if (isDevMockEmail(email)) {
        const mockRole = requestedRole || (email === 'psikolog@gizlibiriz.com' ? 'psychologist' : 'client');
        const mockUser = {
          id: `mock-${crypto.randomUUID()}`, email, role: mockRole,
          alias: mockRole === 'psychologist' ? null : 'Test Danışanı',
          name: mockRole === 'psychologist' ? 'Uzman Psikolog' : null,
          sessions: [], moodHistory: [], reviews: [],
          clientProfile: mockRole === 'client' ? normalizeClientProfile({ topics: ['anxiety', 'stress'], preferredChannel: 'video-blur', privacyLevel: 5 }) : null,
          privacyLevel: 5,
          psychologistProfile: mockRole === 'psychologist' ? normalizePsychologistProfile({ displayName: 'Uzman Psikolog', title: 'Psikolog', shortBio: 'GizliBiriz test profili.', channels: ['video-blur', 'voice', 'text'], languages: ['Türkçe'] }) : null,
        };
        setUser(mockUser);
        localStorage.setItem('mock_user_session', JSON.stringify(mockUser));
        success('Test Girişi Başarılı', 'Panele yönlendiriliyorsunuz...');
        return { success: true, role: mockRole };
      }

      if (import.meta.env.DEV) {
        localStorage.removeItem('mock_user_session');
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showError('Giriş Başarısız', error.message || 'E-posta veya şifre hatalı.');
        return { success: false, error: error.message };
      }

      await fetchUserProfile(data.user.id, email);
      success('Giriş Başarılı', 'Panele yönlendiriliyorsunuz...');
      const profileRes = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
      return { success: true, role: profileRes.data?.role || 'client' };
    } catch (err) {
      console.error('Giriş hatası:', err);
      showError('Sistem Hatası', 'Beklenmeyen bir hata oluştu.');
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserProfile, success, showError]);

  const register = useCallback(async (email, password, profileData, role) => {
    setIsLoading(true);
    try {
      if (isDevMockEmail(email)) {
        success('Test Kaydı Başarılı', 'Lütfen giriş yapın.');
        return { success: true };
      }

      const signupMetadata = {
        role,
        alias: profileData.alias || null,
        name: profileData.name || null,
        privacyLevel: Number(profileData.privacyLevel || 5),
      };

      if (role === 'client') {
        Object.assign(signupMetadata, {
          topics: profileData.topics || profileData.clientTopics || [],
          preferredChannel: profileData.preferredChannel || profileData.style || 'video-blur',
          emergencyName: profileData.emergencyName || null,
          emergencyPhone: profileData.emergencyPhone || null,
          city: profileData.city || null,
        });
      }

      if (role === 'psychologist') {
        Object.assign(signupMetadata, {
          title: profileData.title || 'Psikolog',
          shortBio: profileData.shortBio || null,
          bio: profileData.shortBio || profileData.bio || null,
          experience: Number(profileData.experience || 0),
          isCandidate: Boolean(profileData.isCandidate),
          basePrice: Number(profileData.basePrice || 1000),
          specializations: profileData.specializations || [],
          approaches: profileData.approaches || [],
          channels: profileData.channels || ['video-blur', 'voice', 'text'],
          university: profileData.university || null,
          supervisorName: profileData.supervisorName || null,
        });
      }

      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: signupMetadata },
      });

      if (error) { showError('Kayıt Hatası', error.message); return { success: false, error: error.message }; }

      if (data?.user) {
        if (!data.session) {
          success('Kayıt Alındı', 'Hesabınız oluşturuldu. E-posta doğrulaması açıksa lütfen gelen bağlantıyı onaylayın.');
          return { success: true, needsEmailConfirmation: true };
        }

        const { error: insertError } = await supabase.from('profiles').upsert([{
          id: data.user.id, email, role,
          name: profileData.name || null, alias: profileData.alias || null,
          privacy_level: Number(profileData.privacyLevel || 5),
        }], { onConflict: 'id' });
        if (insertError) {
          showError('Profil Hatası', insertError.message);
          return { success: false, error: insertError.message };
        }

        if (role === 'psychologist') {
          const { error: psychologistError } = await supabase.from('psychologists').upsert([{
            id: data.user.id,
            display_name: profileData.name || 'GizliBiriz Psikoloğu',
            avatar_initials: getInitials(profileData.name),
            title: profileData.title || 'Psikolog',
            bio: profileData.shortBio || profileData.bio || null,
            short_bio: profileData.shortBio || null,
            experience: Number(profileData.experience || 0),
            is_candidate: Boolean(profileData.isCandidate),
            base_price: Number(profileData.basePrice || 1000),
            specializations: profileData.specializations || [],
            approaches: profileData.approaches || [],
            channels: profileData.channels || ['video-blur', 'voice', 'text'],
            university: profileData.university || null,
            supervisor: profileData.supervisorName || null,
            approval_status: 'pending',
          }], { onConflict: 'id' });
          if (psychologistError) {
            showError('Psikolog Başvurusu Kaydedilemedi', psychologistError.message);
            return { success: false, error: psychologistError.message };
          }
        }

        if (role === 'client') {
          const { error: clientProfileError } = await supabase.from('client_profiles').upsert([{
            id: data.user.id,
            topics: profileData.topics || profileData.clientTopics || [],
            preferred_channel: profileData.preferredChannel || profileData.style || 'video-blur',
            emergency_name: profileData.emergencyName || null,
            emergency_phone: profileData.emergencyPhone || null,
            city: profileData.city || null,
            privacy_level: Number(profileData.privacyLevel || 5),
          }], { onConflict: 'id' });
          if (clientProfileError) {
            showError('Danışan Profili Kaydedilemedi', clientProfileError.message);
            return { success: false, error: clientProfileError.message };
          }
        }
      }

      success('Kayıt Başarılı', 'Hesabınız oluşturuldu, lütfen giriş yapın.');
      return { success: true };
    } catch (err) {
      console.error('Kayıt hatası:', err);
      showError('Sistem Hatası', 'Kayıt olurken beklenmeyen bir hata oluştu.');
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [success, showError]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('mock_user_session');
    setUser(null);
    success('Çıkış', 'Başarıyla çıkış yapıldı.');
  }, [success]);

  const value = {
    user, setUser, session,
    isAuthenticated: !!user,
    isClient: user?.role === 'client' || user?.role === 'admin',
    isPsychologist: user?.role === 'psychologist',
    isLoading, login, register, logout,
  };

  return <AuthContext.Provider value={value}>{!isLoading && children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
