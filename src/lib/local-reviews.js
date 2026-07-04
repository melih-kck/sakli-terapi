const GLOBAL_REVIEWS_KEY = 'gizlibiriz-global-reviews';

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

export const getLocalReviewsForPsychologist = (psychologistId) => (
  getLocalReviews().filter(review => String(review.psychologistId) === String(psychologistId))
);
