import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { useProfile } from '../context/ProfileContext';
import { useToast } from '../context/ToastContext';
import { COMMUNICATION_CHANNELS, SPECIALIZATIONS } from '../data/constants';
import { fetchApprovedPsychologists, getDemoPsychologists } from '../lib/psychologists';
import { formatCurrency, getSessionFee, getSessionJoinState } from '../lib/session-flow';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MoodTracker from '../components/MoodTracker';
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
  refunded: { label: 'İade sürecinde', className: 'is-refunded' },
};

const getLocalDateIso = () => new Date().toISOString().split('T')[0];

export default function ClientDashboard() {
  const { user, isClient } = useAuth();
  const { updateSession, refreshSessions, sessions } = useSession();
  const { addMoodEntry } = useProfile();
  const { success, error: showError } = useToast();
  const [sessionToCancel, setSessionToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [updatingSessionId, setUpdatingSessionId] = useState(null);
  const [psychologists, setPsychologists] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      success('Ödeme Başarılı', 'Randevunuz için ödeme başarıyla alındı.');
      void refreshSessions();
      window.history.replaceState({}, '', '/panel');
    } else if (params.get('payment') === 'failed') {
      const reason = params.get('reason') || 'Bilinmeyen Hata';
      showError('Ödeme Başarısız', 'Ödeme alınamadı: ' + reason);
      window.history.replaceState({}, '', '/panel');
    }
  }, [success, showError, refreshSessions]);

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
    if (!user || (!isClient && user.role !== 'admin')) return undefined;

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

  if (!user || (!isClient && user.role !== 'admin')) return null;

  const getPsychologist = (id) => psychologists.find(p => String(p.id) === String(id));
  const getChannel = (channelId) => COMMUNICATION_CHANNELS.find(channel => channel.id === channelId);
  const formatSessionDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR');
  const formatSessionDateLong = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', {
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
  const pendingPayments = upcomingSessions.filter(session => session.paymentStatus === 'pending');

  const todayMood = user.moodHistory?.find(mood => mood.date === getLocalDateIso())?.mood;
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
  const getTopicLabel = (topicId) => SPECIALIZATIONS.find(spec => spec.id === topicId)?.label || topicId;

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
      success('Randevu İptal Edildi', session.paymentStatus === 'paid' ? 'Randevu arşive taşındı. İade süreci ödeme sistemi üzerinden yönetilecek.' : 'Randevu arşive taşındı.');
    }
  };

  const handleDevPaymentBypass = async (session) => {
    if (!import.meta.env.DEV) return;

    setUpdatingSessionId(session.id);
    const result = await updateSession(session.id, {
      paymentStatus: 'paid',
      paidAt: new Date().toISOString(),
    });
    setUpdatingSessionId(null);

    if (result.success) {
      success('Test Ödemesi Geçildi', 'Bu işlem yalnızca yerel test randevusunu seansa açar.');
    }
  };

  const handlePaySession = async (session, psych) => {
    setUpdatingSessionId(session.id);
    
    try {
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          psychologistName: psych?.name || session.psychologistName,
          amount: getSessionFee(psych, session),
          buyerDetails: {
            id: user.id,
            name: user.alias || 'Gizli Danışan',
            email: user.email,
            phone: user.clientProfile?.emergencyPhone || '+905555555555',
            city: user.clientProfile?.city || 'İstanbul'
          }
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Ödeme başlatılamadı');
      }

      if (data.paymentPageUrl) {
        // Gerçek Iyzico sayfasına yönlendirme veya Mock URL'ye gitme
        window.location.assign(data.paymentPageUrl);
      } else {
        showError('Ödeme Hazırlanıyor', 'Ödeme altyapısı son aşamada bağlanacak; randevu şimdilik beklemede kalır.');
      }
    } catch (error) {
      console.error('Ödeme hatası:', error);
      // Payment is intentionally deferred; do not mark real sessions as paid locally.
      if (error.message.includes('Unexpected token') || error.message.includes('Unexpected end of JSON') || error.message.includes('404') || error.message.includes('Failed to execute \'json\'')) {
        showError('Ödeme Hazırlanıyor', 'Ödeme API bağlantısı henüz aktif değil; randevu ödeme bekliyor olarak kalır.');
      } else {
        showError('Ödeme Başarısız', 'Hata: ' + error.message);
      }
    } finally {
      setUpdatingSessionId(null);
    }
  };

  const renderSessionIdentity = (session, psych) => (
    <div className="session-info">
      <div className="avatar avatar-md">{psych?.initials || session.psychologistInitials || 'P'}</div>
      <div>
        <span className="appointment-eyebrow">Randevu</span>
        <h4>{psych?.name || session.psychologistName || 'Psikolog'}</h4>
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
              <h1 className="dash-title">Merhaba, {user.alias}</h1>
              <p className="dash-subtitle">Bugün {upcomingSessions.length} yaklaşan randevunuz ve {pendingPayments.length} ödeme bekleyen işlem var.</p>
            </div>
            <div className="dash-actions">
              <Link to="/psikologlar" className="btn btn-primary">Yeni Randevu Al</Link>
              <Link to="/ayarlar" className="btn btn-outline">Gizlilik Ayarları</Link>
            </div>
          </div>

          <div className="dash-grid">
            <div className="dash-main">
              <section className="card card-elevated mb-lg animate-on-scroll">
                <div className="card-body">
                  <div className="flex justify-between items-center mb-md">
                    <h3 className="m-0">Bugün kendinizi nasıl hissediyorsunuz?</h3>
                    {todayMood && <span className="badge badge-success">Kaydedildi</span>}
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
                      <h3 className="m-0">Yaklaşan Randevularınız</h3>
                      <p className="appointment-section-subtitle">
                        {upcomingSessions.length} aktif randevu • {pendingPayments.length} ödeme bekleyen
                      </p>
                    </div>
                  </div>

                  {upcomingSessions.length > 0 ? (
                    <div className="session-list">
                      {upcomingSessions.map(session => {
                        const psych = getPsychologist(session.psychologistId);
                        const channel = getChannel(session.channel);
                        const status = statusDetails[session.status] || statusDetails.upcoming;
                        const payment = paymentDetails[session.paymentStatus] || paymentDetails.pending;
                        const isCancelling = String(sessionToCancel?.id) === String(session.id);
                        const isUpdating = String(updatingSessionId) === String(session.id);
                        const joinState = getSessionJoinState(session);
                        const fee = getSessionFee(psych, session);
                        const requiresPayment = session.paymentStatus !== 'paid';
                        const canUseDevPaymentBypass = import.meta.env.DEV && requiresPayment && (
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
                                <span className="appointment-label">Tarih</span>
                                <strong>{formatSessionDateLong(session.date)}</strong>
                              </div>
                              <div className="appointment-detail">
                                <span className="appointment-label">Saat</span>
                                <strong>{session.time}</strong>
                              </div>
                              <div className="appointment-detail">
                                <span className="appointment-label">Görüşme Tipi</span>
                                <strong>{channel?.icon} {channel?.label || session.channel}</strong>
                              </div>
                              <div className="appointment-detail">
                                <span className="appointment-label">Randevu Kodu</span>
                                <strong>{String(session.id).slice(0, 8)}</strong>
                              </div>
                            </div>

                            {requiresPayment && (
                              <div className="session-payment-box">
                                <div>
                                  <span className="appointment-eyebrow">Ödeme Özeti</span>
                                  <strong>{formatCurrency(fee)}</strong>
                                  <p>Seans odası ödeme tamamlandıktan sonra açılır.</p>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-warning btn-sm"
                                  disabled={isUpdating}
                                  onClick={() => handlePaySession(session, psych)}
                                >
                                  {isUpdating ? 'İşleniyor...' : 'Ödemeyi Tamamla'}
                                </button>
                                {canUseDevPaymentBypass && (
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    disabled={isUpdating}
                                    onClick={() => handleDevPaymentBypass(session)}
                                  >
                                    Test İçin Geç
                                  </button>
                                )}
                              </div>
                            )}

                            {isCancelling && (
                              <div className="session-cancel-box">
                                <div className="input-group">
                                  <label>İptal Nedeni</label>
                                  <textarea
                                    rows="3"
                                    value={cancelReason}
                                    onChange={(event) => setCancelReason(event.target.value)}
                                    placeholder="Kısa bir not ekleyin"
                                  />
                                </div>
                                <div className="session-cancel-actions">
                                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSessionToCancel(null); setCancelReason(''); }}>
                                    Vazgeç
                                  </button>
                                  <button type="button" className="btn btn-danger btn-sm" disabled={isUpdating} onClick={() => handleCancelSession(session)}>
                                    İptali Onayla
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="appointment-card-footer">
                              <span className="appointment-code">
                                {requiresPayment ? 'Ödeme tamamlanınca seans giriş kontrolü yapılır.' : joinState.helper}
                              </span>
                              <div className="appointment-action-group">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm appointment-danger-action"
                                  disabled={isUpdating}
                                  onClick={() => setSessionToCancel(session)}
                                >
                                  İptal Et
                                </button>
                                {requiresPayment ? (
                                  <>
                                    <button type="button" className="btn btn-primary btn-sm" disabled={isUpdating} onClick={() => handlePaySession(session, psych)}>
                                      Ödemeyi Tamamla
                                    </button>
                                    {canUseDevPaymentBypass && (
                                      <button type="button" className="btn btn-outline btn-sm" disabled={isUpdating} onClick={() => handleDevPaymentBypass(session)}>
                                        Test İçin Geç
                                      </button>
                                    )}
                                  </>
                                ) : joinState.canJoin ? (
                                  <Link to={`/seans/${session.id}`} className="btn btn-primary btn-sm">Seansa Katıl</Link>
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
                      <p>Henüz planlanmış randevunuz yok.</p>
                      <Link to="/psikologlar" className="btn btn-outline btn-sm mt-sm">Psikolog Bul</Link>
                    </div>
                  )}
                </div>
              </section>

              <section className="card card-elevated animate-on-scroll">
                <div className="card-body">
                  <h3 className="mb-md">Geçmiş Randevular</h3>
                  {pastSessions.length > 0 ? (
                    <div className="session-list">
                      {pastSessions.map(session => {
                        const psych = getPsychologist(session.psychologistId);
                        const channel = getChannel(session.channel);
                        const status = statusDetails[session.status] || statusDetails.completed;
                        const payment = paymentDetails[session.paymentStatus] || paymentDetails.pending;

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
                                <span className="appointment-label">Tarih</span>
                                <strong>{formatSessionDate(session.date)}</strong>
                              </div>
                              <div className="appointment-detail">
                                <span className="appointment-label">Saat</span>
                                <strong>{session.time}</strong>
                              </div>
                              <div className="appointment-detail">
                                <span className="appointment-label">Görüşme Tipi</span>
                                <strong>{channel?.icon} {channel?.label || session.channel}</strong>
                              </div>
                              <div className="appointment-detail">
                                <span className="appointment-label">Randevu Kodu</span>
                                <strong>{String(session.id).slice(0, 8)}</strong>
                              </div>
                            </div>

                            <div className="appointment-card-footer">
                              <span className="appointment-code">
                                {session.status === 'cancelled' ? 'Randevu iptal edildi.' : session.reviewed ? 'Değerlendirmeniz alındı.' : 'Seans tamamlandı, değerlendirme bekliyor.'}
                              </span>
                              <div className="appointment-action-group">
                                {session.status === 'cancelled' ? (
                                  <span className="badge badge-danger">İptal edildi</span>
                                ) : session.reviewed ? (
                                  <span className="badge badge-success">Değerlendirildi</span>
                                ) : (
                                  <Link to={`/degerlendirme?session=${session.id}`} className="btn btn-warning btn-sm">Değerlendir</Link>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-tertiary">Geçmiş randevunuz bulunmuyor.</p>
                  )}
                </div>
              </section>
            </div>

            <div className="dash-sidebar">
              <div className="grid grid-2 gap-sm mb-lg animate-on-scroll">
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">📊</div>
                  <div className="dash-stat-value">{sessions?.length || 0}</div>
                  <div className="dash-stat-label">Toplam Randevu</div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">{avgMood > 0 ? ['😢', '😞', '😐', '🙂', '😄'][avgMood - 1] : '–'}</div>
                  <div className="dash-stat-value">{avgMood > 0 ? `${avgMood}/5` : '-'}</div>
                  <div className="dash-stat-label">Ruh Hali</div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">🔒</div>
                  <div className="dash-stat-value">{user.privacyLevel}/5</div>
                  <div className="dash-stat-label">Gizlilik Seviyesi</div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-icon">⭐</div>
                  <div className="dash-stat-value">{reviewedSessions.length}/{completedSessions.length}</div>
                  <div className="dash-stat-label">Değerlendirme</div>
                </div>
              </div>

              {clientTopics.length > 0 && (
                <section className="card card-elevated mb-lg animate-on-scroll">
                  <div className="card-body p-md">
                    <h4 className="mb-sm">Destek Başlıklarınız</h4>
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
                  <h3 className="mb-md" style={{ fontSize: 'var(--text-md)' }}>Size Önerilen Uzmanlar</h3>
                  <div className="recommended-list">
                    {recommendedPsychologists.map(psych => (
                      <Link to={`/psikolog/${psych.id}`} key={psych.id} className="recommended-item">
                        <div className="avatar avatar-sm">{psych.initials}</div>
                        <div className="recommended-info">
                          <span className="recommended-name">{psych.name}</span>
                          <RatingStars rating={psych.rating} size="sm" showValue={false} />
                          {psych.matchScore > 0 && <span className="text-xs text-tertiary">{psych.matchScore} eşleşen başlık</span>}
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Link to="/psikologlar" className="btn btn-ghost btn-sm btn-block mt-md">Tümünü Gör</Link>
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
