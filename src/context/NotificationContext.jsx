/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const NotificationContext = createContext(null);
const getDemoNotificationKey = (role) => `sakli-terapi-demo-notifications-${role || 'client'}`;

const normalizeNotification = (notification) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  actionUrl: notification.action_url,
  readAt: notification.read_at,
  createdAt: notification.created_at,
});

const createDemoNotifications = (role) => {
  const now = Date.now();
  const common = [
    {
      id: 'demo-notification-safety',
      type: 'system',
      title: 'Portföy demosuna hoş geldiniz',
      message: 'Bu oturum yalnızca kurgusal veriler içerir ve gerçek sağlık hizmeti oluşturmaz.',
      actionUrl: '/hakkinda',
      readAt: null,
      createdAt: new Date(now - 20 * 60 * 1000).toISOString(),
    },
  ];

  if (role === 'admin') {
    return [
      {
        id: 'demo-notification-application',
        type: 'psychologist_application',
        title: 'Kurgusal başvuru inceleme bekliyor',
        message: 'Demo belge doğrulama akışını yönetici panelinden inceleyebilirsiniz.',
        actionUrl: '/admin',
        readAt: null,
        createdAt: new Date(now - 60 * 60 * 1000).toISOString(),
      },
      ...common,
    ];
  }

  return [
    {
      id: 'demo-notification-session',
      type: 'session_reminder',
      title: 'Demo seans odası hazır',
      message: 'Gizlilik kontrollerini incelemek için kurgusal seans kaydını açabilirsiniz.',
      actionUrl: role === 'psychologist' ? '/psikolog-panel' : '/panel',
      readAt: null,
      createdAt: new Date(now - 45 * 60 * 1000).toISOString(),
    },
    ...common,
  ];
};

const loadDemoNotifications = (role) => {
  const storageKey = getDemoNotificationKey(role);
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) return JSON.parse(stored);
  } catch {
    localStorage.removeItem(storageKey);
  }

  const notifications = createDemoNotifications(role);
  localStorage.setItem(storageKey, JSON.stringify(notifications));
  return notifications;
};

const persistDemoNotifications = (role, notifications) => {
  localStorage.setItem(getDemoNotificationKey(role), JSON.stringify(notifications));
};

export function NotificationProvider({ user, children }) {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const userId = user?.id;

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoadError('');
      return;
    }

    if (userId.startsWith('mock-')) {
      setNotifications(loadDemoNotifications(user?.role));
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
  }, [user?.role, userId]);

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
    if (userId?.startsWith('mock-')) {
      setNotifications((current) => {
        const next = current.map((notification) => (
        notification.id === notificationId
          ? { ...notification, readAt: notification.readAt || readAt }
          : notification
        ));
        persistDemoNotifications(user?.role, next);
        return next;
      });
      return { success: true };
    }

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
  }, [user?.role, userId]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return { success: false, error: 'Oturum bulunamadı.' };

    const readAt = new Date().toISOString();
    if (userId.startsWith('mock-')) {
      setNotifications((current) => {
        const next = current.map((notification) => ({
          ...notification,
          readAt: notification.readAt || readAt,
        }));
        persistDemoNotifications(user?.role, next);
        return next;
      });
      return { success: true };
    }

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
  }, [user?.role, userId]);

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
