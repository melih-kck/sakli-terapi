import { createHash, timingSafeEqual } from 'node:crypto';

const REQUIRED_ENVIRONMENT = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'EMAIL_FROM',
];

const BRAND_NAME = 'Saklı Terapi';

export const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const getBearerToken = (request) => {
  const authorization = request.headers?.authorization;
  if (typeof authorization !== 'string') return '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
};

export const hasValidWorkerToken = (request, expectedToken) => {
  if (!expectedToken) return false;
  const providedDigest = createHash('sha256').update(getBearerToken(request)).digest();
  const expectedDigest = createHash('sha256').update(expectedToken).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
};

const getConfiguration = () => ({
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM,
  workerSecret: process.env.EMAIL_WORKER_SECRET || process.env.CRON_SECRET,
  appUrl: process.env.PUBLIC_APP_URL || 'https://sakli-terapi.vercel.app',
});

const callSupabaseRpc = async (configuration, functionName, body) => {
  const response = await fetch(`${configuration.supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: configuration.serviceRoleKey,
      authorization: `Bearer ${configuration.serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase RPC ${functionName} failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  if (response.status === 204) return null;
  return response.json();
};

export const getSafeEmailActionUrl = (actionPath, appUrl) => {
  if (typeof actionPath !== 'string' || !actionPath.startsWith('/') || actionPath.startsWith('//')) {
    return null;
  }

  try {
    const baseUrl = new URL(appUrl);
    const actionUrl = new URL(actionPath, baseUrl);
    return actionUrl.origin === baseUrl.origin ? actionUrl.toString() : null;
  } catch {
    return null;
  }
};

const normalizeEmailSubject = (value) => {
  const normalized = Array.from(String(value || ''), (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : character;
  }).join('').trim().slice(0, 200);
  return normalized || BRAND_NAME;
};

export const buildEmailContent = (notification, appUrl) => {
  const subject = normalizeEmailSubject(notification.notification_title);
  const safeTitle = escapeHtml(subject);
  const safeMessage = escapeHtml(notification.notification_message);
  const actionUrl = getSafeEmailActionUrl(notification.notification_action_url, appUrl);
  const actionMarkup = actionUrl
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 18px;background:#BD3F36;color:#FFFAF0;text-decoration:none;border-radius:6px">${BRAND_NAME}'de Görüntüle</a></p>`
    : '';

  return {
    subject,
    text: `${subject}\n\n${notification.notification_message}${actionUrl ? `\n\n${actionUrl}` : ''}`,
    html: `<!doctype html><html lang="tr"><body style="margin:0;background:#F4F0E7;font-family:Arial,sans-serif;color:#102F2D"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="background:#FFFAF0;border:1px solid #D8D5CC;border-radius:8px;padding:28px"><p style="margin:0 0 18px;font-size:18px;font-weight:700">${BRAND_NAME}</p><h1 style="margin:0 0 12px;font-size:22px">${safeTitle}</h1><p style="margin:0;line-height:1.6;color:#526861">${safeMessage}</p>${actionMarkup}</div><p style="margin:16px 0 0;font-size:12px;color:#526861">Bu e-posta, hesap ayarlarınızda etkinleştirdiğiniz operasyonel bildirim tercihlerine göre gönderildi.</p></div></body></html>`,
  };
};

const sendEmail = async (configuration, notification) => {
  const content = buildEmailContent(notification, configuration.appUrl);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${configuration.resendApiKey}`,
      'content-type': 'application/json',
      'idempotency-key': `sakli-terapi-notification-${notification.queue_id}`,
    },
    body: JSON.stringify({
      from: configuration.emailFrom,
      to: [notification.recipient_email],
      subject: content.subject,
      text: content.text,
      html: content.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend delivery failed (${response.status}): ${detail.slice(0, 300)}`);
  }
};

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ success: false, code: 'method_not_allowed' });
  }

  const configuration = getConfiguration();
  if (!configuration.workerSecret) {
    console.error('Email delivery worker secret is not configured.');
    return response.status(503).json({
      success: false,
      code: 'email_delivery_not_configured',
    });
  }

  if (!hasValidWorkerToken(request, configuration.workerSecret)) {
    return response.status(401).json({ success: false, code: 'unauthorized' });
  }

  const missingEnvironment = REQUIRED_ENVIRONMENT.filter(name => !process.env[name]);
  if (!configuration.supabaseUrl) missingEnvironment.push('SUPABASE_URL');

  if (missingEnvironment.length > 0) {
    console.error('Email delivery environment is incomplete:', [...new Set(missingEnvironment)]);
    return response.status(503).json({
      success: false,
      code: 'email_delivery_not_configured',
    });
  }

  let notifications;
  try {
    notifications = await callSupabaseRpc(configuration, 'claim_email_notification_batch', { batch_size: 20 });
  } catch (error) {
    console.error('Email queue could not be claimed:', error);
    return response.status(502).json({ success: false, code: 'queue_unavailable' });
  }

  const results = [];
  for (const notification of notifications || []) {
    let wasSent = false;
    let failureMessage = null;

    try {
      await sendEmail(configuration, notification);
      wasSent = true;
    } catch (error) {
      failureMessage = error.message;
      console.error('Email notification delivery failed:', {
        queueId: notification.queue_id,
        error: failureMessage,
      });
    }

    try {
      await callSupabaseRpc(configuration, 'complete_email_notification', {
        p_queue_id: notification.queue_id,
        p_was_sent: wasSent,
        p_failure_message: failureMessage,
      });
    } catch (error) {
      console.error('Email queue completion failed:', {
        queueId: notification.queue_id,
        error: error.message,
      });
    }

    results.push({ queueId: notification.queue_id, sent: wasSent });
  }

  return response.status(200).json({
    success: true,
    processed: results.length,
    sent: results.filter(result => result.sent).length,
    failed: results.filter(result => !result.sent).length,
  });
}
