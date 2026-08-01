import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler, {
  buildEmailContent,
  escapeHtml,
  getSafeEmailActionUrl,
  hasValidWorkerToken,
} from '../../api/process-email-notifications';

const environmentKeys = [
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'EMAIL_WORKER_SECRET',
  'CRON_SECRET',
];
const originalEnvironment = Object.fromEntries(
  environmentKeys.map(key => [key, process.env[key]]),
);

const createResponse = () => {
  const response = {
    body: null,
    statusCode: null,
    setHeader: vi.fn(),
    status: vi.fn(code => {
      response.statusCode = code;
      return response;
    }),
    json: vi.fn(body => {
      response.body = body;
      return response;
    }),
  };
  return response;
};

describe('email notification worker', () => {
  beforeEach(() => {
    for (const key of environmentKeys) delete process.env[key];
  });

  afterEach(() => {
    for (const key of environmentKeys) {
      if (originalEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnvironment[key];
    }
    vi.restoreAllMocks();
  });

  it('escapes user-visible database content before rendering HTML', () => {
    expect(escapeHtml('<script>"test"</script>'))
      .toBe('&lt;script&gt;&quot;test&quot;&lt;/script&gt;');
  });

  it('keeps action links on the configured application origin', () => {
    const content = buildEmailContent({
      notification_title: 'Randevu <güncellendi>',
      notification_message: 'Yeni durum: onaylandı',
      notification_action_url: '/panel',
    }, 'https://sakli-terapi.vercel.app');

    expect(content.subject).toBe('Randevu <güncellendi>');
    expect(content.html).toContain('Randevu &lt;güncellendi&gt;');
    expect(content.html).toContain('Saklı Terapi');
    expect(content.html).toContain('https://sakli-terapi.vercel.app/panel');
    expect(content.html).toContain('#BD3F36');
  });

  it('rejects absolute and backslash-normalized off-site action URLs', () => {
    expect(getSafeEmailActionUrl('/panel', 'https://sakli-terapi.vercel.app'))
      .toBe('https://sakli-terapi.vercel.app/panel');
    expect(getSafeEmailActionUrl('https://evil.example/path', 'https://sakli-terapi.vercel.app'))
      .toBeNull();
    expect(getSafeEmailActionUrl('/\\evil.example/path', 'https://sakli-terapi.vercel.app'))
      .toBeNull();
  });

  it('removes control characters and caps the email subject', () => {
    const content = buildEmailContent({
      notification_title: `Başlık\r\nBcc:\tattacker@example.com\0${'x'.repeat(300)}`,
      notification_message: 'Mesaj',
      notification_action_url: null,
    }, 'https://sakli-terapi.vercel.app');

    expect([...content.subject].every((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })).toBe(true);
    expect(content.subject).toHaveLength(200);
  });

  it('compares worker credentials without accepting missing or incorrect tokens', () => {
    expect(hasValidWorkerToken({ headers: { authorization: 'Bearer correct' } }, 'correct')).toBe(true);
    expect(hasValidWorkerToken({ headers: { authorization: 'Bearer wrong' } }, 'correct')).toBe(false);
    expect(hasValidWorkerToken({ headers: {} }, '')).toBe(false);
  });

  it('does not expose missing server configuration details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = createResponse();

    await handler({ method: 'GET', headers: {} }, response);

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({
      success: false,
      code: 'email_delivery_not_configured',
    });
    expect(response.body).not.toHaveProperty('missing');
  });

  it('authenticates the worker before reporting other configuration failures', async () => {
    process.env.EMAIL_WORKER_SECRET = 'configured-secret';
    const response = createResponse();

    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer incorrect-secret' },
    }, response);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ success: false, code: 'unauthorized' });
  });
});
