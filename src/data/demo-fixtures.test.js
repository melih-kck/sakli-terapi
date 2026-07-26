import { describe, expect, it } from 'vitest';
import { createDemoSessions, createDemoUser, DEMO_ROLE_OPTIONS } from './demo-fixtures';

describe('demo fixtures', () => {
  it('offers the three presentation roles with distinct destinations', () => {
    expect(DEMO_ROLE_OPTIONS.map(option => option.role)).toEqual([
      'client',
      'psychologist',
      'admin',
    ]);
    expect(new Set(DEMO_ROLE_OPTIONS.map(option => option.destination)).size).toBe(3);
  });

  it('keeps every demo appointment fictional and payment free', () => {
    const sessions = createDemoSessions();

    expect(sessions.length).toBeGreaterThanOrEqual(3);
    sessions.forEach((session) => {
      expect(session.id).toMatch(/^demo-session-/);
      expect(session.paymentRequired).toBe(false);
      expect(session.fee).toBe(0);
      expect(session.clientId).toBe('mock-client');
      expect(session.psychologistId).toBe('mock-psychologist');
    });
  });

  it('creates isolated users for each role without real account identifiers', () => {
    const users = DEMO_ROLE_OPTIONS.map(option => createDemoUser(option.role));

    expect(users.map(user => user.role)).toEqual(['client', 'psychologist', 'admin']);
    users.forEach((user) => {
      expect(user.id).toMatch(/^mock-/);
      expect(user.email).toMatch(/@demo\.sakliterapi\.local$/);
      expect(user.isDemo).toBe(true);
    });
  });
});
