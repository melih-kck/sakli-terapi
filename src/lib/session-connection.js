export const MAX_SESSION_MESSAGE_LENGTH = 2000;
export const SESSION_CONNECTION_ATTEMPT_TIMEOUT_MS = 8000;

const SESSION_ROLES = new Set(['client', 'psychologist']);

export const sanitizeSessionChatText = (value) => {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized.length <= MAX_SESSION_MESSAGE_LENGTH ? normalized : '';
};

export const normalizeIncomingSessionMessage = (
  value,
  expectedSender,
  now = new Date(),
) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!SESSION_ROLES.has(expectedSender) || value.sender !== expectedSender) return null;

  const text = sanitizeSessionChatText(value.text);
  if (!text) return null;

  const remoteId = typeof value.id === 'string' && value.id.length <= 100
    ? value.id
    : `${expectedSender}-${now.getTime()}`;

  return {
    id: remoteId,
    text,
    sender: expectedSender,
    time: now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
  };
};

export const isExpectedSessionPeer = ({
  connection,
  targetPeerId,
  sessionId,
  expectedRole,
}) => (
  Boolean(connection)
  && connection.peer === targetPeerId
  && connection.metadata?.sessionId === String(sessionId)
  && connection.metadata?.role === expectedRole
);

export const shouldRetrySessionConnection = ({ connection, call }) => (
  !call && (!connection || !connection.open)
);
