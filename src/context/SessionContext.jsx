/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getSessionSlotKey, isSessionSlotInPast } from '../lib/session-flow';
import { useToast } from './ToastContext';

// ─── Constants ──────────────────────────────────────────────────────────────────

const SessionContext = createContext(null);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ─── Normalizers ────────────────────────────────────────────────────────────────

const normalizeSession = (session) => ({
  id: session.id,
  clientId: session.client_id || session.clientId,
  psychologistId: session.psychologist_id || session.psychologistId,
  clientAlias: session.client_alias || session.clientAlias,
  psychologistName: session.psychologist_name || session.psychologistName,
  psychologistInitials: session.psychologist_initials || session.psychologistInitials,
  date: session.scheduled_date || session.date,
  time: session.scheduled_time || session.time,
  channel: session.channel,
  status: session.status || 'upcoming',
  paymentStatus: session.payment_status || session.paymentStatus || 'pending',
  reviewed: Boolean(session.reviewed),
  fee: session.fee || session.price || null,
  paidAt: session.paid_at || session.paidAt || null,
  completedAt: session.completed_at || session.completedAt || null,
  cancellationReason: session.cancellation_reason || session.cancellationReason || '',
  createdAt: session.created_at || session.createdAt,
});

/**
 * Converts camelCase frontend update keys to snake_case Supabase column names.
 */
const toSessionUpdatePayload = (updates) => {
  const payload = {};
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.paymentStatus !== undefined) payload.payment_status = updates.paymentStatus;
  if (updates.reviewed !== undefined) payload.reviewed = updates.reviewed;
  if (updates.date !== undefined) payload.scheduled_date = updates.date;
  if (updates.time !== undefined) payload.scheduled_time = updates.time;
  if (updates.channel !== undefined) payload.channel = updates.channel;
  if (updates.fee !== undefined) payload.fee = updates.fee;
  if (updates.clientAlias !== undefined) payload.client_alias = updates.clientAlias;
  if (updates.psychologistName !== undefined) payload.psychologist_name = updates.psychologistName;
  if (updates.psychologistInitials !== undefined) payload.psychologist_initials = updates.psychologistInitials;
  if (updates.cancellationReason !== undefined) payload.cancellation_reason = updates.cancellationReason;
  if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt;
  if (updates.paidAt !== undefined) payload.paid_at = updates.paidAt;
  return payload;
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

const isMockUser = (user) => Boolean(user?.id?.startsWith('mock-'));

const persistMockSessions = (user, sessions) => {
  if (!isMockUser(user)) return;
  try {
    const stored = localStorage.getItem('mock_user_session');
    if (stored) {
      const mockUser = JSON.parse(stored);
      mockUser.sessions = sessions;
      localStorage.setItem('mock_user_session', JSON.stringify(mockUser));
    }
  } catch (err) {
    console.warn('Mock oturum verileri kaydedilemedi:', err);
  }
};

// ─── Provider ───────────────────────────────────────────────────────────────────

