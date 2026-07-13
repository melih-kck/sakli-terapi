import { describe, expect, it } from 'vitest';
import {
  MAX_SESSION_MESSAGE_LENGTH,
  isExpectedSessionPeer,
  normalizeIncomingSessionMessage,
  sanitizeSessionChatText,
} from './session-connection';

describe('session-connection', () => {
  it('accepts only bounded non-empty chat text', () => {
    expect(sanitizeSessionChatText('  Merhaba  ')).toBe('Merhaba');
    expect(sanitizeSessionChatText('   ')).toBe('');
    expect(sanitizeSessionChatText('a'.repeat(MAX_SESSION_MESSAGE_LENGTH + 1))).toBe('');
  });

  it('normalizes only messages from the expected participant role', () => {
    const now = new Date('2026-07-07T12:00:00');
    const message = normalizeIncomingSessionMessage({
      id: 'remote-1',
      text: ' Görüşmeye hazırım. ',
      sender: 'psychologist',
      time: '<script>',
    }, 'psychologist', now);

    expect(message).toEqual({
      id: 'remote-1',
      text: 'Görüşmeye hazırım.',
      sender: 'psychologist',
      time: now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    });
    expect(normalizeIncomingSessionMessage({
      text: 'Sahte rol',
      sender: 'client',
    }, 'psychologist', now)).toBeNull();
  });

  it('checks peer id and server-bound session metadata together', () => {
    const expected = {
      connection: {
        peer: 'target-peer',
        metadata: { sessionId: 'session-1', role: 'psychologist' },
      },
      targetPeerId: 'target-peer',
      sessionId: 'session-1',
      expectedRole: 'psychologist',
    };

    expect(isExpectedSessionPeer(expected)).toBe(true);
    expect(isExpectedSessionPeer({
      ...expected,
      connection: { ...expected.connection, peer: 'unexpected-peer' },
    })).toBe(false);
    expect(isExpectedSessionPeer({
      ...expected,
      connection: {
        ...expected.connection,
        metadata: { sessionId: 'other-session', role: 'psychologist' },
      },
    })).toBe(false);
  });
});
