import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useReview } from '../context/ReviewContext';
import { useSession } from '../context/SessionContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import {
  formatLocalDateIso,
  getSessionDateTime,
  getSessionJoinState,
  getSessionReference,
} from '../lib/session-flow';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import RatingStars from '../components/RatingStars';
import '../styles/pages/Dashboard.css';

const statusDetails = {
  upcoming: { className: 'is-upcoming' },
  completed: { className: 'is-completed' },
  cancelled: { className: 'is-cancelled' },
};

const paymentDetails = {
  pending: { className: 'is-pending' },
  paid: { className: 'is-paid' },
  failed: { className: 'is-failed' },
  refunded: { className: 'is-refunded' },
};

const getPaymentDetails = (session, t) => (
  session.paymentRequired
    ? {
        ...(paymentDetails[session.paymentStatus] || paymentDetails.pending),
        label: t(`dashboard.payments.${session.paymentStatus || 'pending'}`),
      }
    : { label: t('dashboard.payments.deferred'), className: 'is-deferred' }
);

export default function PsychDashboard() {
  const { user, isPsychologist, refreshUserProfile } = useAuth();
  const { fetchReviewsForPsychologist } = useReview();
  const { updateSession, sessions } = useSession();
  const { success } = useToast();
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('today');
  const [updatingSessionId, setUpdatingSessionId] = useState(null);
  const [myReviews, setMyReviews] = useState([]);
  const currentPsychologistId = user?.psychologistId || user?.psychologistProfile?.id || user?.id;

  useEffect(() => {
    refreshUserProfile();
  }, [refreshUserProfile]);

  useEffect(() => {
    let isMounted = true;

    if (!currentPsychologistId) return undefined;

    fetchReviewsForPsychologist(currentPsychologistId).then((loadedReviews) => {
      if (isMounted) setMyReviews(loadedReviews.slice(0, 3));
    });

    return () => {
      isMounted = false;
    };
  }, [currentPsychologistId, fetchReviewsForPsychologist]);

  useEffect(() => {
    if (!user || !isPsychologist) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [user, isPsychologist]);

  if (!user || !isPsychologist) return null;

  const formatDateIso = (offsetDays = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return formatLocalDateIso(date);
  };

  const todayIso = formatDateIso();
  const tomorrowIso = formatDateIso(1);
  const legacyUtcTodayIso = new Date().toISOString().split('T')[0];
  const activeDateIso = activeTab === 'tomorrow' ? tomorrowIso : todayIso;
  const locale = language === 'en' ? 'en-US' : 'tr-TR';
  const activeDateLabel = activeTab === 'tomorrow'
    ? t('dashboard.psychologist.tomorrow')
    : t('dashboard.psychologist.today');
  const getDisplayDate = (appointment) => (
    appointment.date === legacyUtcTodayIso && todayIso !== legacyUtcTodayIso ? todayIso : appointment.date
  );

  const sortByAppointmentTime = (a, b) => (
    `${getDisplayDate(a)} ${a.time}`.localeCompare(`${getDisplayDate(b)} ${b.time}`)
  );

  const allAppointments = (sessions || []).slice().sort(sortByAppointmentTime);
  const activeAppointments = allAppointments.filter(appointment => (
    appointment.status === 'upcoming'
    && (appointment.date >= todayIso || appointment.date === legacyUtcTodayIso)
  ));
  const archivedAppointments = allAppointments
    .filter(appointment => appointment.status === 'completed' || appointment.status === 'cancelled')
    .sort((a, b) => sortByAppointmentTime(b, a));
  const todayAppointments = activeAppointments.filter(appointment => (
    appointment.date === todayIso || appointment.date === legacyUtcTodayIso
  ));
  const tomorrowAppointments = activeAppointments.filter(appointment => appointment.date === tomorrowIso);
  const completedAppointments = allAppointments.filter(appointment => appointment.status === 'completed');
  const cancelledAppointments = allAppointments.filter(appointment => appointment.status === 'cancelled');
  const unpaidAppointments = activeAppointments.filter(appointment => (
    appointment.paymentRequired && appointment.paymentStatus === 'pending'
  ));

  const visibleAppointments = activeTab === 'archive'
    ? archivedAppointments
    : activeTab === 'upcoming'
      ? activeAppointments
      : activeAppointments.filter(appointment => (
        appointment.date === activeDateIso
        || (activeTab === 'today' && appointment.date === legacyUtcTodayIso)
      ));

  const emptyAppointmentMessage = activeTab === 'archive'
    ? t('dashboard.psychologist.noArchive')
    : activeTab === 'upcoming'
      ? t('dashboard.psychologist.noUpcoming')
      : t('dashboard.psychologist.noDay', { day: activeDateLabel });

  const formatAppointmentDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const formatAppointmentDateShort = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  });

  const getChannelDetails = (channel) => {
    if (channel === 'video-blur') return { icon: '📹', label: t('dashboard.psychologist.channelVideo') };
    if (channel === 'voice') return { icon: '🎙️', label: t('dashboard.psychologist.channelVoice') };
    return { icon: '💬', label: t('dashboard.psychologist.channelText') };
  };

  const handleAppointmentUpdate = async (appointment, updates, toastTitle, toastMessage) => {
    setUpdatingSessionId(appointment.id);
    const result = await updateSession(appointment.id, updates);
    setUpdatingSessionId(null);

    if (result.success) {
      success(toastTitle, toastMessage);
    }
  };

  const renderAppointmentActions = (appointment) => {
    const isUpdating = String(updatingSessionId) === String(appointment.id);
    const joinState = getSessionJoinState(appointment);
    const requiresPayment = appointment.paymentRequired && appointment.paymentStatus !== 'paid';
    const startsAt = getSessionDateTime(appointment);
    const canComplete = Boolean(startsAt && startsAt <= new Date() && !requiresPayment);

    if (appointment.status === 'cancelled') {
      return (
        <>
          <span className="appointment-muted-action">{t('dashboard.psychologist.archived')}</span>
        </>
      );
    }

    if (appointment.status === 'completed') {
      return (
        <>
          <Link to="/degerlendirmeler" className="btn btn-outline btn-sm">{t('dashboard.psychologist.reviews')}</Link>
          <span className="appointment-muted-action">{t('dashboard.psychologist.sessionCompleted')}</span>
        </>
      );
    }

    return (
      <>
        {requiresPayment && (
          <button type="button" className="btn btn-outline btn-sm" disabled>
            {t('dashboard.psychologist.paymentWaiting')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm appointment-danger-action"
          disabled={isUpdating}
          onClick={() => handleAppointmentUpdate(
            appointment,
            {
              status: 'cancelled',
            },
            t('dashboard.psychologist.cancelToastTitle'),
            appointment.paymentStatus === 'paid'
              ? t('dashboard.psychologist.cancelPaidToast')
              : t('dashboard.psychologist.cancelToast')
          )}
        >
          {t('dashboard.psychologist.cancel')}
        </button>
        {canComplete && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={isUpdating}
            onClick={() => handleAppointmentUpdate(
              appointment,
              { status: 'completed', completedAt: new Date().toISOString() },
              t('dashboard.psychologist.completedToastTitle'),
              t('dashboard.psychologist.completedToast')
            )}
          >
            {t('dashboard.psychologist.completed')}
          </button>
        )}
        {joinState.canJoin ? (
          <Link to={`/seans/${appointment.id}`} className="btn btn-primary btn-sm">{t('dashboard.psychologist.goToAppointment')}</Link>
        ) : (
          <button type="button" className="btn btn-outline btn-sm" disabled>{joinState.label}</button>
        )}
      </>
    );
  };

  const todayStr = new Date().toLocaleDateString(locale, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const weekStart = new Date();
  const weekDayIndex = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - weekDayIndex);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const iso = formatLocalDateIso(date);
    return {
      iso,
      label: t('dashboard.psychologist.weekdays')[index],
      count: activeAppointments.filter(appointment => getDisplayDate(appointment) === iso).length,
      isToday: iso === todayIso,
    };
  });

  const psychologistProfile = user.psychologistProfile || {};
  const approvalStatus = psychologistProfile.approvalStatus || 'pending';
  const profileCheckLabels = t('dashboard.psychologist.profileChecks');
  const profileChecks = [
    { label: profileCheckLabels[0], done: Boolean(psychologistProfile.title) },
    { label: profileCheckLabels[1], done: Boolean(psychologistProfile.shortBio) },
    { label: profileCheckLabels[2], done: Boolean(psychologistProfile.bio) },
    { label: profileCheckLabels[3], done: (psychologistProfile.specializations || []).length > 0 },
    { label: profileCheckLabels[4], done: (psychologistProfile.approaches || []).length > 0 },
    { label: profileCheckLabels[5], done: Object.keys(psychologistProfile.availability || {}).length > 0 },
  ];
  const completedProfileChecks = profileChecks.filter(item => item.done).length;
  const profileCompleteness = Math.round((completedProfileChecks / profileChecks.length) * 100);
  const profileEditUrl = '/ayarlar?tab=profile';
  const displayName = language === 'en'
    ? user.name
        ?.replace('Klinik Psikolog Demo Uzmanı', 'Clinical Psychologist Demo Expert')
        .replace('Klinik Psikolog Demo', 'Clinical Psychologist Demo')
    : user.name;

  return (
    <div className="page">
      <Navbar />
      <main className="page-content" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="container mt-xl mb-3xl">
          <div className="dash-header mb-2xl">
            <div>
              <h1 className="dash-title">{t('dashboard.psychologist.welcome', { name: displayName || t('dashboard.psychologist.defaultName') })}</h1>
              <p className="dash-subtitle">{t('dashboard.psychologist.daySummary', { date: todayStr, count: todayAppointments.length })}</p>
            </div>
            <div className="dash-actions">
              <Link to={profileEditUrl} className="btn btn-primary">{t('dashboard.psychologist.editProfile')}</Link>
              <Link to="/ayarlar" className="btn btn-outline">{t('dashboard.psychologist.calendarSettings')}</Link>
            </div>
          </div>

          {approvalStatus !== 'approved' && (
            <section className={`psychologist-review-notice is-${approvalStatus}`}>
              <div>
                <strong>
                  {approvalStatus === 'pending' && t('dashboard.psychologist.reviewPending')}
                  {approvalStatus === 'rejected' && t('dashboard.psychologist.reviewRejected')}
                  {approvalStatus === 'suspended' && t('dashboard.psychologist.reviewSuspended')}
                </strong>
                <p>
                  {psychologistProfile.reviewReason
                    || (approvalStatus === 'pending'
                      ? t('dashboard.psychologist.reviewPendingBody')
                      : t('dashboard.psychologist.reviewSupportBody'))}
                </p>
              </div>
              <div className="psychologist-review-actions">
                <Link to="/ayarlar?tab=verification" className="btn btn-primary btn-sm">{t('dashboard.psychologist.manageDocuments')}</Link>
                <Link to="/ayarlar?tab=profile" className="btn btn-outline btn-sm">{t('dashboard.psychologist.reviewProfile')}</Link>
              </div>
            </section>
          )}

          <div className="dash-grid">
            <div className="dash-main">
              <section className="card card-elevated mb-lg animate-on-scroll">
                <div className="card-body">
                  <div className="appointment-schedule-header flex justify-between items-center mb-md">
                    <div>
                      <h3 className="m-0">{t('dashboard.psychologist.scheduleTitle')}</h3>
                      <p className="appointment-section-subtitle">
                        {t('dashboard.psychologist.scheduleSummary', {
                          active: activeAppointments.length,
                          today: todayAppointments.length,
                          tomorrow: tomorrowAppointments.length,
                          unpaid: unpaidAppointments.length,
                        })}
                      </p>
                    </div>
                    <div className="tabs-simple">
                      <button type="button" className={`tab-simple ${activeTab === 'today' ? 'active' : ''}`} aria-pressed={activeTab === 'today'} onClick={() => setActiveTab('today')}>{t('dashboard.psychologist.today')}</button>
                      <button type="button" className={`tab-simple ${activeTab === 'tomorrow' ? 'active' : ''}`} aria-pressed={activeTab === 'tomorrow'} onClick={() => setActiveTab('tomorrow')}>{t('dashboard.psychologist.tomorrow')}</button>
                      <button type="button" className={`tab-simple ${activeTab === 'upcoming' ? 'active' : ''}`} aria-pressed={activeTab === 'upcoming'} onClick={() => setActiveTab('upcoming')}>{t('dashboard.psychologist.upcoming')}</button>
                      <button type="button" className={`tab-simple ${activeTab === 'archive' ? 'active' : ''}`} aria-pressed={activeTab === 'archive'} onClick={() => setActiveTab('archive')}>{t('dashboard.psychologist.archive')}</button>
                    </div>
                  </div>

                  <div className="timeline">
                    {visibleAppointments.length === 0 && (
                      <div className="dash-empty-state">
                        <span className="dash-empty-icon">📅</span>
                        <p>{emptyAppointmentMessage}</p>
                      </div>
                    )}

                    {visibleAppointments.map((appointment) => {
                      const status = {
                        ...(statusDetails[appointment.status] || statusDetails.upcoming),
                        label: t(`dashboard.statuses.${appointment.status || 'upcoming'}`),
                      };
                      const payment = getPaymentDetails(appointment, t);
                      const displayDate = getDisplayDate(appointment);

                      return (
                        <div key={appointment.id} className={`timeline-item appointment-${appointment.status}`}>
                          <div className="timeline-time appointment-timeline-time">
                            {(activeTab === 'upcoming' || activeTab === 'archive') && <span>{formatAppointmentDateShort(displayDate)}</span>}
                            <strong>{appointment.time}</strong>
                          </div>
                          <div className="timeline-content">
                            <div className="timeline-card appointment-card">
                              <div className="appointment-card-header">
                                <div className="appointment-client">
                                  <span className="appointment-eyebrow">{t('dashboard.psychologist.appointment')}</span>
                                  <h4>{appointment.clientAlias || t('dashboard.psychologist.anonymousClient')}</h4>
                                </div>
                                <div className="appointment-badge-group">
                                  <span className={`appointment-status ${status.className}`}>{status.label}</span>
                                  <span className={`appointment-payment-badge ${payment.className}`}>{payment.label}</span>
                                </div>
                              </div>

                              <div className="appointment-detail-grid">
                                <div className="appointment-detail">
                                  <span className="appointment-label">{t('dashboard.psychologist.date')}</span>
                                  <strong>{formatAppointmentDate(displayDate)}</strong>
                                </div>
                                <div className="appointment-detail">
                                  <span className="appointment-label">{t('dashboard.psychologist.time')}</span>
                                  <strong>{appointment.time}</strong>
                                </div>
                                <div className="appointment-detail">
                                  <span className="appointment-label">{t('dashboard.psychologist.channel')}</span>
                                  <strong>{getChannelDetails(appointment.channel).icon} {getChannelDetails(appointment.channel).label}</strong>
                                </div>
                                <div className="appointment-detail">
                                  <span className="appointment-label">{t('dashboard.psychologist.reference')}</span>
                                  <strong>{getSessionReference(appointment.id)}</strong>
                                </div>
                              </div>

                              <div className="appointment-card-footer">
                                <span className="appointment-code">
                                  {t('dashboard.psychologist.flow')}
                                </span>
                                <div className="appointment-action-group">
                                  {renderAppointmentActions(appointment)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className="card card-elevated animate-on-scroll">
                <div className="card-body">
                  <div className="flex justify-between items-center mb-md">
                    <h3 className="m-0">{t('dashboard.psychologist.latestReviews')}</h3>
                    <Link to="/degerlendirmeler" className="text-primary text-sm">{t('dashboard.psychologist.viewAll')}</Link>
                  </div>
                  <div className="reviews-list-simple">
                    {myReviews.length === 0 && <p className="text-tertiary">{t('dashboard.psychologist.noReviews')}</p>}
                    {myReviews.map(review => (
                      <div key={review.id} className="review-item-simple">
                        <div className="flex justify-between mb-xs">
                          <span className="font-medium">{review.clientAlias}</span>
                          <span className="text-xs text-tertiary">{new Date(review.date).toLocaleDateString(locale)}</span>
                        </div>
                        <RatingStars rating={review.rating} size="sm" showValue={false} />
                        <p className="text-sm mt-xs m-0">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <div className="dash-sidebar">
              <section className="card card-elevated mb-lg animate-on-scroll">
                <div className="card-body p-md">
                  <div className="profile-status-header">
                    <div>
                      <h4 className="mb-xs">{t('dashboard.psychologist.profileStatus')}</h4>
                      <p className="text-xs text-tertiary m-0">{t('dashboard.psychologist.completedFields', { done: completedProfileChecks, total: profileChecks.length })}</p>
                    </div>
                    <span className="profile-status-score">{profileCompleteness}%</span>
                  </div>
                  <div className="progress-bar mt-md mb-md">
                    <div className="progress-fill" style={{ width: `${profileCompleteness}%` }}></div>
                  </div>
                  <div className="profile-check-list">
                    {profileChecks.map(item => (
                      <span key={item.label} className={`profile-check-item ${item.done ? 'done' : ''}`}>
                        {item.done ? '✓' : '•'} {item.label}
                      </span>
                    ))}
                  </div>
                  <Link to={profileEditUrl} className="btn btn-outline btn-block btn-sm mt-md">{t('dashboard.psychologist.completeProfile')}</Link>
                </div>
              </section>

              <div className="grid grid-2 gap-sm mb-lg animate-on-scroll">
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">📊</div>
                  <div className="dash-stat-value">{allAppointments.length}</div>
                  <div className="dash-stat-label">{t('dashboard.psychologist.totalAppointments')}</div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">✅</div>
                  <div className="dash-stat-value">{completedAppointments.length}</div>
                  <div className="dash-stat-label">{t('dashboard.psychologist.completedAppointments')}</div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">💳</div>
                  <div className="dash-stat-value">{unpaidAppointments.length}</div>
                    <div className="dash-stat-label">{t('dashboard.psychologist.unpaidAppointments')}</div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">⛔</div>
                  <div className="dash-stat-value">{cancelledAppointments.length}</div>
                  <div className="dash-stat-label">{t('dashboard.psychologist.cancelledAppointments')}</div>
                </div>
              </div>

              <section className="card card-elevated animate-on-scroll">
                <div className="card-body p-md">
                  <h4 className="mb-sm text-center">{t('dashboard.psychologist.weeklyCalendar')}</h4>
                  <div className="mini-calendar">
                    {weekDays.map(day => (
                      <div key={day.iso} className={`cal-day ${day.isToday ? 'today' : ''} ${day.count === 0 ? 'off' : ''}`}>
                        <span className="cal-name">{day.label}</span>
                        <span className="cal-dot-container">
                          {day.count > 0 ? <span className="cal-dot"></span> : null}
                        </span>
                        {day.count > 0 && <span className="cal-count">{day.count}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
