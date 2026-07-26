/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getAuthRedirectUrl, isEmailNotConfirmedError } from '../lib/auth';
import { createDefaultMfaStatus, readAdminMfaStatus } from '../lib/admin-mfa';
import { BRAND } from '../config/brand';
import { FEATURES, IS_DEMO_MODE } from '../config/runtime';
import { createDemoUser } from '../data/demo-fixtures';
import { useToast } from './ToastContext';

const AuthContext = createContext();

const isDevMockEmail = (email = '') => {
  if (!IS_DEMO_MODE && !import.meta.env.DEV) return false;
  const normalizedEmail = email.toLowerCase();
  return (
    normalizedEmail === 'psikolog@sakliterapi.com'
    || normalizedEmail === 'psikolog@gizlibiriz.com'
    || normalizedEmail.endsWith('@test.local')
    || normalizedEmail.includes('+bypass@')
  );
};

const clearLegacySensitiveCaches = () => {
  if (import.meta.env.DEV) return;
  const demoCleanupKey = 'sakli-terapi-demo-cache-cleaned-v1';
  if (IS_DEMO_MODE && localStorage.getItem(demoCleanupKey)) return;

  const sensitivePrefixes = [
    'gizlibiriz-client-profile-',
    'gizlibiriz-client-mood-',
    'gizlibiriz-client-reviews-',
    'gizlibiriz-settings-',
  ];

  Object.keys(localStorage).forEach((key) => {
    if (key === 'gizlibiriz-global-reviews' || sensitivePrefixes.some(prefix => key.startsWith(prefix))) {
      localStorage.removeItem(key);
    }
  });

  if (IS_DEMO_MODE) {
    localStorage.setItem(demoCleanupKey, 'true');
  }
};

