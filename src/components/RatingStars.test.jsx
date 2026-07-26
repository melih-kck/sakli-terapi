import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RatingStars from './RatingStars';

describe('RatingStars', () => {
  it('exposes an accessible label for read-only ratings', () => {
    render(<RatingStars rating={4.5} showValue={false} />);

    expect(screen.getByRole('img', { name: '4.5 / 5 yıldız' })).toBeInTheDocument();
  });

  it('uses keyboard-focusable buttons for interactive ratings', () => {
    const onChange = vi.fn();
    render(<RatingStars rating={2} interactive onChange={onChange} showValue={false} />);

    const fifthStar = screen.getByRole('button', { name: '5 yıldız' });
    fireEvent.click(fifthStar);

    expect(onChange).toHaveBeenCalledWith(5);
  });
});
