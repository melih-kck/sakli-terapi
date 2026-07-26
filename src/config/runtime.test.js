import { describe, expect, it } from 'vitest';
import { APP_MODE, FEATURES, IS_DEMO_MODE } from './runtime';

describe('runtime feature gates', () => {
  it('defaults to the safe academic demo mode', () => {
    expect(APP_MODE).toBe('demo');
    expect(IS_DEMO_MODE).toBe(true);
  });

  it('keeps every real-world capability closed in demo mode', () => {
    expect(FEATURES).toEqual({
      liveAuthentication: false,
      publicRegistration: false,
      professionalApplications: false,
      liveAppointments: false,
      liveSessions: false,
      payments: false,
    });
  });
});
