/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const NotificationContext = createContext(null);

const normalizeNotification = (notification) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  actionUrl: notification.action_url,
  readAt: notification.read_at,
  createdAt: notification.created_at,
});

export function NotificationProvider({ user, children }) {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const userId = user?.id;

  const loadNotifications = useCallback(async () => {
    if (!userId || userId.startsWith('mock-')) {
      setNotifications([]);
      setLoadError('');
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, message, action_url, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Bildirimler yüklenemedi:', error);
      setLoadError('Bildirimler şu anda yüklenemiyor.');
    } else {
      setNotifications((data || []).map(normalizeNotification));
      setLoadError('');
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    Promise.resolve().then(loadNotifications);
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId || userId.startsWith('mock-')) return undefined;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => loadNotifications(),
      )
      .subscribe();

    const handleFocus = () => loadNotifications();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(channel);
    };
  }, [loadNotifications, userId]);

  const markAsRead = useCallback(async (notificationId) => {
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('id', notificationId)
      .is('read_at', null);

    if (error) return { success: false, error: error.message };

    setNotifications((current) => current.map((notification) => (
      notification.id === notificationId
        ? { ...notification, readAt: notification.readAt || readAt }
        : notification
    )));
    return { success: true };
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return { success: false, error: 'Oturum bulunamadı.' };

    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .is('read_at', null);

    if (error) return { success: false, error: error.message };

    setNotifications((current) => current.map((notification) => ({
      ...notification,
      readAt: notification.readAt || readAt,
    })));
    return { success: true };
  }, [userId]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    isLoading,
    loadError,
    refresh: loadNotifications,
    markAsRead,
    markAllAsRead,
  }), [
    notifications,
    unreadCount,
    isLoading,
    loadError,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
