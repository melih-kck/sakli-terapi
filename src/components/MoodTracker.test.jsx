import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MoodTracker from './MoodTracker';

describe('MoodTracker', () => {
  it('reports the selected mood value', () => {
    const onChange = vi.fn();
    const { container } = render(
      <MoodTracker value={3} onChange={onChange} />,
    );

    fireEvent.click(container.querySelector('#mood-4'));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('marks the current mood and limits history to the latest seven entries', () => {
    const history = Array.from({ length: 9 }, (_, index) => ({
      date: `2026-07-${String(index + 1).padStart(2, '0')}`,
      mood: (index % 5) + 1,
    }));
    const { container } = render(
      <MoodTracker value={2} history={history} />,
    );

    expect(container.querySelector('#mood-2')).toHaveClass('selected');
    expect(container.querySelectorAll('.mood-bar-wrapper')).toHaveLength(7);
  });
});