const getInitials = (name = '') => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .filter(word => !['dr.', 'uzm.', 'psk.'].includes(word.toLocaleLowerCase('tr-TR')))
    .slice(0, 2)
    .map(word => word.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('') || 'ST';
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
  reviewReason: profile.review_reason || profile.reviewReason || '',
  reviewedAt: profile.reviewed_at || profile.reviewedAt || null,
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [mfaStatus, setMfaStatus] = useState(createDefaultMfaStatus);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserId = user?.id;
  const currentUserEmail = user?.email;
  const { success, error: showError } = useToast();

  const refreshMfaStatus = useCallback(async (role) => {
    if (IS_DEMO_MODE && role === 'admin') {
      const status = {
        required: true,
        loading: false,
        enrolled: true,
        verified: true,
        factorId: 'demo-factor',
        error: '',
      };
      setMfaStatus(status);
      return status;
    }

    if (role !== 'admin') {
      const status = createDefaultMfaStatus();
      setMfaStatus(status);
      return status;
    }

    setMfaStatus(previous => ({
      ...previous,
      required: true,
      loading: true,
      verified: false,
      error: '',
    }));
    try {
      const status = await readAdminMfaStatus(supabase.auth, role);
      setMfaStatus(status);
      return status;
    } catch (mfaError) {
      console.error('Yönetici MFA durumu alınamadı:', mfaError);
      const status = {
        required: true,
        loading: false,
        enrolled: false,
        verified: false,
        factorId: null,
        error: 'Yönetici güvenlik durumu doğrulanamadı. Lütfen tekrar giriş yapın.',
      };
      setMfaStatus(status);
      return status;
    }
  }, []);

  const fetchPsychologistProfile = useCallback(async (userId) => {
    const { data, error } = await supabase.from('psychologists').select('*').eq('id', userId).single();
    if (error || !data) return normalizePsychologistProfile();
    return normalizePsychologistProfile(data);
  }, []);

  const fetchClientProfile = useCallback(async (userId) => {
    const { data, error } = await supabase.from('client_profiles').select('*').eq('id', userId).single();
    if (error || !data) {
      console.warn('Danışan profili yüklenemedi:', error);
      return normalizeClientProfile();
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
      console.warn('Ruh hali geçmişi yüklenemedi:', error);
      return [];
    }
    return data;
  }, []);

  const fetchUserProfile = useCallback(async (userId, email = null) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

      if (error || !data) {
        const message = 'Hesap profili bulunamadı. Lütfen destek ekibiyle iletişime geçin.';
        console.error('Hesap profili yüklenemedi:', error);
        setUser(null);
        showError('Profil Yüklenemedi', message);
        return { success: false, error: message };
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
      const nextMfaStatus = await refreshMfaStatus(data.role);
      return { success: true, role: data.role, mfa: nextMfaStatus };
    } catch (err) {
      console.error('Profil çekilemedi:', err);
      setUser(null);
      showError('Profil Yüklenemedi', 'Hesap bilgileriniz alınamadı. Lütfen tekrar deneyin.');
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [fetchPsychologistProfile, fetchClientProfile, fetchMoodHistory, refreshMfaStatus, showError]);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      clearLegacySensitiveCaches();

      if (IS_DEMO_MODE) {
        const mockData = localStorage.getItem('mock_user_session');
        if (mockData) {
          try {
            const mockUser = JSON.parse(mockData);
            setUser(mockUser);
            await refreshMfaStatus(mockUser.role);
          } catch {
            localStorage.removeItem('mock_user_session');
          }
        }
        setSession(null);
        setIsLoading(false);
        return;
      }

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
        setMfaStatus(createDefaultMfaStatus());
        setIsLoading(false);
      }
    };

    initAuth();

    if (IS_DEMO_MODE) {
      return () => {
        isMounted = false;
      };
    }

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
          setMfaStatus(createDefaultMfaStatus());
        }
        setIsLoading(false);
      }
    });

    return () => { isMounted = false; subscription.unsubscribe(); };
  }, [fetchUserProfile, refreshMfaStatus]);

  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    try {
      if (IS_DEMO_MODE) {
        const message = 'Portföy sürümünde gerçek hesap girişi kapalıdır.';
        showError('Demo Sürümü', message);
        return { success: false, error: message };
      }

      if (isDevMockEmail(email)) {
        const mockRole = ['psikolog@sakliterapi.com', 'psikolog@gizlibiriz.com'].includes(email.toLowerCase()) ? 'psychologist' : 'client';
        const mockUser = {
          id: `mock-${crypto.randomUUID()}`, email, role: mockRole,
          alias: mockRole === 'psychologist' ? null : 'Test Danışanı',
          name: mockRole === 'psychologist' ? 'Uzman Psikolog' : null,
          sessions: [], moodHistory: [], reviews: [],
          clientProfile: mockRole === 'client' ? normalizeClientProfile({ topics: ['anxiety', 'stress'], preferredChannel: 'video-blur', privacyLevel: 5 }) : null,
          privacyLevel: 5,
          psychologistProfile: mockRole === 'psychologist' ? normalizePsychologistProfile({ displayName: 'Uzman Psikolog', title: 'Psikolog', shortBio: `${BRAND.name} test profili.`, channels: ['video-blur', 'voice', 'text'], languages: ['Türkçe'] }) : null,
        };
        setUser(mockUser);
        localStorage.setItem('mock_user_session', JSON.stringify(mockUser));
        success('Test Girişi Başarılı', 'Panele yönlendiriliyorsunuz...');
        return { success: true, role: mockRole };
      }

      if (import.meta.env.DEV) {
        localStorage.removeItem('mock_user_session');
      }

      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) {
        if (isEmailNotConfirmedError(error)) {
          showError('E-posta Doğrulanmadı', 'Giriş yapmadan önce e-posta adresinizi doğrulayın.');
          return { success: false, error: error.message, needsEmailConfirmation: true };
        }

        showError('Giriş Başarısız', 'E-posta veya şifre hatalı.');
        return { success: false, error: error.message };
      }

      const profileResult = await fetchUserProfile(data.user.id, normalizedEmail);
      if (!profileResult?.success) {
        await supabase.auth.signOut();
        return profileResult;
      }

      success('Giriş Başarılı', 'Panele yönlendiriliyorsunuz...');
      return { success: true, role: profileResult.role, mfa: profileResult.mfa };
    } catch (err) {
      console.error('Giriş hatası:', err);
      showError('Sistem Hatası', 'Beklenmeyen bir hata oluştu.');
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserProfile, success, showError]);

  const loginAsDemo = useCallback(async (role) => {
    if (!IS_DEMO_MODE) {
      return { success: false, error: 'Demo girişi bu ortamda kullanılamaz.' };
    }

    setIsLoading(true);
    try {
      const demoUser = createDemoUser(role);
      localStorage.setItem('mock_user_session', JSON.stringify(demoUser));
      setSession(null);
      setUser(demoUser);
      const nextMfaStatus = await refreshMfaStatus(demoUser.role);
      success('Demo Hazır', 'Kurgusal verilerle güvenli inceleme ortamı açıldı.');
      return {
        success: true,
        role: demoUser.role,
        mfa: nextMfaStatus,
      };
    } finally {
      setIsLoading(false);
    }
  }, [refreshMfaStatus, success]);

  const register = useCallback(async (email, password, profileData, role) => {
    setIsLoading(true);
    try {
      const registrationEnabled = role === 'psychologist'
        ? FEATURES.professionalApplications
        : FEATURES.publicRegistration;
      if (!registrationEnabled) {
        const message = IS_DEMO_MODE
          ? 'Portföy sürümünde gerçek hesap oluşturma kapalıdır.'
          : 'Bu hesap türü için yeni kullanıcı alımı henüz açık değildir.';
        showError(IS_DEMO_MODE ? 'Demo Sürümü' : 'Kayıt Kapalı', message);
        return { success: false, error: message };
      }

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

      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: signupMetadata,
          emailRedirectTo: getAuthRedirectUrl('/hesap-dogrulandi'),
        },
      });

      if (error) { showError('Kayıt Hatası', error.message); return { success: false, error: error.message }; }

      if (data?.user) {
        if (!data.session) {
          success('E-postanızı Doğrulayın', 'Hesabınızı etkinleştirmek için gönderdiğimiz bağlantıyı açın.');
          return { success: true, needsEmailConfirmation: true, email: normalizedEmail };
        }

        const { error: insertError } = await supabase.from('profiles').upsert([{
          id: data.user.id, email: normalizedEmail, role,
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
            display_name: profileData.name || `${BRAND.name} Psikoloğu`,
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

        // Auto-confirmed projects return a session during sign-up. Keep the
        // registration flow deterministic by requiring a normal first login.
        await supabase.auth.signOut();
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

  const resendVerification = useCallback(async (email) => {
    if (IS_DEMO_MODE) {
      return { success: false, error: 'Portföy sürümünde gerçek e-posta gönderimi kapalıdır.' };
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return { success: false, error: 'E-posta adresi gerekli.' };
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: { emailRedirectTo: getAuthRedirectUrl('/hesap-dogrulandi') },
    });

    if (error) {
      showError('E-posta Gönderilemedi', error.message || 'Lütfen kısa bir süre sonra tekrar deneyin.');
      return { success: false, error: error.message };
    }

    success('E-posta Gönderildi', 'Yeni doğrulama bağlantısı e-posta adresinize gönderildi.');
    return { success: true, email: normalizedEmail };
  }, [showError, success]);

  const logout = useCallback(async () => {
    if (!IS_DEMO_MODE) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('mock_user_session');
    setUser(null);
    setMfaStatus(createDefaultMfaStatus());
    success('Çıkış', 'Başarıyla çıkış yapıldı.');
  }, [success]);

  const refreshUserProfile = useCallback(async () => {
    if (!currentUserId || currentUserId.startsWith('mock-')) return { success: false };
    return fetchUserProfile(currentUserId, currentUserEmail);
  }, [currentUserEmail, currentUserId, fetchUserProfile]);

  const value = {
    user, setUser, session,
    isAuthenticated: !!user,
    isClient: user?.role === 'client',
    isPsychologist: user?.role === 'psychologist',
    isLoading, login, loginAsDemo, register, resendVerification, logout, refreshUserProfile,
    mfaStatus, refreshMfaStatus,
    isDemoMode: IS_DEMO_MODE,
  };

  return <AuthContext.Provider value={value}>{!isLoading && children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
