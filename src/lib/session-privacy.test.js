import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_BLUR_LEVEL,
  getSessionBlurPreset,
  isSessionClearVideoLevel,
  normalizeSessionBlurLevel,
  SESSION_BLUR_PRESETS,
} from './session-privacy';

describe('session-privacy', () => {
  it('provides a zero-pixel clear-video preset', () => {
    expect(SESSION_BLUR_PRESETS.map(preset => preset.level)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(getSessionBlurPreset(0)).toMatchObject({
      level: 0,
      label: 'Blursuz',
      pixels: 0,
    });
    expect(isSessionClearVideoLevel(0)).toBe(true);
  });

  it('keeps invalid values at the privacy-safe default', () => {
    expect(normalizeSessionBlurLevel('invalid')).toBe(DEFAULT_SESSION_BLUR_LEVEL);
    expect(normalizeSessionBlurLevel(7)).toBe(DEFAULT_SESSION_BLUR_LEVEL);
    expect(isSessionClearVideoLevel('invalid')).toBe(false);
  });
});
