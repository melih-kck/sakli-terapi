const REQUIRED_ENVIRONMENT = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'EMAIL_FROM',
];

export const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const getBearerToken = (request) => {
  const authorization = request.headers.authorization || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
};

const getConfiguration = () => ({
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM,
  workerSecret: process.env.EMAIL_WORKER_SECRET || process.env.CRON_SECRET,
  appUrl: process.env.PUBLIC_APP_URL || 'https://gizlibiriz.vercel.app',
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

export const buildEmailContent = (notification, appUrl) => {
  const safeTitle = escapeHtml(notification.notification_title);
  const safeMessage = escapeHtml(notification.notification_message);
  const actionPath = notification.notification_action_url;
  const actionUrl = actionPath?.startsWith('/') && !actionPath.startsWith('//')
    ? new URL(notification.notification_action_url, appUrl).toString()
    : null;
  const actionMarkup = actionUrl
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 18px;background:#6d5dfc;color:#fff;text-decoration:none;border-radius:6px">GizliBiriz'de Görüntüle</a></p>`
    : '';

  return {
    subject: notification.notification_title,
    text: `${notification.notification_title}\n\n${notification.notification_message}${actionUrl ? `\n\n${actionUrl}` : ''}`,
    html: `<!doctype html><html lang="tr"><body style="margin:0;background:#f5f6f8;font-family:Arial,sans-serif;color:#20242c"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border:1px solid #e2e5ea;border-radius:8px;padding:28px"><p style="margin:0 0 18px;font-size:18px;font-weight:700">GizliBiriz</p><h1 style="margin:0 0 12px;font-size:22px">${safeTitle}</h1><p style="margin:0;line-height:1.6;color:#4f5663">${safeMessage}</p>${actionMarkup}</div><p style="margin:16px 0 0;font-size:12px;color:#737b88">Bu e-posta, hesap ayarlarınızda etkinleştirdiğiniz operasyonel bildirim tercihlerine göre gönderildi.</p></div></body></html>`,
  };
};

const sendEmail = async (configuration, notification) => {
  const content = buildEmailContent(notification, configuration.appUrl);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${configuration.resendApiKey}`,
      'content-type': 'application/json',
      'idempotency-key': `gizlibiriz-notification-${notification.queue_id}`,
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
  const missingEnvironment = REQUIRED_ENVIRONMENT.filter(name => !process.env[name]);
  if (!configuration.supabaseUrl) missingEnvironment.push('SUPABASE_URL');
  if (!configuration.workerSecret) missingEnvironment.push('EMAIL_WORKER_SECRET');

  if (missingEnvironment.length > 0) {
    return response.status(503).json({
      success: false,
      code: 'email_delivery_not_configured',
      missing: [...new Set(missingEnvironment)],
    });
  }

  if (getBearerToken(request) !== configuration.workerSecret) {
    return response.status(401).json({ success: false, code: 'unauthorized' });
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
