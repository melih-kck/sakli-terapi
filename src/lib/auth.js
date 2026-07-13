export const getAuthRedirectUrl = (path, origin = window.location.origin) => (
  new URL(path, origin).toString()
);

export const isEmailNotConfirmedError = (authError) => {
  const code = authError?.code?.toLowerCase?.() || '';
  const message = authError?.message?.toLowerCase?.() || '';
  return code === 'email_not_confirmed' || message.includes('email not confirmed');
};

export const maskEmail = (email = '') => {
  const [localPart, domain] = email.trim().split('@');
  if (!localPart || !domain) return '';

  const visibleLength = Math.min(2, localPart.length);
  return `${localPart.slice(0, visibleLength)}${'*'.repeat(Math.max(localPart.length - visibleLength, 3))}@${domain}`;
};
