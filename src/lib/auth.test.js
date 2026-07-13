import { describe, expect, it } from 'vitest';
import { getAuthRedirectUrl, isEmailNotConfirmedError, maskEmail } from './auth';

describe('auth helpers', () => {
  it('builds same-origin auth redirect URLs', () => {
    expect(getAuthRedirectUrl('/hesap-dogrulandi', 'https://gizlibiriz.vercel.app/path'))
      .toBe('https://gizlibiriz.vercel.app/hesap-dogrulandi');
  });

  it('recognizes unconfirmed email errors without exposing other auth failures', () => {
    expect(isEmailNotConfirmedError({ code: 'email_not_confirmed' })).toBe(true);
    expect(isEmailNotConfirmedError({ message: 'Email not confirmed' })).toBe(true);
    expect(isEmailNotConfirmedError({ message: 'Invalid login credentials' })).toBe(false);
  });

  it('masks email addresses for confirmation screens', () => {
    expect(maskEmail('melih@example.com')).toBe('me***@example.com');
    expect(maskEmail('a@example.com')).toBe('a***@example.com');
    expect(maskEmail('invalid')).toBe('');
  });
});
