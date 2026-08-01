import { expect, test } from '@playwright/test';

const publicPages = [
  '/',
  '/giris',
  '/psikologlar',
  '/psikolog/1',
  '/hakkinda',
  '/sss',
  '/gizlilik-politikasi',
  '/kullanim-kosullari',
  '/kayit',
  '/sifremi-unuttum',
  '/bulunamadi',
];

const expectHealthyPage = async (page, errors) => {
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page).toHaveTitle(/Saklı Terapi/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/sakli-terapi\.vercel\.app\//);
  await expect(page.locator('html')).toHaveAttribute('lang', /^(tr|en)$/);

  const pageContract = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    const brokenImages = [...document.images]
      .filter(image => image.complete && image.naturalWidth === 0)
      .map(image => image.currentSrc || image.src);
    const emptyLinks = [...document.querySelectorAll('a')]
      .filter(link => !link.getAttribute('href'))
      .map(link => link.textContent?.trim());

    return {
      duplicateIds: [...new Set(duplicateIds)],
      brokenImages,
      emptyLinks,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(pageContract.duplicateIds).toEqual([]);
  expect(pageContract.brokenImages).toEqual([]);
  expect(pageContract.emptyLinks).toEqual([]);
  expect(pageContract.documentWidth).toBeLessThanOrEqual(pageContract.viewportWidth + 1);
  expect(errors).toEqual([]);
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem('sakli_terapi_language')) {
      window.localStorage.setItem('sakli_terapi_language', 'tr');
    }
  });
});

for (const path of publicPages) {
  test(`${path} yayın sayfası sözleşmesini korur`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });

    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(400);
    await expectHealthyPage(page, errors);
  });
}

const protectedPages = [
  { role: 'client', destination: '/panel', paths: ['/panel', '/ayarlar', '/bildirimler', '/seans/demo-session-privacy'] },
  { role: 'psychologist', destination: '/psikolog-panel', paths: ['/psikolog-panel', '/ayarlar', '/bildirimler', '/degerlendirmeler'] },
  { role: 'admin', destination: '/admin', paths: ['/admin', '/ayarlar', '/bildirimler'] },
];

for (const roleCase of protectedPages) {
  test(`${roleCase.role} rolünün bütün sayfaları yayın sözleşmesini korur`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });

    await page.goto('/giris');
    await page.locator(`#demo-login-${roleCase.role}`).click();
    await expect(page).toHaveURL(new RegExp(`${roleCase.destination.replace('/', '\\/')}$`));

    for (const path of roleCase.paths) {
      await page.goto(path);
      await expectHealthyPage(page, errors);
    }
  });
}

test('İngilizce tercih ana demo akışında korunur', async ({ page }) => {
  await page.goto('/');
  const isMobile = (page.viewportSize()?.width || 0) <= 900;
  if (isMobile) {
    await page.locator('#nav-hamburger').click();
    await page.locator('#nav-language-mobile').selectOption('en');
  } else {
    await page.locator('#nav-language-desktop').selectOption('en');
  }

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.goto('/giris');
  await expect(page.getByRole('heading', { level: 1, name: 'Open the Demo with a Role' })).toBeVisible();
  await page.locator('#demo-login-client').click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText('Demo Ready', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: /Hello, Mavi Defter/ })).toBeVisible();
  await page.goto('/ayarlar');
  await expect(page.getByRole('heading', { level: 1, name: 'Account Settings' })).toBeVisible();
  await page.getByRole('tab', { name: 'Privacy & Security' }).click();
  await expect(page.getByRole('heading', { level: 4, name: 'Demo Data' })).toBeVisible();
  await page.goto('/seans/demo-session-privacy');
  await expect(page.getByRole('button', { name: 'Start Consultation Simulation' })).toBeVisible();
  await expect(page.getByText('The demo video is ready. You can start the consultation simulation.')).toBeVisible();

  await page.goto('/giris');
  await page.locator('#demo-login-admin').click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Administrator Panel' })).toBeVisible();
  let resetDialogMessage = '';
  page.once('dialog', async (dialog) => {
    resetDialogMessage = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Reset Demo Data' }).click();
  expect(resetDialogMessage).toBe('Reset the fictional administrator data to its initial state?');
});
