import { useState } from 'react';
import './RatingStars.css';

export default function RatingStars({ rating = 0, maxStars = 5, size = 'md', interactive = false, onChange, showValue = true, count }) {
  const [hoverRating, setHoverRating] = useState(0);

  const handleClick = (value) => {
    if (interactive && onChange) {
      onChange(value);
    }
  };

  const displayRating = hoverRating || rating;

  const sizes = {
    sm: { star: '14px', value: 'var(--text-xs)', gap: '1px' },
    md: { star: '18px', value: 'var(--text-sm)', gap: '2px' },
    lg: { star: '24px', value: 'var(--text-base)', gap: '3px' },
    xl: { star: '32px', value: 'var(--text-lg)', gap: '4px' },
  };

  const s = sizes[size] || sizes.md;

  return (
    <div className="rating-stars-wrapper">
      <div className="rating-stars" style={{ gap: s.gap }}>
        {Array.from({ length: maxStars }, (_, i) => {
          const value = i + 1;
          const filled = value <= Math.floor(displayRating);
          const half = !filled && value === Math.ceil(displayRating) && displayRating % 1 >= 0.3;

          return (
            <span
              key={i}
              className={`star ${filled ? 'filled' : ''} ${half ? 'half' : ''} ${interactive ? 'interactive' : ''}`}
              style={{ fontSize: s.star }}
              onClick={() => handleClick(value)}
              onMouseEnter={() => interactive && setHoverRating(value)}
              onMouseLeave={() => interactive && setHoverRating(0)}
            >
              {filled || half ? '★' : '☆'}
            </span>
          );
        })}
      </div>
      {showValue && rating > 0 && (
        <span className="rating-value" style={{ fontSize: s.value }}>{rating.toFixed(1)}</span>
      )}
      {count !== undefined && (
        <span className="rating-count" style={{ fontSize: s.value }}>({count})</span>
      )}
    </div>
  );
}
