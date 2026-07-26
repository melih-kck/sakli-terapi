import { Link } from 'react-router';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from '../context/ToastContext';
import '../styles/pages/Notifications.css';

const formatNotificationDate = (value) => new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    isLoading,
    loadError,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const { error: showError } = useToast();

  const handleMarkAll = async () => {
    const result = await markAllAsRead();
    if (!result.success) showError('Bildirimler Güncellenemedi', result.error);
  };

  const handleOpen = async (notification) => {
    if (!notification.readAt) await markAsRead(notification.id);
  };

  return (
    <div className="page">
      <Navbar />
      <main className="page-content notifications-page">
        <div className="container container-sm">
          <header className="notifications-header">
            <div>
              <h1>Bildirimler</h1>
              <p>Hesabınız ve randevularınızla ilgili güncellemeler.</p>
            </div>
            {unreadCount > 0 && (
              <button type="button" className="btn btn-outline btn-sm" onClick={handleMarkAll}>
                Tümünü okundu işaretle
              </button>
            )}
          </header>

          {isLoading && notifications.length === 0 && (
            <div className="notifications-state">Bildirimler yükleniyor...</div>
          )}

          {!isLoading && loadError && (
            <div className="notifications-state notifications-error">{loadError}</div>
          )}

          {!isLoading && !loadError && notifications.length === 0 && (
            <div className="notifications-state">
              <span className="notifications-empty-icon" aria-hidden="true">🔔</span>
              <h2>Henüz bildiriminiz yok</h2>
              <p>Yeni bir hesap veya randevu güncellemesi olduğunda burada göreceksiniz.</p>
            </div>
          )}

          {notifications.length > 0 && (
            <div className="notifications-list" aria-live="polite">
              {notifications.map((notification) => {
                const content = (
                  <>
                    <span className="notification-dot" aria-hidden="true" />
                    <span className="notification-copy">
                      <strong>{notification.title}</strong>
                      <span>{notification.message}</span>
                      <time dateTime={notification.createdAt}>
                        {formatNotificationDate(notification.createdAt)}
                      </time>
                    </span>
                    {notification.actionUrl && <span className="notification-arrow" aria-hidden="true">→</span>}
                  </>
                );

                return notification.actionUrl ? (
                  <Link
                    key={notification.id}
                    to={notification.actionUrl}
                    className={`notification-item ${notification.readAt ? 'read' : 'unread'}`}
                    onClick={() => handleOpen(notification)}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={notification.id}
                    type="button"
                    className={`notification-item ${notification.readAt ? 'read' : 'unread'}`}
                    onClick={() => handleOpen(notification)}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
