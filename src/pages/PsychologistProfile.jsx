import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  SPECIALIZATIONS,
  APPROACHES,
  COMMUNICATION_CHANNELS,
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
import { useLanguage } from '../context/LanguageContext';
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
  const { language, t } = useLanguage();

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
          throw new Error(t('profile.loadError'));
        }

        if (!isMounted) return;
        setPsych(loadedPsychologist);
        setSelectedChannel(loadedPsychologist.channels[0] || 'video-blur');
      } catch (error) {
        console.warn('Psikolog profili Supabase üzerinden çekilemedi:', error);
        if (isMounted) {
          setPsych(null);
          setLoadError(t('profile.loadError'));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadPsychologist();

    return () => {
      isMounted = false;
    };
  }, [id, t]);

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

  const getSpec = (sId) => {
    const spec = SPECIALIZATIONS.find(s => s.id === sId);
    if (!spec) return null;
    return {
      ...spec,
      label: t(`specializations.${sId}`),
      description: t(`specializationDescriptions.${sId}`),
    };
  };
  const getApproach = (aId) => {
    const approach = APPROACHES.find(a => a.id === aId);
    if (!approach) return null;
    const [label, description] = t(`approaches.${aId}`);
    return { ...approach, label, description };
  };
  const getChannel = (cId) => {
    const channel = COMMUNICATION_CHANNELS.find(c => c.id === cId);
    if (!channel) return null;
    const [label, description] = t(`channels.${cId}`);
    return { ...channel, label, description };
  };
  const localizedPsychologistName = language === 'en'
    ? psych?.name
      ?.replace('Klinik Psikolog Demo', 'Clinical Psychologist Demo')
      .replace('Aday Profil Demo', 'Candidate Profile Demo')
    : psych?.name;

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
      dayShort: d.toLocaleDateString(language === 'en' ? 'en-US' : 'tr-TR', { weekday: 'short' }),
      dateStr: formatLocalDateIso(d),
      display: new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'tr-TR', { day: 'numeric', month: 'short' }).format(d),
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
      warning(t('profile.closedToastTitle'), t('profile.closedToastBody'));
      return;
    }

    if (!user) {
      warning(t('profile.loginRequiredTitle'), t('profile.loginRequiredBody'));
      navigate('/giris');
      return;
    }

    setIsBooking(true);
    let result;

    try {
      result = await bookSession({
        psychologistId: psych.id,
        psychologistName: localizedPsychologistName,
        psychologistInitials: psych.initials,
        clientAlias: user.alias || t('profile.anonymousClient'),
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

    success(t('profile.confirmedTitle'), t('profile.confirmedBody'));
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
                <p className="text-tertiary">{t('profile.loading')}</p>
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
                <h2>{t('profile.unavailable')}</h2>
                <p className="text-tertiary">{loadError}</p>
                <button className="btn btn-primary" type="button" onClick={() => navigate('/psikologlar')}>
                  {t('profile.back')}
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
                <h1>{localizedPsychologistName}</h1>
                <p className="psy-profile-title">{psych.isCandidate ? t('common.candidatePsychologist') : t('common.clinicalPsychologist')}</p>
                {psych.isDemo && <span className="badge badge-success">{t('profile.fictionalBadge')}</span>}
                {psych.isCandidate && (
                  <div className="psy-candidate-info">
                    <span className="badge badge-accent">{t('common.candidatePsychologist')}</span>
                    <span className="psy-supervisor">{t('profile.candidateEducation', { university: psych.university || t('profile.educationPending') })}</span>
                  </div>
                )}
                <div className="psy-profile-stats">
                  <div className="psy-stat-item">
                    <RatingStars rating={profileRating} size="md" />
                    <span>({t('profile.reviews', { count: profileReviewCount })})</span>
                  </div>
                  <div className="psy-stat-divider"></div>
                  <div className="psy-stat-item">
                    <span><strong>{psych.sessionCount}+</strong> {t('profile.sessions')}</span>
                  </div>
                  <div className="psy-stat-divider"></div>
                  <div className="psy-stat-item">
                    <span><strong>{psych.experience}</strong> {t('profile.yearsExperience')}</span>
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
                <h2>{t('profile.about')}</h2>
                <p className="psy-bio-text">{psych.isDemo ? t('profile.demoBio') : psych.bio}</p>
                {psych.languages && (
                  <div className="mt-md">
                    <strong>{t('profile.languages')} </strong>
                    {psych.languages.map(lang => (
                      <span key={lang} className="badge badge-outline" style={{ marginLeft: 'var(--space-xs)' }}>
                        {language === 'en' ? lang.replace('Türkçe', 'Turkish').replace('İngilizce', 'English') : lang}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section className="psy-section">
                <h2>{t('profile.specialties')}</h2>
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
                <h2>{t('profile.approach')}</h2>
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
                <h2>{t('profile.clientReviews')}</h2>
                {IS_DEMO_MODE && (
                  <p className="demo-booking-note">
                    {t('profile.fictionalReviews')}
                  </p>
                )}
                <div className="reviews-summary card card-glass p-lg mb-xl">
                  <div className="reviews-overall">
                    <div className="reviews-big-rating">{profileRating}</div>
                    <RatingStars rating={profileRating} size="lg" showValue={false} />
                    <p className="text-sm text-tertiary mt-xs">{t('profile.reviewCount', { count: profileReviewCount })}</p>
                  </div>
                  <div className="reviews-categories">
                    {[
                      { key: 'listening', label: t('profile.listening') },
                      { key: 'professionalism', label: t('profile.professionalism') },
                      { key: 'communication', label: t('profile.communication') }
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
                  {displayReviews.map((review, reviewIndex) => (
                    <div key={review.id} className="review-item">
                      <div className="review-header">
                        <div className="review-author">
                          <div className="avatar avatar-sm">{review.clientAlias.charAt(0)}</div>
                          <div>
                            <span className="review-alias">{review.clientAlias}</span>
                            <span className="review-date">{new Date(review.date).toLocaleDateString(language === 'en' ? 'en-US' : 'tr-TR')}</span>
                          </div>
                        </div>
                        <RatingStars rating={review.rating} size="sm" showValue={false} />
                      </div>
                      <p className="review-comment">{language === 'en' && IS_DEMO_MODE ? t('profile.reviewSamples')[reviewIndex % 3] : review.comment}</p>
                      <div className="review-meta">
                        {review.channel && <span className="review-channel">{getChannel(review.channel)?.icon} {getChannel(review.channel)?.label}</span>}
                        {review.sessionNumber && <span className="review-session-count">{t('profile.sessionNumber', { count: review.sessionNumber })}</span>}
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
                    {showAllReviews ? t('profile.showLess') : t('profile.showAll', { count: reviews.length })}
                  </button>
                )}
              </section>
            </div>

            {/* Sidebar / Booking */}
            <aside className="psy-profile-sidebar">
              <div className="card card-elevated sticky-sidebar">
                <div className="card-body">
                  <h3 className="mb-lg">{t('profile.book')}</h3>
                  {IS_DEMO_MODE && (
                    <p className="demo-booking-note">
                      {t('profile.bookingDemoNotice')}
                    </p>
                  )}
                  
                  <div className="booking-section">
                    <h4 className="booking-label">{t('profile.selectDate')}</h4>
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
                      <h4 className="booking-label">{t('profile.selectTime')}</h4>
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
                                <small>{isBooked ? t('profile.booked') : t('profile.passed')}</small>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedTime && (
                    <div className="booking-section slide-up">
                      <h4 className="booking-label">{t('profile.selectChannel')}</h4>
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
                          ? t('profile.noDemoFee')
                          : canCreateAppointment
                            ? t('profile.paymentDisabled')
                            : t('profile.bookingClosed')}
                      </p>
                    </div>
                    {selectedDate && selectedTime && (
                      <div className="booking-confirm-box mb-md">
                        <div className="content-metric">
                          <span>{t('profile.selectedAppointment')}</span>
                          <strong>{selectedTime}</strong>
                        </div>
                        <div className="content-metric">
                          <span>{t('profile.sessionFee')}</span>
                          <strong>{IS_DEMO_MODE ? t('profile.noFee') : formatCurrency(getSessionFee(psych))}</strong>
                        </div>
                        <div className="content-metric">
                          <span>{t('profile.paymentStatus')}</span>
                          <strong>{IS_DEMO_MODE ? t('profile.notApplicable') : t('profile.integrationPending')}</strong>
                        </div>
                        <label className="checkbox-group content-checkbox">
                          <input
                            type="checkbox"
                            checked={acceptedBookingTerms}
                            onChange={(event) => setAcceptedBookingTerms(event.target.checked)}
                          />
                          <span>
                            {IS_DEMO_MODE
                              ? t('profile.demoConsent')
                              : t('profile.bookingConsent')}
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
                        ? t('profile.creating')
                        : !canCreateAppointment
                          ? t('profile.closedToastTitle')
                          : selectedDate && selectedTime
                          ? IS_DEMO_MODE ? t('profile.createDemo') : t('profile.create')
                          : t('profile.selectDateTime')}
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
