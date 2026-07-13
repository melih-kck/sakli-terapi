import { describe, expect, it } from 'vitest';
import { buildEmailContent, escapeHtml } from '../../api/process-email-notifications';

describe('email notification worker', () => {
  it('escapes user-visible database content before rendering HTML', () => {
    expect(escapeHtml('<script>"test"</script>'))
      .toBe('&lt;script&gt;&quot;test&quot;&lt;/script&gt;');
  });

  it('keeps action links on the configured application origin', () => {
    const content = buildEmailContent({
      notification_title: 'Randevu <güncellendi>',
      notification_message: 'Yeni durum: onaylandı',
      notification_action_url: '/panel',
    }, 'https://gizlibiriz.vercel.app');

    expect(content.subject).toBe('Randevu <güncellendi>');
    expect(content.html).toContain('Randevu &lt;güncellendi&gt;');
    expect(content.html).toContain('https://gizlibiriz.vercel.app/panel');
  });
});
