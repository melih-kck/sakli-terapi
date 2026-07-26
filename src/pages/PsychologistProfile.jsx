import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  SPECIALIZATIONS,
  APPROACHES,
  COMMUNICATION_CHANNELS,
  DAYS_SHORT_TR,
  DAYS_TR,
} from '../data/constants';
import { fetchApprovedPsychologistById, getDemoPsychologists } from '../lib/psychologists';
import {
  formatCurrency,
  formatLocalDateIso,
  getSessionFee,
  getSessionSlotKey,
  isSessionSlotBookable,
  isSessionSlotInPast,
} from '../lib/session-flow';
import RatingStars from '../components/RatingStars';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { useReview } from '../context/ReviewContext';
import { useSession } from '../context/SessionContext';
import { useToast } from '../context/ToastContext';
import { FEATURES, IS_DEMO_MODE } from '../config/runtime';
import '../styles/pages/Psychologists.css';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function PsychologistProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bookSession, fetchBookedSlots } = useSession();
  const { fetchReviewsForPsychologist } = useReview();
  const { success, warning } = useToast();

  const [psych, setPsych] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reviews, setReviews] = useState([]);
  const [bookedSlotKeys, setBookedSlotKeys] = useState([]);
  const [isBooking, setIsBooking] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState('video-blur');
  const [acceptedBookingTerms, setAcceptedBookingTerms] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const canCreateAppointment = IS_DEMO_MODE || FEATURES.liveAppointments;

  useEffect(() => {
    let isMounted = true;

    const loadPsychologist = async () => {
      setIsLoading(true);
      setLoadError('');
      const demoPsychologists = getDemoPsychologists();
      const demoPsychologist = demoPsychologists.find(p => String(p.id) === id);
      const looksLikeUuid = UUID_PATTERN.test(id);

      try {
        const loadedPsychologist = looksLikeUuid
          ? await fetchApprovedPsychologistById(id)
          : demoPsychologist;

        if (!loadedPsychologist) {
          throw new Error('Psikolog profili bulunamadı.');
        }

        if (!isMounted) return;
        setPsych(loadedPsychologist);
        setSelectedChannel(loadedPsychologist.channels[0] || 'video-blur');
      } catch (error) {
        console.warn('Psikolog profili Supabase üzerinden çekilemedi:', error);
        if (isMounted) {
          setPsych(null);
          setLoadError('Bu psikolog profili bulunamadı veya şu anda görüntülenemiyor.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadPsychologist();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    let isMounted = true;

    if (!psych?.id) {
      return undefined;
    }

    fetchReviewsForPsychologist(psych.id).then((loadedReviews) => {
      if (isMounted) setReviews(loadedReviews);
    });

    return () => {
      isMounted = false;
    };
  }, [psych?.id, fetchReviewsForPsychologist]);

  useEffect(() => {
    let isMounted = true;

    if (!psych?.id || user?.role !== 'client' || !UUID_PATTERN.test(String(psych.id))) {
      return undefined;
    }

    const rangeStartDate = new Date();
    const rangeEndDate = new Date();
    rangeEndDate.setDate(rangeEndDate.getDate() + 6);

    fetchBookedSlots(
      psych.id,
      formatLocalDateIso(rangeStartDate),
      formatLocalDateIso(rangeEndDate),
    ).then((result) => {
      if (!isMounted) return;
      setBookedSlotKeys(result.slotKeys || []);
    });

    return () => {
      isMounted = false;
    };
  }, [psych?.id, user?.role, fetchBookedSlots]);

  const getSpec = (sId) => SPECIALIZATIONS.find(s => s.id === sId);
  const getApproach = (aId) => APPROACHES.find(a => a.id === aId);
  const getChannel = (cId) => COMMUNICATION_CHANNELS.find(c => c.id === cId);

  const profileRating = reviews.length
    ? Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1))
    : Number(psych?.rating || 0);
  const profileReviewCount = reviews.length || Number(psych?.reviewCount || 0);

  const next7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dayIndex = (d.getDay() + 6) % 7;
    const dayName = DAYS_TR[dayIndex];
    return {
      dateObj: d,
      dayName,
      dayShort: DAYS_SHORT_TR[dayIndex],
      dateStr: formatLocalDateIso(d),
      display: `${d.getDate()} ${['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][d.getMonth()]}`,
      slots: psych?.availability?.[dayName] || []
    };
  });

  const displayReviews = showAllReviews ? reviews : reviews.slice(0, 3);

  const avgCategory = (cat) => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + Number(r.categoriesRating?.[cat] || r.rating || 0), 0);
    return (sum / reviews.length).toFixed(1);
  };

  const handleBooking = async () => {
    if (!psych) return;

    if (!canCreateAppointment) {
      warning('Randevu Alımı Kapalı', 'Gerçek randevular kontrollü pilot başlayana kadar kullanıma açılmayacaktır.');
      return;
    }

    if (!user) {
      warning('Giriş Gerekli', 'Randevu alabilmek için lütfen önce giriş yapın.');
      navigate('/giris');
      return;
    }

    setIsBooking(true);
    let result;

    try {
      result = await bookSession({
        psychologistId: psych.id,
        psychologistName: psych.name,
        psychologistInitials: psych.initials,
        clientAlias: user.alias || 'Anonim Danışan',
        date: selectedDate,
        time: selectedTime,
        channel: selectedChannel,
        status: 'upcoming',
        paymentStatus: 'pending',
        fee: IS_DEMO_MODE ? 0 : getSessionFee(psych),
      });
    } finally {
      setIsBooking(false);
    }

    if (!result?.success) {
      if (result?.code === 'slot_taken') {
        setBookedSlotKeys((current) => (
          Array.from(new Set([...current, getSessionSlotKey(selectedDate, selectedTime)]))
        ));
        setSelectedTime(null);
        setAcceptedBookingTerms(false);
      }
      return;
    }

    success('Randevu Onaylandı', 'Randevunuz başarıyla oluşturuldu. Detayları panelinizden takip edebilirsiniz.');
    navigate('/panel');
  };

  if (isLoading) {
    return (
      <div className="page">
        <Navbar />
        <main className="page-content">
          <div className="container mt-2xl mb-3xl">
            <div className="card card-elevated">
              <div className="card-body text-center">
                <p className="text-tertiary">Psikolog profili yükleniyor...</p>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!psych) {
    return (
      <div className="page">
        <Navbar />
        <main className="page-content">
          <div className="container mt-2xl mb-3xl">
            <div className="card card-elevated">
              <div className="card-body text-center">
                <h2>Profil görüntülenemiyor</h2>
                <p className="text-tertiary">{loadError}</p>
                <button className="btn btn-primary" type="button" onClick={() => navigate('/psikologlar')}>
                  Psikologlara Dön
                </button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="page">
      <Navbar />
      <main className="page-content">
        {/* Profile Header */}
        <div className="psy-profile-header">
          <div className="container">
            <div className="psy-profile-header-inner">
              <div className="avatar avatar-2xl psy-profile-avatar">{psych.initials}</div>
              <div className="psy-profile-title-area">
                <h1>{psych.name}</h1>
                <p className="psy-profile-title">{psych.title}</p>
                {psych.isDemo && <span className="badge badge-success">Tamamen kurgusal demo profili</span>}
                {psych.isCandidate && (
                  <div className="psy-candidate-info">
                    <span className="badge badge-accent">Aday Psikolog</span>
                    <span className="psy-supervisor">Aday psikolog • {psych.university || 'Eğitim bilgisi inceleniyor'}</span>
                  </div>
                )}
                <div className="psy-profile-stats">
                  <div className="psy-stat-item">
                    <RatingStars rating={profileRating} size="md" />
                    <span>({profileReviewCount} Değerlendirme)</span>
                  </div>
                  <div className="psy-stat-divider"></div>
                  <div className="psy-stat-item">
                    <span><strong>{psych.sessionCount}+</strong> Seans</span>
                  </div>
                  <div className="psy-stat-divider"></div>
                  <div className="psy-stat-item">
                    <span><strong>{psych.experience}</strong> Yıl Deneyim</span>
                  </div>
                </div>
                <div className="psy-profile-badges">
                  {psych.specializations.map(s => {
                    const spec = getSpec(s);
                    return spec && <span key={s} className="badge badge-primary">{spec.icon} {spec.label}</span>;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mt-2xl mb-3xl">
          <div className="psy-profile-layout">
            {/* Main Content */}
            <div className="psy-profile-main">
              <section className="psy-section">
                <h2>Hakkında</h2>
                <p className="psy-bio-text">{psych.bio}</p>
                {psych.languages && (
                  <div className="mt-md">
                    <strong>Konuştuğu Diller: </strong>
                    {psych.languages.map(lang => (
                      <span key={lang} className="badge badge-outline" style={{ marginLeft: 'var(--space-xs)' }}>{lang}</span>
                    ))}
                  </div>
                )}
              </section>

              <section className="psy-section">
                <h2>Uzmanlık Alanları</h2>
                <div className="grid grid-2 gap-md mt-md">
                  {psych.specializations.map(s => {
                    const spec = getSpec(s);
                    if (!spec) return null;
                    return (
                      <div key={s} className="card card-glass p-md">
                        <div className="flex items-center gap-sm mb-xs">
                          <span style={{ fontSize: '1.5rem' }}>{spec.icon}</span>
                          <h4 style={{ margin: 0 }}>{spec.label}</h4>
                        </div>
                        <p className="text-sm text-tertiary m-0">{spec.description}</p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="psy-section">
                <h2>Terapi Yaklaşımı</h2>
                <div className="psy-approaches mt-md">
                  {psych.approaches.map(a => {
                    const approach = getApproach(a);
                    if (!approach) return null;
                    return (
                      <div key={a} className="psy-approach-item">
                        <h4>{approach.label}</h4>
                        <p>{approach.description}</p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="psy-section">
                <h2>Danışan Değerlendirmeleri</h2>
                {IS_DEMO_MODE && (
                  <p className="demo-booking-note">
                    Aşağıdaki puanlar ve metinler arayüz demonstrasyonu için üretilmiş kurgusal içeriklerdir.
                  </p>
                )}
                <div className="reviews-summary card card-glass p-lg mb-xl">
                  <div className="reviews-overall">
                    <div className="reviews-big-rating">{profileRating}</div>
                    <RatingStars rating={profileRating} size="lg" showValue={false} />
                    <p className="text-sm text-tertiary mt-xs">{profileReviewCount} değerlendirme</p>
                  </div>
                  <div className="reviews-categories">
                    {[
                      { key: 'listening', label: 'Dinleme & Empati' },
                      { key: 'professionalism', label: 'Profesyonellik' },
                      { key: 'communication', label: 'İletişim' }
                    ].map(cat => {
                      const score = avgCategory(cat.key);
                      return (
                        <div key={cat.key} className="review-cat-row">
                          <span className="review-cat-label">{cat.label}</span>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${(score / 5) * 100}%` }}></div>
                          </div>
                          <span className="review-cat-score">{score}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="reviews-list">
                  {displayReviews.map(review => (
                    <div key={review.id} className="review-item">
                      <div className="review-header">
                        <div className="review-author">
                          <div className="avatar avatar-sm">{review.clientAlias.charAt(0)}</div>
                          <div>
                            <span className="review-alias">{review.clientAlias}</span>
                            <span className="review-date">{new Date(review.date).toLocaleDateString('tr-TR')}</span>
                          </div>
                        </div>
                        <RatingStars rating={review.rating} size="sm" showValue={false} />
                      </div>
                      <p className="review-comment">{review.comment}</p>
                      <div className="review-meta">
                        {review.channel && <span className="review-channel">{getChannel(review.channel)?.icon} {getChannel(review.channel)?.label}</span>}
                        {review.sessionNumber && <span className="review-session-count">{review.sessionNumber}. Seans</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {reviews.length > 3 && (
                  <button
                    type="button"
                    className="btn btn-outline btn-block mt-lg"
                    onClick={() => setShowAllReviews(!showAllReviews)}
                  >
                    {showAllReviews ? 'Daha Az Göster' : `Tüm ${reviews.length} Değerlendirmeyi Gör`}
                  </button>
                )}
              </section>
            </div>

            {/* Sidebar / Booking */}
            <aside className="psy-profile-sidebar">
              <div className="card card-elevated sticky-sidebar">
                <div className="card-body">
                  <h3 className="mb-lg">Randevu Al</h3>
                  {IS_DEMO_MODE && (
                    <p className="demo-booking-note">
                      Bu akış yalnızca ürün demonstrasyonudur. Gerçek randevu veya sağlık hizmeti oluşturmaz.
                    </p>
                  )}
                  
                  <div className="booking-section">
                    <h4 className="booking-label">1. Tarih Seçin</h4>
                    <div className="date-picker-scroll">
                      {next7Days.map(day => {
                        const isSelected = selectedDate === day.dateStr;
                        const hasSlots = day.slots.some((time) => (
                          isSessionSlotBookable({
                            date: day.dateStr,
                            time,
                            bookedSlotKeys,
                          })
                        ));
                        return (
                          <button
                            type="button"
                            key={day.dateStr}
                            className={`date-btn ${isSelected ? 'selected' : ''} ${!hasSlots ? 'disabled' : ''}`}
                            disabled={!hasSlots}
                            onClick={() => { setSelectedDate(day.dateStr); setSelectedTime(null); setAcceptedBookingTerms(false); }}
                          >
                            <span className="date-day-name">{day.dayShort}</span>
                            <span className="date-day-num">{day.display.split(' ')[0]}</span>
                            <span className="date-month">{day.display.split(' ')[1]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedDate && (
                    <div className="booking-section slide-up">
                      <h4 className="booking-label">2. Saat Seçin</h4>
                      <div className="time-slots-grid">
                        {next7Days.find(d => d.dateStr === selectedDate)?.slots.map(time => {
                          const slotKey = getSessionSlotKey(selectedDate, time);
                          const isBooked = bookedSlotKeys.includes(slotKey);
                          const isPast = isSessionSlotInPast(selectedDate, time);
                          const isUnavailable = isBooked || isPast;

                          return (
                            <button
                              type="button"
                              key={time}
                              className={`time-btn ${selectedTime === time ? 'selected' : ''} ${isUnavailable ? 'disabled' : ''}`}
                              disabled={isUnavailable}
                              onClick={() => { setSelectedTime(time); setAcceptedBookingTerms(false); }}
                            >
                              <span>{time}</span>
                              {(isBooked || isPast) && (
                                <small>{isBooked ? 'Dolu' : 'Geçti'}</small>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedTime && (
                    <div className="booking-section slide-up">
                      <h4 className="booking-label">3. İletişim Tercihi</h4>
                      <div className="channel-select-grid">
                        {psych.channels.map(c => {
                          const channel = getChannel(c);
                          if (!channel) return null;
                          return (
                            <button
                              type="button"
                              key={c}
                              className={`channel-btn ${selectedChannel === c ? 'selected' : ''}`}
                              onClick={() => setSelectedChannel(c)}
                            >
                              <span className="channel-icon">{channel.icon}</span>
                              <span className="channel-name">{channel.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="booking-summary mt-xl">
                    <div className="donation-notice mb-md">
                      <span className="donation-icon-small">🔒</span>
                      <p className="text-xs m-0">
                        {IS_DEMO_MODE
                          ? 'Demo sürümünde ücret ve ödeme yoktur.'
                          : canCreateAppointment
                            ? 'Ödeme entegrasyonu henüz etkin değildir.'
                            : 'Gerçek randevu alımı kontrollü pilot başlayana kadar kapalıdır.'}
                      </p>
                    </div>
                    {selectedDate && selectedTime && (
                      <div className="booking-confirm-box mb-md">
                        <div className="content-metric">
                          <span>Seçilen Randevu</span>
                          <strong>{selectedTime}</strong>
                        </div>
                        <div className="content-metric">
                          <span>Seans Ücreti</span>
                          <strong>{IS_DEMO_MODE ? 'Demo, ücret yok' : formatCurrency(getSessionFee(psych))}</strong>
                        </div>
                        <div className="content-metric">
                          <span>Ödeme Durumu</span>
                          <strong>{IS_DEMO_MODE ? 'Uygulanmaz' : 'Entegrasyon bekleniyor'}</strong>
                        </div>
                        <label className="checkbox-group content-checkbox">
                          <input
                            type="checkbox"
                            checked={acceptedBookingTerms}
                            onChange={(event) => setAcceptedBookingTerms(event.target.checked)}
                          />
                          <span>
                            {IS_DEMO_MODE
                              ? 'Bunun kurgusal bir ürün demonstrasyonu olduğunu anlıyorum.'
                              : 'Randevu oluşturma ve iptal koşullarını onaylıyorum.'}
                          </span>
                        </label>
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary btn-block btn-lg"
                      disabled={!canCreateAppointment || !selectedDate || !selectedTime || !selectedChannel || !acceptedBookingTerms || isBooking}
                      onClick={handleBooking}
                    >
                      {isBooking
                        ? 'Randevu Oluşturuluyor...'
                        : !canCreateAppointment
                          ? 'Randevu Alımı Kapalı'
                          : selectedDate && selectedTime
                          ? IS_DEMO_MODE ? 'Demo Randevusu Oluştur' : 'Randevuyu Oluştur'
                          : 'Tarih ve Saat Seçin'}
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
