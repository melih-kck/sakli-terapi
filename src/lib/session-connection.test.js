import { describe, expect, it } from 'vitest';
import {
  MAX_SESSION_MESSAGE_LENGTH,
  SESSION_CONNECTION_ATTEMPT_TIMEOUT_MS,
  isExpectedSessionPeer,
  normalizeIncomingSessionMessage,
  sanitizeSessionChatText,
  shouldRetrySessionConnection,
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

  it('checks the opaque server-issued peer id and expected participant role together', () => {
    const expected = {
      connection: {
        peer: 'target-peer',
        metadata: { role: 'psychologist' },
      },
      targetPeerId: 'target-peer',
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
        metadata: { role: 'client' },
      },
    })).toBe(false);
  });

  it('retries only when the previous connection is not open', () => {
    expect(SESSION_CONNECTION_ATTEMPT_TIMEOUT_MS).toBe(8000);
    expect(shouldRetrySessionConnection({ connection: null, call: null })).toBe(true);
    expect(shouldRetrySessionConnection({
      connection: { open: false },
      call: null,
    })).toBe(true);
    expect(shouldRetrySessionConnection({
      connection: { open: true },
      call: null,
    })).toBe(false);
    expect(shouldRetrySessionConnection({
      connection: null,
      call: {},
    })).toBe(false);
  });
});
