import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { useToast } from '../context/ToastContext';
import { mockReviews } from '../data/mock-reviews';
import { getSessionJoinState } from '../lib/session-flow';
import { getLocalReviewsForPsychologist } from '../lib/local-reviews';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import RatingStars from '../components/RatingStars';
import '../styles/pages/Dashboard.css';

const statusDetails = {
  upcoming: { label: 'Planlandı', className: 'is-upcoming' },
  completed: { label: 'Tamamlandı', className: 'is-completed' },
  cancelled: { label: 'İptal edildi', className: 'is-cancelled' },
};

const paymentDetails = {
  pending: { label: 'Ödeme bekliyor', className: 'is-pending' },
  paid: { label: 'Ödeme alındı', className: 'is-paid' },
  failed: { label: 'Ödeme başarısız', className: 'is-failed' },
  refunded: { label: 'İade edildi', className: 'is-refunded' },
};

export default function PsychDashboard() {
  const { user, isPsychologist } = useAuth();
  const { updateSession, sessions } = useSession();
  const { success } = useToast();
  const [activeTab, setActiveTab] = useState('today');
  const [updatingSessionId, setUpdatingSessionId] = useState(null);



  useEffect(() => {
    if (!user || (!isPsychologist && user.role !== 'admin')) return undefined;

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

  if (!user || (!isPsychologist && user.role !== 'admin')) return null;

  const formatLocalDateIso = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateIso = (offsetDays = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return formatLocalDateIso(date);
  };

  const todayIso = formatDateIso();
  const tomorrowIso = formatDateIso(1);
  const legacyUtcTodayIso = new Date().toISOString().split('T')[0];
  const activeDateIso = activeTab === 'tomorrow' ? tomorrowIso : todayIso;
  const activeDateLabel = activeTab === 'tomorrow' ? 'Yarın' : 'Bugün';
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
  const unpaidAppointments = activeAppointments.filter(appointment => appointment.paymentStatus === 'pending');

  const visibleAppointments = activeTab === 'archive'
    ? archivedAppointments
    : activeTab === 'upcoming'
      ? activeAppointments
      : activeAppointments.filter(appointment => (
        appointment.date === activeDateIso
        || (activeTab === 'today' && appointment.date === legacyUtcTodayIso)
      ));

  const emptyAppointmentMessage = activeTab === 'archive'
    ? 'Tamamlanan veya iptal edilen randevu bulunmuyor.'
    : activeTab === 'upcoming'
      ? 'Yaklaşan randevunuz bulunmuyor.'
      : `${activeDateLabel} için planlanmış randevunuz bulunmuyor.`;

  const formatAppointmentDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const formatAppointmentDateShort = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
  });

  const getChannelDetails = (channel) => {
    if (channel === 'video-blur') return { icon: '📹', label: 'Görüntülü (Blur)' };
    if (channel === 'voice') return { icon: '🎙️', label: 'Sesli Görüşme' };
    return { icon: '💬', label: 'Metin (Chat)' };
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

    if (appointment.status === 'cancelled') {
      return (
        <>
          <span className="appointment-muted-action">Arşivde</span>
        </>
      );
    }

    if (appointment.status === 'completed') {
      return (
        <>
          <Link to="/degerlendirmeler" className="btn btn-outline btn-sm">Değerlendirmeler</Link>
          <span className="appointment-muted-action">Seans tamamlandı</span>
        </>
      );
    }

    return (
      <>
        {appointment.paymentStatus !== 'paid' && (
          <button type="button" className="btn btn-outline btn-sm" disabled>
            Ödeme Entegrasyonu Bekleniyor
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
            'Randevu İptal Edildi',
            appointment.paymentStatus === 'paid'
              ? 'Randevu arşive taşındı. İade süreci ödeme sistemi üzerinden yönetilecek.'
              : 'Randevu arşive taşındı ve iptal edildi olarak işaretlendi.'
          )}
        >
          İptal Et
        </button>
        {appointment.paymentStatus === 'paid' && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={isUpdating}
            onClick={() => handleAppointmentUpdate(
              appointment,
              { status: 'completed', completedAt: new Date().toISOString() },
              'Seans Tamamlandı',
              'Randevu geçmiş seanslara taşındı.'
            )}
          >
            Tamamlandı
          </button>
        )}
        {appointment.paymentStatus !== 'paid' ? (
          <button type="button" className="btn btn-outline btn-sm" disabled>Ödeme Bekleniyor</button>
        ) : joinState.canJoin ? (
          <Link to={`/seans/${appointment.id}`} className="btn btn-primary btn-sm">Randevuya Git</Link>
        ) : (
          <button type="button" className="btn btn-outline btn-sm" disabled>{joinState.label}</button>
        )}
      </>
    );
  };

  const todayStr = new Date().toLocaleDateString('tr-TR', {
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
      label: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][index],
      count: activeAppointments.filter(appointment => getDisplayDate(appointment) === iso).length,
      isToday: iso === todayIso,
    };
  });

  const currentPsychologistId = user.psychologistId || user.psychologistProfile?.id || user.id;
  const myReviews = [
    ...getLocalReviewsForPsychologist(currentPsychologistId),
    ...mockReviews.filter(r => String(r.psychologistId) === String(currentPsychologistId)),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);
  const psychologistProfile = user.psychologistProfile || {};
  const profileChecks = [
    { label: 'Unvan', done: Boolean(psychologistProfile.title) },
    { label: 'Kısa tanıtım', done: Boolean(psychologistProfile.shortBio) },
    { label: 'Hakkımda', done: Boolean(psychologistProfile.bio) },
    { label: 'Uzmanlık', done: (psychologistProfile.specializations || []).length > 0 },
    { label: 'Yaklaşım', done: (psychologistProfile.approaches || []).length > 0 },
    { label: 'Müsaitlik', done: Object.keys(psychologistProfile.availability || {}).length > 0 },
  ];
  const completedProfileChecks = profileChecks.filter(item => item.done).length;
  const profileCompleteness = Math.round((completedProfileChecks / profileChecks.length) * 100);
  const profileEditUrl = '/ayarlar?tab=profile';

  return (
    <div className="page">
      <Navbar />
      <main className="page-content" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="container mt-xl mb-3xl">
          <div className="dash-header mb-2xl">
            <div>
              <h1 className="dash-title">Hoş geldiniz, {user.name || 'Uzman Psikolog'}</h1>
              <p className="dash-subtitle">{todayStr} • Bugün {todayAppointments.length} randevunuz var.</p>
            </div>
            <div className="dash-actions">
              <Link to={profileEditUrl} className="btn btn-primary">Profilimi Düzenle</Link>
              <Link to="/ayarlar" className="btn btn-outline">Takvim Ayarları</Link>
            </div>
          </div>

          <div className="dash-grid">
            <div className="dash-main">
              <section className="card card-elevated mb-lg animate-on-scroll">
                <div className="card-body">
                  <div className="appointment-schedule-header flex justify-between items-center mb-md">
                    <div>
                      <h3 className="m-0">Randevu Programı</h3>
                      <p className="appointment-section-subtitle">
                        {activeAppointments.length} aktif randevu • Bugün {todayAppointments.length} • Yarın {tomorrowAppointments.length} • Ödeme bekleyen {unpaidAppointments.length}
                      </p>
                    </div>
                    <div className="tabs-simple">
                      <button className={`tab-simple ${activeTab === 'today' ? 'active' : ''}`} onClick={() => setActiveTab('today')}>Bugün</button>
                      <button className={`tab-simple ${activeTab === 'tomorrow' ? 'active' : ''}`} onClick={() => setActiveTab('tomorrow')}>Yarın</button>
                      <button className={`tab-simple ${activeTab === 'upcoming' ? 'active' : ''}`} onClick={() => setActiveTab('upcoming')}>Yaklaşan</button>
                      <button className={`tab-simple ${activeTab === 'archive' ? 'active' : ''}`} onClick={() => setActiveTab('archive')}>Arşiv</button>
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
                      const status = statusDetails[appointment.status] || statusDetails.upcoming;
                      const payment = paymentDetails[appointment.paymentStatus] || paymentDetails.pending;
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
                                  <span className="appointment-eyebrow">Randevu</span>
                                  <h4>{appointment.clientAlias || 'Anonim Danışan'}</h4>
                                </div>
                                <div className="appointment-badge-group">
                                  <span className={`appointment-status ${status.className}`}>{status.label}</span>
                                  <span className={`appointment-payment-badge ${payment.className}`}>{payment.label}</span>
                                </div>
                              </div>

                              <div className="appointment-detail-grid">
                                <div className="appointment-detail">
                                  <span className="appointment-label">Tarih</span>
                                  <strong>{formatAppointmentDate(displayDate)}</strong>
                                </div>
                                <div className="appointment-detail">
                                  <span className="appointment-label">Saat</span>
                                  <strong>{appointment.time}</strong>
                                </div>
                                <div className="appointment-detail">
                                  <span className="appointment-label">Görüşme Tipi</span>
                                  <strong>{getChannelDetails(appointment.channel).icon} {getChannelDetails(appointment.channel).label}</strong>
                                </div>
                                <div className="appointment-detail">
                                  <span className="appointment-label">Randevu Kodu</span>
                                  <strong>{String(appointment.id).slice(0, 8)}</strong>
                                </div>
                              </div>

                              <div className="appointment-card-footer">
                                <span className="appointment-code">
                                  Durum akışı: Planlandı → Ödeme → Seans → Arşiv
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
                    <h3 className="m-0">Son Değerlendirmelerim</h3>
                    <Link to="/degerlendirmeler" className="text-primary text-sm">Tümünü Gör</Link>
                  </div>
                  <div className="reviews-list-simple">
                    {myReviews.length === 0 && <p className="text-tertiary">Henüz danışan değerlendirmesi bulunmuyor.</p>}
                    {myReviews.map(review => (
                      <div key={review.id} className="review-item-simple">
                        <div className="flex justify-between mb-xs">
                          <span className="font-medium">{review.clientAlias}</span>
                          <span className="text-xs text-tertiary">{new Date(review.date).toLocaleDateString('tr-TR')}</span>
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
                      <h4 className="mb-xs">Profil Durumu</h4>
                      <p className="text-xs text-tertiary m-0">{completedProfileChecks}/{profileChecks.length} alan tamamlandı</p>
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
                  <Link to={profileEditUrl} className="btn btn-outline btn-block btn-sm mt-md">Profil Bilgilerini Tamamla</Link>
                </div>
              </section>

              <div className="grid grid-2 gap-sm mb-lg animate-on-scroll">
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">📊</div>
                  <div className="dash-stat-value">{allAppointments.length}</div>
                  <div className="dash-stat-label">Toplam Randevu</div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">✅</div>
                  <div className="dash-stat-value">{completedAppointments.length}</div>
                  <div className="dash-stat-label">Tamamlanan</div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">💳</div>
                  <div className="dash-stat-value">{unpaidAppointments.length}</div>
                  <div className="dash-stat-label">Ödeme Bekleyen</div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">⛔</div>
                  <div className="dash-stat-value">{cancelledAppointments.length}</div>
                  <div className="dash-stat-label">İptal</div>
                </div>
              </div>

              <section className="card card-elevated animate-on-scroll">
                <div className="card-body p-md">
                  <h4 className="mb-sm text-center">Haftalık Takvim</h4>
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