export function SessionProvider({ user, children }) {
  const [sessions, setSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const { success, error: showError } = useToast();

  // ── refreshSessions ─────────────────────────────────────────────────────────
  const refreshSessions = useCallback(async () => {
    if (!user?.id) return [];

    // Mock users: read sessions from localStorage
    if (import.meta.env.DEV && isMockUser(user)) {
      try {
        const stored = localStorage.getItem('mock_user_session');
        if (stored) {
          const mockUser = JSON.parse(stored);
          const normalized = (mockUser.sessions || []).map(normalizeSession);
          setSessions(normalized);
          return normalized;
        }
      } catch {
        // ignore parse errors
      }
      return [];
    }

    // Real users: fetch from Supabase
    setIsLoadingSessions(true);
    try {
      const column = user.role === 'psychologist' ? 'psychologist_id' : 'client_id';
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq(column, user.id)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true });

      if (error) {
        console.warn('Randevular çekilemedi:', error);
        showError('Randevular Yüklenemedi', error.message);
        return [];
      }

      const normalized = (data || []).map(normalizeSession);
      setSessions(normalized);
      return normalized;
    } catch (err) {
      console.error('Randevular çekilirken hata:', err);
      showError('Randevular Yüklenemedi', 'Beklenmeyen bir hata oluştu.');
      return [];
    } finally {
      setIsLoadingSessions(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, showError]);

  // ── Auto-fetch sessions when user changes ───────────────────────────────────
  useEffect(() => {
    if (user?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refreshSessions();
    } else {
      setSessions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  const fetchBookedSlots = useCallback(async (psychologistId, rangeStart, rangeEnd) => {
    if (!user || user.role !== 'client') {
      return { success: true, slots: [], slotKeys: [] };
    }

    if (!UUID_PATTERN.test(String(psychologistId))) {
      return import.meta.env.DEV
        ? { success: true, slots: [], slotKeys: [] }
        : { success: false, error: 'Geçersiz psikolog kaydı.', slots: [], slotKeys: [] };
    }

    try {
      const { data, error } = await supabase.rpc('get_booked_slots', {
        target_psychologist_id: psychologistId,
        range_start: rangeStart,
        range_end: rangeEnd,
      });

      if (error) {
        console.warn('Dolu randevu saatleri alınamadı:', error);
        return { success: false, error: error.message, slots: [], slotKeys: [] };
      }

      const slots = data || [];
      return {
        success: true,
        slots,
        slotKeys: slots.map((slot) => getSessionSlotKey(slot.scheduled_date, slot.scheduled_time)),
      };
    } catch (err) {
      console.warn('Dolu randevu saatleri alınırken hata:', err);
      return { success: false, error: err.message, slots: [], slotKeys: [] };
    }
  }, [user]);

  // ── bookSession ─────────────────────────────────────────────────────────────
  const bookSession = useCallback(async (sessionData) => {
    if (!user) {
      return { success: false, error: 'Randevu oluşturmak için giriş yapmalısınız.' };
    }

    if (user.role !== 'client') {
      const message = 'Randevu yalnızca danışan hesabıyla oluşturulabilir.';
      showError('Randevu Oluşturulamadı', message);
      return { success: false, error: message };
    }

    // Local / mock fallback
    if (
      import.meta.env.DEV
      && (isMockUser(user) || !UUID_PATTERN.test(String(sessionData.psychologistId)))
    ) {
      const fallbackSession = normalizeSession({
        ...sessionData,
        id: sessionData.id || `local-${crypto.randomUUID()}`,
        client_id: user.id,
        psychologist_id: sessionData.psychologistId,
        client_alias: sessionData.clientAlias || user.alias || 'Anonim Danışan',
        psychologist_name: sessionData.psychologistName || null,
        psychologist_initials: sessionData.psychologistInitials || null,
        scheduled_date: sessionData.date,
        scheduled_time: sessionData.time,
        channel: sessionData.channel,
        status: 'upcoming',
        payment_status: sessionData.paymentStatus || 'pending',
        reviewed: false,
        fee: sessionData.fee || null,
      });

      setSessions((prev) => {
        const next = [...prev, fallbackSession];
        persistMockSessions(user, next);
        return next;
      });

      success('Randevu Oluşturuldu', 'Randevunuz başarıyla kaydedildi.');
      return { success: true, session: fallbackSession, isLocalFallback: true };
    }

    if (!UUID_PATTERN.test(String(sessionData.psychologistId))) {
      const message = 'Geçersiz psikolog kaydı.';
      showError('Randevu Oluşturulamadı', message);
      return { success: false, error: message };
    }

    if (!sessionData.date || !sessionData.time || !sessionData.channel) {
      const message = 'Tarih, saat ve görüşme tipi seçilmelidir.';
      showError('Randevu Oluşturulamadı', message);
      return { success: false, error: message };
    }

    if (isSessionSlotInPast(sessionData.date, sessionData.time)) {
      const message = 'Geçmiş bir tarih veya saat için randevu oluşturulamaz.';
      showError('Randevu Oluşturulamadı', message);
      return { success: false, error: message };
    }

    const bookedSlots = await fetchBookedSlots(
      sessionData.psychologistId,
      sessionData.date,
      sessionData.date,
    );
    const requestedSlotKey = getSessionSlotKey(sessionData.date, sessionData.time);

    if (bookedSlots.success && bookedSlots.slotKeys.includes(requestedSlotKey)) {
      const message = 'Bu saat kısa süre önce doldu. Lütfen başka bir saat seçin.';
      showError('Randevu Oluşturulamadı', message);
      return { success: false, error: message, code: 'slot_taken' };
    }

    // Real Supabase insert
    const payload = {
      client_id: user.id,
      psychologist_id: sessionData.psychologistId,
      client_alias: sessionData.clientAlias || user.alias || 'Anonim Danışan',
      psychologist_name: sessionData.psychologistName || null,
      psychologist_initials: sessionData.psychologistInitials || null,
      scheduled_date: sessionData.date,
      scheduled_time: sessionData.time,
      channel: sessionData.channel,
      status: 'upcoming',
      payment_status: sessionData.paymentStatus || 'pending',
      reviewed: false,
      fee: sessionData.fee || null,
    };

    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert([payload])
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          const message = 'Bu saat kısa süre önce doldu. Lütfen başka bir saat seçin.';
          showError('Randevu Oluşturulamadı', message);
          return { success: false, error: message, code: 'slot_taken' };
        }
        showError('Randevu Oluşturulamadı', error.message);
        return { success: false, error: error.message };
      }

      const normalized = normalizeSession(data);
      setSessions((prev) => [...prev, normalized]);
      success('Randevu Oluşturuldu', 'Randevunuz başarıyla kaydedildi.');
      return { success: true, session: normalized };
    } catch (err) {
      console.error('Randevu oluşturulurken hata:', err);
      showError('Randevu Oluşturulamadı', 'Beklenmeyen bir hata oluştu.');
      return { success: false, error: err.message };
    }
  }, [user, success, showError, fetchBookedSlots]);

  // ── updateSession ───────────────────────────────────────────────────────────
  const updateSession = useCallback(async (sessionId, updates) => {
    if (!user) {
      return { success: false, error: 'Randevu güncellemek için giriş yapmalısınız.' };
    }

    // Helper: apply updates locally and persist mock data
    const applyLocalUpdate = (mergedUpdates) => {
      setSessions((prev) => {
        const next = prev.map((item) =>
          String(item.id) === String(sessionId) ? { ...item, ...mergedUpdates } : item
        );
        persistMockSessions(user, next);
        return next;
      });
    };

    // Local / mock fallback
    if (
      import.meta.env.DEV
      && (isMockUser(user) || !UUID_PATTERN.test(String(sessionId)))
    ) {
      applyLocalUpdate(updates);
      return { success: true, session: updates, isLocalFallback: true };
    }

    // Real Supabase update
    const payload = toSessionUpdatePayload(updates);

    if (Object.keys(payload).length === 0) {
      // Nothing to update in Supabase, apply locally only
      applyLocalUpdate(updates);
      return { success: true, session: updates };
    }

    try {
      const { data, error } = await supabase
        .from('sessions')
        .update(payload)
        .eq('id', sessionId)
        .select('*')
        .single();

      if (error) {
        showError('Randevu Güncellenemedi', error.message);
        return { success: false, error: error.message };
      }

      const normalized = normalizeSession(data);
      applyLocalUpdate(normalized);
      return { success: true, session: normalized };
    } catch (err) {
      console.error('Randevu güncellenirken hata:', err);
      showError('Randevu Güncellenemedi', 'Beklenmeyen bir hata oluştu.');
      return { success: false, error: err.message };
    }
  }, [user, showError]);

  // ── markSessionReviewed ─────────────────────────────────────────────────────
  const markSessionReviewed = useCallback(async (sessionId) => {
    if (
      import.meta.env.DEV
      && (isMockUser(user) || !UUID_PATTERN.test(String(sessionId)))
    ) {
      return updateSession(sessionId, { reviewed: true });
    }

    // Real Supabase reviews are marked through the database trigger.
    setSessions((prev) => prev.map((item) => (
      String(item.id) === String(sessionId) ? { ...item, reviewed: true } : item
    )));
    return { success: true };
  }, [user, updateSession]);

  // ── Context value ───────────────────────────────────────────────────────────
  const value = {
    sessions,
    bookSession,
    fetchBookedSlots,
    updateSession,
    refreshSessions,
    markSessionReviewed,
    isLoadingSessions,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
