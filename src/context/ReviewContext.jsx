/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { appendLocalReview, getLocalReviewsForPsychologist } from '../lib/local-reviews';
import { useToast } from './ToastContext';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ReviewContext = createContext(null);

const CLIENT_REVIEWS_KEY_PREFIX = 'gizlibiriz-client-reviews-';
const getClientReviewsKey = (userId) => `${CLIENT_REVIEWS_KEY_PREFIX}${userId}`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Helpers — localStorage
// ---------------------------------------------------------------------------

const readLocalJson = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const writeLocalJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

// ---------------------------------------------------------------------------
// Normalization — Supabase snake_case ↔ frontend camelCase
// ---------------------------------------------------------------------------

/**
 * Converts a Supabase `reviews` row into the camelCase shape used on the
 * frontend. The `categories` JSONB column stores the per-category ratings.
 */
const normalizeReview = (row) => ({
  id: row.id,
  sessionId: row.session_id || row.sessionId,
  psychologistId: row.psychologist_id || row.psychologistId,
  clientId: row.client_id || row.clientId,
  clientAlias: row.client_alias || row.clientAlias,
  date: row.created_at || row.date,
  rating: Number(row.rating ?? 0),
  categoriesRating: normalizeCategoriesRating(row.categories || row.categoriesRating || {}),
  comment: row.comment || '',
  anonymous: Boolean(row.anonymous),
  channel: row.channel || null,
  sessionNumber: row.session_number || row.sessionNumber || null,
});

/**
 * Ensures that the categories object always has the canonical four keys
 * (`listening`, `empathy`, `clarity`, `trust`) plus the two backward-compat
 * aliases (`professionalism`, `communication`).
 */
const normalizeCategoriesRating = (raw = {}) => ({
  listening: Number(raw.listening ?? 0),
  empathy: Number(raw.empathy ?? 0),
  clarity: Number(raw.clarity ?? raw.communication ?? 0),
  trust: Number(raw.trust ?? raw.professionalism ?? 0),
  professionalism: Number(raw.professionalism ?? raw.trust ?? 0),
  communication: Number(raw.communication ?? raw.clarity ?? 0),
});

/**
 * Builds the Supabase INSERT payload from the frontend review shape.
 */
const toReviewInsertPayload = (review) => ({
  session_id: review.sessionId,
  psychologist_id: review.psychologistId,
  client_id: review.clientId,
  client_alias: review.clientAlias,
  rating: review.rating,
  categories: review.categoriesRating,
  comment: review.comment,
  anonymous: review.anonymous,
  channel: review.channel,
});

// ---------------------------------------------------------------------------
// Helper — mock user detection
// ---------------------------------------------------------------------------

