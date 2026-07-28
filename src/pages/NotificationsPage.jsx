import { Link } from 'react-router';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import '../styles/pages/Notifications.css';

const formatNotificationDate = (value, locale) => new Intl.DateTimeFormat(locale, {
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
  const { language, t } = useLanguage();
  const locale = language === 'en' ? 'en-US' : 'tr-TR';

  const handleMarkAll = async () => {
    const result = await markAllAsRead();
    if (!result.success) showError(t('notificationsPage.updateError'), result.error);
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
              <h1>{t('notificationsPage.title')}</h1>
              <p>{t('notificationsPage.subtitle')}</p>
            </div>
            {unreadCount > 0 && (
              <button type="button" className="btn btn-outline btn-sm" onClick={handleMarkAll}>
                {t('notificationsPage.markAll')}
              </button>
            )}
          </header>

          {isLoading && notifications.length === 0 && (
            <div className="notifications-state">{t('notificationsPage.loading')}</div>
          )}

          {!isLoading && loadError && (
            <div className="notifications-state notifications-error">{loadError}</div>
          )}

          {!isLoading && !loadError && notifications.length === 0 && (
            <div className="notifications-state">
              <span className="notifications-empty-icon" aria-hidden="true">🔔</span>
              <h2>{t('notificationsPage.emptyTitle')}</h2>
              <p>{t('notificationsPage.emptyBody')}</p>
            </div>
          )}

          {notifications.length > 0 && (
            <div className="notifications-list" aria-live="polite">
              {notifications.map((notification) => {
                const demoCopy = t(`notificationsPage.demo.${notification.id}`);
                const localizedTitle = Array.isArray(demoCopy) ? demoCopy[0] : notification.title;
                const localizedMessage = Array.isArray(demoCopy) ? demoCopy[1] : notification.message;
                const content = (
                  <>
                    <span className="notification-dot" aria-hidden="true" />
                    <span className="notification-copy">
                      <strong>{localizedTitle}</strong>
                      <span>{localizedMessage}</span>
                      <time dateTime={notification.createdAt}>
                        {formatNotificationDate(notification.createdAt, locale)}
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
