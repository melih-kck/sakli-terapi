import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseURL = process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:5174';
const outputDirectory = new URL('../docs/screenshots/', import.meta.url);

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'tr-TR',
  colorScheme: 'light',
});
const page = await context.newPage();

await page.addInitScript(() => {
  window.localStorage.setItem('sakli_terapi_language', 'tr');
});

await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
const noticeClose = page.getByRole('button', { name: 'Demo bilgisini kapat' });
if (await noticeClose.isVisible()) await noticeClose.click();
await page.screenshot({
  path: fileURLToPath(new URL('landing-overview.jpg', outputDirectory)),
  type: 'jpeg',
  quality: 88,
});

await page.goto(`${baseURL}/giris`, { waitUntil: 'networkidle' });
await page.screenshot({
  path: fileURLToPath(new URL('privacy-demo.jpg', outputDirectory)),
  type: 'jpeg',
  quality: 88,
});

await page.locator('#demo-login-admin').click();
await page.waitForURL('**/admin');
const toastClose = page.getByRole('button', { name: 'Bildirimi kapat' });
if (await toastClose.isVisible()) await toastClose.click();
const adminNoticeClose = page.getByRole('button', { name: 'Demo bilgisini kapat' });
if (await adminNoticeClose.isVisible()) await adminNoticeClose.click();
await page.locator('summary').click();
await page.screenshot({
  path: fileURLToPath(new URL('admin-review.jpg', outputDirectory)),
  type: 'jpeg',
  quality: 88,
});

await browser.close();
