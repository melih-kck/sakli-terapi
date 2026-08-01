import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const wcagTags = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
];

test.use({ reducedMotion: 'reduce' });

const expectAccessiblePage = async (page) => {
  await page.waitForTimeout(800);

  const results = await new AxeBuilder({ page })
    .withTags(wcagTags)
    .analyze();

  const violations = results.violations.map(violation => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map(node => ({
      target: node.target.join(' '),
      summary: node.failureSummary,
    })),
  }));

  expect(violations).toEqual([]);
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('sakli_terapi_language', 'tr');
  });
});

const publicPages = [
  { path: '/', name: 'ana sayfa' },
  { path: '/giris', name: 'demo giriş ekranı' },
  { path: '/psikologlar', name: 'uzman kataloğu' },
  { path: '/psikolog/1', name: 'uzman profili' },
  { path: '/hakkinda', name: 'proje hakkında sayfası' },
  { path: '/sss', name: 'sık sorulan sorular sayfası' },
  { path: '/gizlilik-politikasi', name: 'gizlilik politikası' },
  { path: '/kullanim-kosullari', name: 'kullanım koşulları' },
  { path: '/kayit', name: 'demo kısıt ekranı' },
  { path: '/bulunamadi', name: 'bulunamadı sayfası' },
];

for (const publicPage of publicPages) {
  test(`${publicPage.name} WCAG A ve AA kontrollerini geçer`, async ({ page }) => {
    await page.goto(publicPage.path);
    await expect(page.locator('main')).toBeVisible();
    await expectAccessiblePage(page);
  });
}

test('yönetici paneli WCAG A ve AA kontrollerini geçer', async ({ page }) => {
  await page.goto('/giris');
  await page.locator('#demo-login-admin').click();
  await expect(page).toHaveURL(/\/admin$/);
  await expectAccessiblePage(page);
});

const protectedRolePages = [
  {
    role: 'client',
    destination: '/panel',
    paths: ['/panel', '/ayarlar', '/bildirimler'],
  },
  {
    role: 'psychologist',
    destination: '/psikolog-panel',
    paths: ['/psikolog-panel', '/ayarlar', '/bildirimler', '/degerlendirmeler'],
  },
  {
    role: 'admin',
    destination: '/admin',
    paths: ['/admin', '/ayarlar', '/bildirimler'],
  },
];

for (const roleCase of protectedRolePages) {
  test(`${roleCase.role} rolünün korumalı sayfaları WCAG A ve AA kontrollerini geçer`, async ({ page }) => {
    await page.goto('/giris');
    await page.locator(`#demo-login-${roleCase.role}`).click();
    await expect(page).toHaveURL(new RegExp(`${roleCase.destination.replace('/', '\\/')}$`));

    for (const path of roleCase.paths) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await expectAccessiblePage(page);
    }
  });
}

test('seans odası WCAG A ve AA kontrollerini geçer', async ({ page }) => {
  await page.goto('/giris');
  await page.locator('#demo-login-client').click();
  await expect(page).toHaveURL(/\/panel$/);
  await page.locator('a[href="/seans/demo-session-privacy"]').click();
  await expect(page).toHaveURL(/\/seans\/demo-session-privacy$/);
  await expectAccessiblePage(page);
});
