import { describe, expect, it } from 'vitest';
import {
  MAX_VERIFICATION_FILE_SIZE,
  validateVerificationFile,
} from './verification-documents';

const makeFile = (overrides = {}) => ({
  name: 'diploma.pdf',
  type: 'application/pdf',
  size: 1280,
  ...overrides,
});

describe('psychologist verification file validation', () => {
  it('accepts supported non-empty files within the size limit', () => {
    expect(validateVerificationFile(makeFile())).toBeNull();
    expect(validateVerificationFile(makeFile({ type: 'image/jpeg' }))).toBeNull();
    expect(validateVerificationFile(makeFile({ type: 'image/png' }))).toBeNull();
  });

  it('rejects missing, empty, unsupported, and oversized files', () => {
    expect(validateVerificationFile(null)).toContain('seçin');
    expect(validateVerificationFile(makeFile({ size: 0 }))).toContain('Boş');
    expect(validateVerificationFile(makeFile({ type: 'text/plain' }))).toContain('PDF');
    expect(validateVerificationFile(makeFile({ size: MAX_VERIFICATION_FILE_SIZE + 1 }))).toContain('8 MB');
  });
});
