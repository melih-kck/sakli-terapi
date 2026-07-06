import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  getSessionDateTime,
  getSessionFee,
  getSessionJoinState,
  getSessionSlotKey,
  isSessionSlotBookable,
  isSessionSlotInPast,
} from './session-flow';

describe('session-flow', () => {
  it('uses the session fee before the psychologist profile fee', () => {
    expect(getSessionFee(
      { sessionPrice: 1800 },
      { fee: 1250 },
    )).toBe(1250);
  });

  it('falls back to the psychologist fee and then the default fee', () => {
    expect(getSessionFee({ basePrice: 1600 }, {})).toBe(1600);
    expect(getSessionFee(null, null)).toBe(1000);
  });

  it('builds a local date with the selected appointment time', () => {
    const result = getSessionDateTime({
      date: '2026-07-05',
      time: '14:30',
    });

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(5);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });

  it('does not allow cancelled, completed, or unpaid sessions to open', () => {
    expect(getSessionJoinState({ status: 'cancelled' }).code).toBe('cancelled');
    expect(getSessionJoinState({ status: 'completed' }).code).toBe('completed');
    expect(getSessionJoinState({ status: 'confirmed', paymentStatus: 'pending' }).code)
      .toBe('payment');
  });

  it('formats Turkish lira without fractional digits', () => {
    const result = formatCurrency(1250);

    expect(result).toContain('1.250');
    expect(result).toMatch(/₺|TL/);
  });

  it('builds stable booking slot keys', () => {
    expect(getSessionSlotKey('2026-07-07', '14:30')).toBe('2026-07-07|14:30');
    expect(getSessionSlotKey('', '14:30')).toBe('');
  });

  it('rejects past and already-booked appointment slots', () => {
    const now = new Date('2026-07-07T12:00:00');

    expect(isSessionSlotInPast('2026-07-07', '11:00', now)).toBe(true);
    expect(isSessionSlotBookable({
      date: '2026-07-07',
      time: '14:30',
      bookedSlotKeys: ['2026-07-07|14:30'],
      now,
    })).toBe(false);
    expect(isSessionSlotBookable({
      date: '2026-07-07',
      time: '15:00',
      bookedSlotKeys: [],
      now,
    })).toBe(true);
  });
});
