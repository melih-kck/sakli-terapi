import { describe, expect, it } from 'vitest';
import {
  sanitizeMonitoringBreadcrumb,
  sanitizeMonitoringEvent,
} from './monitoring';

describe('monitoring privacy filters', () => {
  it('removes user data and query or hash values from request URLs', () => {
    const event = sanitizeMonitoringEvent({
      user: { email: 'private@example.com' },
      request: {
        method: 'GET',
        url: 'https://sakli-terapi.vercel.app/sifre-yenile?code=secret#token',
        headers: { authorization: 'Bearer secret' },
      },
    });

    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({
      method: 'GET',
      url: 'https://sakli-terapi.vercel.app/sifre-yenile',
    });
  });

  it('sanitizes navigation breadcrumbs and drops input details', () => {
    expect(sanitizeMonitoringBreadcrumb({
      category: 'navigation',
      data: {
        from: 'https://sakli-terapi.vercel.app/giris?email=private@example.com',
        to: 'https://sakli-terapi.vercel.app/panel#session',
      },
    })).toEqual({
      category: 'navigation',
      data: {
        from: 'https://sakli-terapi.vercel.app/giris',
        to: 'https://sakli-terapi.vercel.app/panel',
      },
    });

    expect(sanitizeMonitoringBreadcrumb({
      category: 'ui.input',
      message: 'input#password',
      data: { value: 'secret' },
    })).toEqual({
      category: 'ui.input',
      message: 'Input interaction',
    });
  });
});
