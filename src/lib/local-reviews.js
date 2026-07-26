import { IS_DEMO_MODE } from '../config/runtime';

const GLOBAL_REVIEWS_KEY = 'sakli-terapi-global-reviews';

export const getLocalReviews = () => {
  try {
    const saved = localStorage.getItem(GLOBAL_REVIEWS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const appendLocalReview = (review) => {
  const reviews = getLocalReviews();
  const nextReviews = [
    review,
    ...reviews.filter(item => String(item.id) !== String(review.id)),
  ];
  localStorage.setItem(GLOBAL_REVIEWS_KEY, JSON.stringify(nextReviews));
  return nextReviews;
};

export const getLocalReviewsForPsychologist = (psychologistId) => {
  const reviews = getLocalReviews().filter(review => String(review.psychologistId) === String(psychologistId));
  if (reviews.length > 0 || !IS_DEMO_MODE) return reviews;

  return [
    {
      id: `demo-review-${psychologistId}-1`,
      psychologistId,
      clientAlias: 'Kurgusal Rumuz A',
      date: '2026-07-18T10:00:00.000Z',
      rating: 5,
      categoriesRating: {
        listening: 5,
        empathy: 5,
        clarity: 4,
        trust: 5,
        professionalism: 5,
        communication: 4,
      },
      comment: 'Kurgusal değerlendirme metni: Bu içerik yalnızca değerlendirme bileşeninin görünümünü göstermek için hazırlanmıştır.',
      anonymous: true,
      channel: 'video-blur',
      sessionNumber: 2,
    },
    {
      id: `demo-review-${psychologistId}-2`,
      psychologistId,
      clientAlias: 'Kurgusal Rumuz B',
      date: '2026-07-12T14:30:00.000Z',
      rating: 4,
      categoriesRating: {
        listening: 4,
        empathy: 5,
        clarity: 4,
        trust: 4,
        professionalism: 4,
        communication: 4,
      },
      comment: 'Kurgusal değerlendirme metni: Gerçek bir danışan deneyimini veya sağlık hizmeti sonucunu temsil etmez.',
      anonymous: true,
      channel: 'text',
      sessionNumber: 1,
    },
  ];
};
