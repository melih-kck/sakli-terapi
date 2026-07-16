import { describe, expect, it, vi } from 'vitest';
import {
  createTotpQrDataUrl,
  getUnverifiedTotpFactors,
  getVerifiedTotpFactor,
  normalizeMfaCode,
  readAdminMfaStatus,
} from './admin-mfa';

describe('admin-mfa', () => {
  it('accepts only a six digit authenticator code', () => {
    expect(normalizeMfaCode(' 123 456 ')).toBe('123456');
    expect(normalizeMfaCode('12345')).toBe('');
    expect(normalizeMfaCode('12345a')).toBe('');
  });

  it('selects only a verified TOTP factor', () => {
    const verified = { id: 'verified', factor_type: 'totp', status: 'verified' };
    expect(getVerifiedTotpFactor({
      totp: [verified],
      all: [{ id: 'pending', factor_type: 'totp', status: 'unverified' }],
    })).toBe(verified);
    expect(getVerifiedTotpFactor({
      totp: [],
      all: [{ id: 'pending', factor_type: 'totp', status: 'unverified' }],
    })).toBeNull();
  });

  it('finds abandoned unverified TOTP enrollments for cleanup', () => {
    expect(getUnverifiedTotpFactors({
      all: [
        { id: 'pending', factor_type: 'totp', status: 'unverified' },
        { id: 'verified', factor_type: 'totp', status: 'verified' },
        { id: 'phone', factor_type: 'phone', status: 'unverified' },
      ],
    }).map(factor => factor.id)).toEqual(['pending']);
  });

  it('requires an enrolled and verified factor for an admin session', async () => {
    const auth = {
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: { currentLevel: 'aal1', nextLevel: 'aal2' },
          error: null,
        }),
        listFactors: vi.fn().mockResolvedValue({
          data: {
            totp: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }],
            all: [],
          },
          error: null,
        }),
      },
    };

    await expect(readAdminMfaStatus(auth, 'admin')).resolves.toMatchObject({
      required: true,
      enrolled: true,
      verified: false,
      factorId: 'factor-1',
    });
    expect(auth.mfa.listFactors).toHaveBeenCalledOnce();
  });

  it('does not accept AAL2 without a verified TOTP factor', async () => {
    const auth = {
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: { currentLevel: 'aal2', nextLevel: 'aal2' },
          error: null,
        }),
        listFactors: vi.fn().mockResolvedValue({
          data: {
            totp: [],
            all: [{ id: 'phone-1', factor_type: 'phone', status: 'verified' }],
          },
          error: null,
        }),
      },
    };

    await expect(readAdminMfaStatus(auth, 'admin')).resolves.toMatchObject({
      required: true,
      enrolled: false,
      verified: false,
      factorId: null,
    });
  });

  it('does not call MFA APIs for non-admin roles', async () => {
    const auth = { mfa: { listFactors: vi.fn() } };
    await expect(readAdminMfaStatus(auth, 'client')).resolves.toMatchObject({
      required: false,
      verified: true,
    });
    expect(auth.mfa.listFactors).not.toHaveBeenCalled();
  });

  it('encodes the enrollment SVG as an image data URL', () => {
    const url = createTotpQrDataUrl('<svg><text>secret</text></svg>');
    expect(url).toMatch(/^data:image\/svg\+xml;utf-8,/);
    expect(url).not.toContain('<svg>');
  });
});