const isMockUser = (user) => Boolean(user?.id?.startsWith('mock-'));

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ReviewProvider({ user, sessions: sessionContextSessions = [], markSessionReviewed, children }) {
  const [reviews, setReviews] = useState([]);
  const { success, error: showError } = useToast();

  // -----------------------------------------------------------------------
  // Hydrate reviews from localStorage when a mock-client user is present,
  // or clear reviews when the user logs out.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReviews([]);
      return;
    }

    if (isMockUser(user) && (user.role === 'client' || user.role === 'admin')) {
      const stored = readLocalJson(getClientReviewsKey(user.id), []);
      setReviews(stored.map(normalizeReview));
      return;
    }

    // For real Supabase users we lazily load via getMyReviews (see below).
    // On mount we just reset so stale data from a previous user is cleared.
    setReviews([]);
  }, [user?.id, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // submitReview
  // -----------------------------------------------------------------------
  const submitReview = useCallback(async ({ sessionId, ratings, rating, comment, anonymous }) => {
    // --- Guard: must be a logged-in client ---------------------------------
    if (!user || (user.role !== 'client' && user.role !== 'admin')) {
      showError('Değerlendirme Gönderilemedi', 'Değerlendirme göndermek için danışan hesabıyla giriş yapmalısınız.');
      return { success: false, error: 'Değerlendirme göndermek için danışan hesabıyla giriş yapmalısınız.' };
    }

    // --- Find the target session -------------------------------------------
    let sessions = sessionContextSessions.length > 0 ? sessionContextSessions : (user.sessions || []);
    
    if (isMockUser(user)) {
       const stored = readLocalJson('mock_user_session', null);
       if (stored && stored.sessions) {
          sessions = stored.sessions;
       }
    }
    
    let sessionToReview = sessions.find(
      (item) => String(item.id) === String(sessionId),
    );

    // Eğer session yerelde bulunamadıysa (gerçek Supabase user ise), Supabase'e soralım
    if (!sessionToReview && !isMockUser(user)) {
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
          
        if (data && !error) {
           sessionToReview = {
             id: data.id,
             status: data.status,
             reviewed: data.reviewed,
             channel: data.channel,
             psychologist_id: data.psychologist_id,
             psychologistId: data.psychologist_id
           };
        }
      } catch (err) {
        console.warn('Supabase session fetch error in review:', err);
      }
    }

    if (!sessionToReview) {
      const message = `Seans bulunamadı. (Veritabanında da yok). Aranan: ${sessionId}`;
      showError('Değerlendirme Gönderilemedi', message);
      return { success: false, error: message };
    }

    if (sessionToReview.status !== 'completed') {
      const message = 'Yalnızca tamamlanmış seanslar değerlendirilebilir.';
      showError('Değerlendirme Gönderilemedi', message);
      return { success: false, error: message };
    }

    if (sessionToReview.reviewed) {
      const message = 'Bu seans için daha önce değerlendirme gönderilmiş.';
      showError('Değerlendirme Gönderilemedi', message);
      return { success: false, error: message };
    }

    // --- Build the review object -------------------------------------------
    const categoriesRating = normalizeCategoriesRating({
      listening: ratings?.listening ?? rating,
      empathy: ratings?.empathy ?? rating,
      clarity: ratings?.clarity ?? rating,
      trust: ratings?.trust ?? rating,
      professionalism: ratings?.trust ?? ratings?.professionalism ?? rating,
      communication: ratings?.clarity ?? ratings?.communication ?? rating,
    });

    const overallRating = Number(
      rating ??
        Math.round(
          (categoriesRating.listening +
            categoriesRating.empathy +
            categoriesRating.clarity +
            categoriesRating.trust) /
            4,
        ),
    );

    const newReview = {
      id: `review-${crypto.randomUUID()}`,
      sessionId,
      psychologistId: sessionToReview.psychologistId,
      clientId: user.id,
      clientAlias: anonymous ? 'Anonim Danışan' : (user.alias || 'Anonim Danışan'),
      date: new Date().toISOString(),
      rating: overallRating,
      categoriesRating,
      comment: (comment || '').trim(),
      anonymous: Boolean(anonymous),
      channel: sessionToReview.channel,
      sessionNumber: sessionToReview.sessionNumber || null,
    };

    // --- Mock path (localStorage) ------------------------------------------
    if (isMockUser(user)) {
      // Per-user reviews store
      const storedReviews = readLocalJson(getClientReviewsKey(user.id), []);
      const nextReviews = [...storedReviews, newReview];
      writeLocalJson(getClientReviewsKey(user.id), nextReviews);

      // Global reviews store (used by psychologist profile pages)
      appendLocalReview(newReview);

      // Update in-memory state
      setReviews(nextReviews.map(normalizeReview));

      // Mark session as reviewed in SessionContext
      if (typeof markSessionReviewed === 'function') {
        await markSessionReviewed(sessionId);
      }

      success('Değerlendirme Gönderildi', 'Geri bildiriminiz için teşekkürler! 🙏');
      return { success: true, review: newReview };
    }

    // --- Real Supabase path ------------------------------------------------
    try {
      const payload = toReviewInsertPayload(newReview);
      const { data, error } = await supabase
        .from('reviews')
        .insert([payload])
        .select('*')
        .single();

      if (error) {
        console.error('Değerlendirme insert hatası:', error);
        showError('Değerlendirme Gönderilemedi', error.message || 'Veritabanı hatası oluştu.');
        return { success: false, error: error.message };
      }

      const normalized = normalizeReview(data);

      // Add to global reviews store (used by psychologist profile pages)
      appendLocalReview(normalized);

      // Also persist to per-user localStorage as a local cache
      const storedReviews = readLocalJson(getClientReviewsKey(user.id), []);
      writeLocalJson(getClientReviewsKey(user.id), [...storedReviews, normalized]);

      setReviews((prev) => [...prev, normalized]);

      // Mark session as reviewed in SessionContext
      if (typeof markSessionReviewed === 'function') {
        await markSessionReviewed(sessionId);
      }

      success('Değerlendirme Gönderildi', 'Geri bildiriminiz için teşekkürler! 🙏');
      return { success: true, review: normalized };
    } catch (err) {
      console.error('Değerlendirme gönderim hatası:', err);
      showError('Sistem Hatası', 'Değerlendirme gönderilirken beklenmeyen bir hata oluştu.');
      return { success: false, error: err.message };
    }
  }, [user, sessionContextSessions, markSessionReviewed, success, showError]);

  // -----------------------------------------------------------------------
  // fetchReviewsForPsychologist
  // -----------------------------------------------------------------------
  const fetchReviewsForPsychologist = useCallback(async (psychologistId) => {
    if (!psychologistId) return [];

    // --- Mock / non-UUID psychologist IDs → read from global local store ---
    if (
      (user && isMockUser(user)) ||
      !UUID_PATTERN.test(String(psychologistId))
    ) {
      const localReviews = getLocalReviewsForPsychologist(psychologistId);
      return localReviews.map(normalizeReview);
    }

    // --- Supabase path -----------------------------------------------------
    try {
      const { data, error } = await supabase
        .from('public_reviews')
        .select(`
          id,
          psychologist_id,
          rating,
          categories,
          comment,
          anonymous,
          channel,
          created_at,
          client_alias
        `)
        .eq('psychologist_id', psychologistId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Psikolog değerlendirmeleri çekilemedi:', error);
        // Graceful fallback to local store
        const localReviews = getLocalReviewsForPsychologist(psychologistId);
        return localReviews.map(normalizeReview);
      }

      return (data || []).map(normalizeReview);
    } catch (err) {
      console.warn('fetchReviewsForPsychologist hatası:', err);
      const localReviews = getLocalReviewsForPsychologist(psychologistId);
      return localReviews.map(normalizeReview);
    }
  }, [user]);

  // -----------------------------------------------------------------------
  // getMyReviews
  // -----------------------------------------------------------------------
  const getMyReviews = useCallback(async () => {
    if (!user) return [];

    // --- Mock users: always read from localStorage -------------------------
    if (isMockUser(user)) {
      const stored = readLocalJson(getClientReviewsKey(user.id), []);
      const normalized = stored.map(normalizeReview);
      setReviews(normalized);
      return normalized;
    }

    // --- Real Supabase users -----------------------------------------------
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Değerlendirmeler çekilemedi:', error);
        // Fallback to local cache
        const stored = readLocalJson(getClientReviewsKey(user.id), []);
        const normalized = stored.map(normalizeReview);
        setReviews(normalized);
        return normalized;
      }

      const normalized = (data || []).map(normalizeReview);
      setReviews(normalized);

      // Sync to local cache
      writeLocalJson(getClientReviewsKey(user.id), normalized);

      return normalized;
    } catch (err) {
      console.warn('getMyReviews hatası:', err);
      const stored = readLocalJson(getClientReviewsKey(user.id), []);
      const normalized = stored.map(normalizeReview);
      setReviews(normalized);
      return normalized;
    }
  }, [user]);

  // -----------------------------------------------------------------------
  // Context value (memoised to prevent unnecessary re-renders)
  // -----------------------------------------------------------------------
  const value = useMemo(
    () => ({
      reviews,
      submitReview,
      fetchReviewsForPsychologist,
      getMyReviews,
    }),
    [reviews, submitReview, fetchReviewsForPsychologist, getMyReviews],
  );

  return (
    <ReviewContext.Provider value={value}>
      {children}
    </ReviewContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReview() {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReview must be used within a ReviewProvider');
  }
  return context;
}
