export const createDefaultMfaStatus = () => ({
  required: false,
  loading: false,
  enrolled: false,
  verified: true,
  factorId: null,
  error: '',
});

export const normalizeMfaCode = (value) => {
  const normalized = typeof value === 'string' ? value.replace(/\s+/g, '') : '';
  return /^\d{6}$/.test(normalized) ? normalized : '';
};

export const getVerifiedTotpFactor = (factors) => (
  factors?.totp?.find(factor => factor.status === 'verified')
  || factors?.all?.find(factor => (
    factor.factor_type === 'totp' && factor.status === 'verified'
  ))
  || null
);

export const getUnverifiedTotpFactors = (factors) => (
  (factors?.all || []).filter(factor => (
    factor.factor_type === 'totp' && factor.status === 'unverified'
  ))
);

export const createTotpQrDataUrl = (svg) => (
  typeof svg === 'string' && svg.trim()
    ? `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`
    : ''
);

export async function readAdminMfaStatus(auth, role) {
  if (role !== 'admin') return createDefaultMfaStatus();

  const [assuranceResult, factorsResult] = await Promise.all([
    auth.mfa.getAuthenticatorAssuranceLevel(),
    auth.mfa.listFactors(),
  ]);

  if (assuranceResult.error) throw assuranceResult.error;
  if (factorsResult.error) throw factorsResult.error;

  const factor = getVerifiedTotpFactor(factorsResult.data);
  return {
    required: true,
    loading: false,
    enrolled: Boolean(factor),
    verified: Boolean(factor) && assuranceResult.data?.currentLevel === 'aal2',
    factorId: factor?.id || null,
    error: '',
  };
}
