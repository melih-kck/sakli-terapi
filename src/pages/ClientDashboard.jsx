import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { useProfile } from '../context/ProfileContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import { COMMUNICATION_CHANNELS, SPECIALIZATIONS } from '../data/constants';
import { fetchApprovedPsychologists, getDemoPsychologists } from '../lib/psychologists';
import {
  formatCurrency,
  formatLocalDateIso,
  getSessionFee,
  getSessionJoinState,
  getSessionReference,
} from '../lib/session-flow';
import { ALLOW_LOCAL_SIMULATION, IS_DEMO_MODE } from '../config/runtime';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MoodTracker from '../components/MoodTracker';
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

export default function ClientDashboard() {
  const { user, isClient } = useAuth();
  const { updateSession, sessions } = useSession();
  const { addMoodEntry } = useProfile();
  const { success } = useToast();
  const { language, t } = useLanguage();
  const [sessionToCancel, setSessionToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [updatingSessionId, setUpdatingSessionId] = useState(null);
  const [psychologists, setPsychologists] = useState([]);

  useEffect(() => {
    let isMounted = true;

    fetchApprovedPsychologists()
      .then((data) => {
        if (isMounted) setPsychologists(data.length > 0 ? data : getDemoPsychologists());
      })
      .catch((error) => {
        console.warn('Önerilen psikologlar yüklenemedi:', error);
        if (isMounted) setPsychologists(getDemoPsychologists());
      });

    return () => {
      isMounted = false;
    };
  }, []);



  useEffect(() => {
    if (!user || !isClient) return undefined;

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
  }, [user, isClient]);

  if (!user || !isClient) return null;

  const getPsychologist = (id) => psychologists.find(p => String(p.id) === String(id));
  const getChannel = (channelId) => COMMUNICATION_CHANNELS.find(channel => channel.id === channelId);
  const locale = language === 'en' ? 'en-US' : 'tr-TR';
  const formatSessionDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(locale);
  const formatSessionDateLong = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const upcomingSessions = (sessions?.filter(session => session.status === 'upcoming') || [])
    .slice()
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const pastSessions = (sessions?.filter(session => session.status === 'completed' || session.status === 'cancelled') || [])
    .slice()
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const completedSessions = pastSessions.filter(session => session.status === 'completed');
  const reviewedSessions = completedSessions.filter(session => session.reviewed);
  const pendingPayments = upcomingSessions.filter(session => (
    session.paymentRequired && session.paymentStatus === 'pending'
  ));

  const todayMood = user.moodHistory?.find(mood => mood.date === formatLocalDateIso())?.mood;
  const avgMood = user.moodHistory?.length > 0
    ? Math.round(user.moodHistory.reduce((acc, curr) => acc + curr.mood, 0) / user.moodHistory.length)
    : 0;

  const clientTopics = user.clientProfile?.topics || [];
  const recommendedPsychologists = psychologists
    .map(psychologist => ({
      ...psychologist,
      matchScore: (psychologist.specializations || []).filter(spec => clientTopics.includes(spec)).length,
    }))
    .sort((a, b) => b.matchScore - a.matchScore || b.rating - a.rating)
    .slice(0, 3);
  const getTopicLabel = (topicId) => t(`specializations.${topicId}`) || SPECIALIZATIONS.find(spec => spec.id === topicId)?.label || topicId;
  const getLocalizedName = (name) => language === 'en'
    ? name
        ?.replace('Klinik Psikolog Demo Uzmanı', 'Clinical Psychologist Demo Expert')
        .replace('Klinik Psikolog Demo', 'Clinical Psychologist Demo')
        .replace('Aday Profil Demo', 'Candidate Profile Demo')
    : name;
  const getLocalizedJoinState = (session) => {
    const state = getSessionJoinState(session);
    const [label, helper] = t(`dashboard.join.${state.code}`);
    return { ...state, label, helper };
  };

  const handleCancelSession = async (session) => {
    setUpdatingSessionId(session.id);
    const result = await updateSession(session.id, {
      status: 'cancelled',
      cancellationReason: cancelReason.trim(),
    });
    setUpdatingSessionId(null);

    if (result.success) {
      setSessionToCancel(null);
      setCancelReason('');
      success(
        t('dashboard.client.cancelToastTitle'),
        session.paymentStatus === 'paid'
          ? t('dashboard.client.cancelRefundToast')
          : t('dashboard.client.cancelToast'),
      );
    }
  };

  const handleDevPaymentBypass = async (session) => {
    if (!ALLOW_LOCAL_SIMULATION) return;

    setUpdatingSessionId(session.id);
    const result = await updateSession(session.id, {
      paymentStatus: 'paid',
      paidAt: new Date().toISOString(),
    });
    setUpdatingSessionId(null);

    if (result.success) {
      success(t('dashboard.client.testToastTitle'), t('dashboard.client.testToast'));
    }
  };

  const renderSessionIdentity = (session, psych) => (
    <div className="session-info">
      <div className="avatar avatar-md">{psych?.initials || session.psychologistInitials || 'P'}</div>
      <div>
        <span className="appointment-eyebrow">{t('dashboard.client.appointment')}</span>
        <h4>{getLocalizedName(psych?.name || session.psychologistName) || t('dashboard.client.psychologist')}</h4>
      </div>
    </div>
  );

  return (
    <div className="page">
      <Navbar />
      <main className="page-content" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="container mt-xl mb-3xl">
          <div className="dash-header mb-2xl">
            <div>
              <h1 className="dash-title">{t('dashboard.client.greeting', { name: user.alias })}</h1>
              <p className="dash-subtitle">{t('dashboard.client.summary', { count: upcomingSessions.length })}</p>
            </div>
            <div className="dash-actions">
              <Link to="/psikologlar" className="btn btn-primary">{t('dashboard.client.newAppointment')}</Link>
              <Link to="/ayarlar" className="btn btn-outline">{t('dashboard.client.privacySettings')}</Link>
            </div>
          </div>

          <div className="dash-grid">
            <div className="dash-main">
              <section className="card card-elevated mb-lg animate-on-scroll">
                <div className="card-body">
                  <div className="flex justify-between items-center mb-md">
                    <h3 className="m-0">{t('dashboard.client.moodQuestion')}</h3>
                    {todayMood && <span className="badge badge-success">{t('dashboard.client.saved')}</span>}
                  </div>
                  <MoodTracker
                    value={todayMood}
                    onChange={addMoodEntry}
                    history={user.moodHistory}
                  />
                </div>
              </section>

              <section className="card card-elevated mb-lg animate-on-scroll">
                <div className="card-body">
                  <div className="appointment-schedule-header flex justify-between items-center mb-md">
                    <div>
                      <h3 className="m-0">{t('dashboard.client.upcomingTitle')}</h3>
                      <p className="appointment-section-subtitle">
                        {IS_DEMO_MODE
                          ? t('dashboard.client.demoUpcoming', { count: upcomingSessions.length })
                          : t('dashboard.client.liveUpcoming', { count: upcomingSessions.length, payments: pendingPayments.length })}
                      </p>
                    </div>
                  </div>

                  {upcomingSessions.length > 0 ? (
                    <div className="session-list">
                      {upcomingSessions.map(session => {
                        const psych = getPsychologist(session.psychologistId);
                        const channel = getChannel(session.channel);
                        const status = {
                          ...(statusDetails[session.status] || statusDetails.upcoming),
                          label: t(`dashboard.statuses.${session.status || 'upcoming'}`),
                        };
                        const payment = getPaymentDetails(session, t);
                        const isCancelling = String(sessionToCancel?.id) === String(session.id);
                        const isUpdating = String(updatingSessionId) === String(session.id);
                        const joinState = getLocalizedJoinState(session);
                        const fee = getSessionFee(psych, session);
                        const hasPendingPayment = session.paymentStatus !== 'paid';
                        const requiresPayment = session.paymentRequired && hasPendingPayment;
                        const canUseDevPaymentBypass = ALLOW_LOCAL_SIMULATION && requiresPayment && (
                          String(session.id).startsWith('local-')
                          || String(session.clientId).startsWith('mock-')
                          || String(user.id).startsWith('mock-')
                        );

                        return (
                          <article key={session.id} className="appointment-card client-session-card">
                            <div className="appointment-card-header">
                              {renderSessionIdentity(session, psych)}
                              <div className="appointment-badge-group">
                                <span className={`appointment-status ${status.className}`}>{status.label}</span>
                                <span className={`appointment-payment-badge ${payment.className}`}>{payment.label}</span>
                              </div>
                            </div>

                            <div className="appointment-detail-grid">
                              <div className="appointment-detail">
                                <span className="appointment-label">{t('dashboard.client.date')}</span>
                                <strong>{formatSessionDateLong(session.date)}</strong>
                              </div>
                              <div className="appointment-detail">
                                <span className="appointment-label">{t('dashboard.client.time')}</span>
                                <strong>{session.time}</strong>
                              </div>
                              <div className="appointment-detail">
                                <span className="appointment-label">{t('dashboard.client.channel')}</span>
                                <strong>{channel?.icon} {channel ? t(`channels.${channel.id}`)[0] : session.channel}</strong>
                              </div>
                              <div className="appointment-detail">
                                <span className="appointment-label">{t('dashboard.client.reference')}</span>
                                <strong>{getSessionReference(session.id)}</strong>
                              </div>
                            </div>

                            {hasPendingPayment && (
                              <div className="session-payment-box">
                                <div>
                                  <span className="appointment-eyebrow">{t('dashboard.client.plannedFee')}</span>
                                  <strong>{IS_DEMO_MODE ? t('dashboard.client.demoNoFee') : formatCurrency(fee)}</strong>
                                  <p>
                                    {session.paymentRequired
                                      ? t('dashboard.client.paidRoom')
                                      : t('dashboard.client.deferredPayment')}
                                  </p>
                                </div>
                                <span className="appointment-muted-action">
                                  {session.paymentRequired ? t('dashboard.client.paymentWaiting') : t('dashboard.client.collectionClosed')}
                                </span>
                                {canUseDevPaymentBypass && (
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    disabled={isUpdating}
                                    onClick={() => handleDevPaymentBypass(session)}
                                  >
                                    {t('dashboard.client.skipForTest')}
                                  </button>
                                )}
                              </div>
                            )}

                            {isCancelling && (
                              <div className="session-cancel-box">
                                <div className="input-group">
                                  <label htmlFor={`cancel-reason-${session.id}`}>{t('dashboard.client.cancellationReason')}</label>
                                  <textarea
                                    id={`cancel-reason-${session.id}`}
                                    rows="3"
                                    value={cancelReason}
                                    onChange={(event) => setCancelReason(event.target.value)}
                                    placeholder={t('dashboard.client.cancellationPlaceholder')}
                                  />
                                </div>
                                <div className="session-cancel-actions">
                                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSessionToCancel(null); setCancelReason(''); }}>
                                    {t('dashboard.client.dismiss')}
                                  </button>
                                  <button type="button" className="btn btn-danger btn-sm" disabled={isUpdating} onClick={() => handleCancelSession(session)}>
                                    {t('dashboard.client.confirmCancellation')}
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="appointment-card-footer">
                              <span className="appointment-code">
                                  {joinState.helper}
                              </span>
                              <div className="appointment-action-group">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm appointment-danger-action"
                                  disabled={isUpdating}
                                  onClick={() => setSessionToCancel(session)}
                                >
                                  {t('dashboard.client.cancel')}
                                </button>
                                {requiresPayment ? (
                                  <>
                                    <button type="button" className="btn btn-primary btn-sm" disabled>
                                      {t('dashboard.client.paymentWaiting')}
                                    </button>
                                    {canUseDevPaymentBypass && (
                                      <button type="button" className="btn btn-outline btn-sm" disabled={isUpdating} onClick={() => handleDevPaymentBypass(session)}>
                                        {t('dashboard.client.skipForTest')}
                                      </button>
                                    )}
                                  </>
                                ) : joinState.canJoin ? (
                                  <Link to={`/seans/${session.id}`} className="btn btn-primary btn-sm">{t('dashboard.client.join')}</Link>
                                ) : (
                                  <button type="button" className="btn btn-outline btn-sm" disabled>{joinState.label}</button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="dash-empty-state">
                      <span className="dash-empty-icon">📅</span>
                      <p>{t('dashboard.client.noUpcoming')}</p>
                      <Link to="/psikologlar" className="btn btn-outline btn-sm mt-sm">{t('dashboard.client.findPsychologist')}</Link>
                    </div>
                  )}
                </div>
              </section>

              <section className="card card-elevated animate-on-scroll">
                <div className="card-body">
                  <h3 className="mb-md">{t('dashboard.client.pastTitle')}</h3>
                  {pastSessions.length > 0 ? (
                    <div className="session-list">
                      {pastSessions.map(session => {
                        const psych = getPsychologist(session.psychologistId);
                        const channel = getChannel(session.channel);
                        const status = {
                          ...(statusDetails[session.status] || statusDetails.completed),
                          label: t(`dashboard.statuses.${session.status || 'completed'}`),
                        };
                        const payment = getPaymentDetails(session, t);

                        return (
                          <article key={session.id} className={`appointment-card client-session-card appointment-${session.status}`}>
                            <div className="appointment-card-header">
                              {renderSessionIdentity(session, psych)}
                              <div className="appointment-badge-group">
                                <span className={`appointment-status ${status.className}`}>{status.label}</span>
                                <span className={`appointment-payment-badge ${payment.className}`}>{payment.label}</span>
                              </div>
                            </div>

                            <div className="appointment-detail-grid">
                              <div className="appointment-detail">
                                <span className="appointment-label">{t('dashboard.client.date')}</span>
                                <strong>{formatSessionDate(session.date)}</strong>
                              </div>
                              <div className="appointment-detail">
                                <span className="appointment-label">{t('dashboard.client.time')}</span>
                                <strong>{session.time}</strong>
                              </div>
                              <div className="appointment-detail">
                                <span className="appointment-label">{t('dashboard.client.channel')}</span>
                                <strong>{channel?.icon} {channel ? t(`channels.${channel.id}`)[0] : session.channel}</strong>
                              </div>
                              <div className="appointment-detail">
                                <span className="appointment-label">{t('dashboard.client.reference')}</span>
                                <strong>{getSessionReference(session.id)}</strong>
                              </div>
                            </div>

                            <div className="appointment-card-footer">
                              <span className="appointment-code">
                                {session.status === 'cancelled'
                                  ? t('dashboard.client.cancelledNote')
                                  : session.reviewed
                                    ? t('dashboard.client.reviewedNote')
                                    : t('dashboard.client.reviewWaitingNote')}
                              </span>
                              <div className="appointment-action-group">
                                {session.status === 'cancelled' ? (
                                  <span className="badge badge-danger">{t('dashboard.statuses.cancelled')}</span>
                                ) : session.reviewed ? (
                                  <span className="badge badge-success">{t('dashboard.client.reviewed')}</span>
                                ) : (
                                  <Link to={`/degerlendirme?session=${session.id}`} className="btn btn-warning btn-sm">{t('dashboard.client.review')}</Link>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-tertiary">{t('dashboard.client.noPast')}</p>
                  )}
                </div>
              </section>
            </div>

            <div className="dash-sidebar">
              <div className="grid grid-2 gap-sm mb-lg animate-on-scroll">
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">📊</div>
                  <div className="dash-stat-value">{sessions?.length || 0}</div>
                  <div className="dash-stat-label">{t('dashboard.client.totalAppointments')}</div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">{avgMood > 0 ? ['😢', '😞', '😐', '🙂', '😄'][avgMood - 1] : '–'}</div>
                  <div className="dash-stat-value">{avgMood > 0 ? `${avgMood}/5` : '-'}</div>
                  <div className="dash-stat-label">{t('dashboard.client.mood')}</div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">🔒</div>
                  <div className="dash-stat-value">{user.privacyLevel}/5</div>
                  <div className="dash-stat-label">{t('dashboard.client.privacyLevel')}</div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">⭐</div>
                  <div className="dash-stat-value">{reviewedSessions.length}/{completedSessions.length}</div>
                  <div className="dash-stat-label">{t('dashboard.client.reviews')}</div>
                </div>
              </div>

              {clientTopics.length > 0 && (
                <section className="card card-elevated mb-lg animate-on-scroll">
                  <div className="card-body p-md">
                    <h4 className="mb-sm">{t('dashboard.client.topics')}</h4>
                    <div className="profile-check-list">
                      {clientTopics.map(topic => (
                        <span key={topic} className="profile-check-item done">{getTopicLabel(topic)}</span>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              <section className="card card-elevated animate-on-scroll">
                <div className="card-body">
                  <h3 className="mb-md" style={{ fontSize: 'var(--text-md)' }}>{t('dashboard.client.recommended')}</h3>
                  <div className="recommended-list">
                    {recommendedPsychologists.map(psych => (
                      <Link to={`/psikolog/${psych.id}`} key={psych.id} className="recommended-item">
                        <div className="avatar avatar-sm">{psych.initials}</div>
                        <div className="recommended-info">
                          <span className="recommended-name">{getLocalizedName(psych.name)}</span>
                          <RatingStars rating={psych.rating} size="sm" showValue={false} />
                          {psych.matchScore > 0 && <span className="text-xs text-tertiary">{t('dashboard.client.matchingTopics', { count: psych.matchScore })}</span>}
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Link to="/psikologlar" className="btn btn-ghost btn-sm btn-block mt-md">{t('dashboard.client.viewAll')}</Link>
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
