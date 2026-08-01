import { expect, test } from '@playwright/test';

const expectNoHorizontalOverflow = async (page) => {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
};

const openDemoRole = async (page, role, destination) => {
  await page.goto('/giris');
  await page.locator(`#demo-login-${role}`).click();
  await expect(page).toHaveURL(new RegExp(`${destination.replace('/', '\\/')}$`));
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem('sakli_terapi_language')) {
      window.localStorage.setItem('sakli_terapi_language', 'tr');
    }
  });
});

test('ana sayfa açılır ve dil tercihi yenilemede korunur', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Saklı Terapi/);
  await expect(page.getByRole('heading', { level: 1, name: 'Saklı Terapi' })).toBeVisible();
  await expect(page.locator('#hero-cta-start')).toHaveAttribute('href', '/giris');
  await expectNoHorizontalOverflow(page);

  const isMobile = (page.viewportSize()?.width || 0) <= 768;
  if (isMobile) {
    await page.locator('#nav-hamburger').click();
    await page.locator('#nav-language-mobile').selectOption('en');
  } else {
    await page.locator('#nav-language-desktop').selectOption('en');
  }

  await expect(page.getByRole('link', { name: 'Open Interactive Demo' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Open Interactive Demo' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('giriş demosu blur korumasını ve merkezli önizlemeyi gösterir', async ({ page }) => {
  await page.goto('/giris');
  await page.addStyleTag({ content: '.blur-demo-remote-image { transition: none !important; }' });

  const sentImage = page.locator('.blur-demo-remote-image');
  const stage = page.locator('.blur-demo-stage');
  const localPreview = page.locator('.blur-demo-local');
  const slider = page.locator('#demo-blur-level');

  await expect(sentImage).toBeVisible();
  await expect(slider).toHaveValue('5');
  await expect(sentImage).toHaveCSS('filter', 'blur(28px)');
  await expect(sentImage).toHaveCSS('object-position', '50% 46%');

  const framing = await page.evaluate(() => {
    const image = document.querySelector('.blur-demo-remote-image');
    const stageRect = document.querySelector('.blur-demo-stage').getBoundingClientRect();
    const localRect = document.querySelector('.blur-demo-local').getBoundingClientRect();

    return {
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      stageLeft: stageRect.left,
      stageRight: stageRect.right,
      localLeft: localRect.left,
      localRight: localRect.right,
    };
  });

  expect(framing.naturalWidth).toBe(1200);
  expect(framing.naturalHeight).toBe(900);
  expect(framing.localLeft).toBeGreaterThan(framing.stageLeft);
  expect(framing.localRight).toBeLessThan(framing.stageRight);
  await expect(stage).toBeVisible();
  await expect(localPreview).toBeVisible();

  await slider.fill('0');
  const consent = page.locator('#demo-clear-video-consent');
  await expect(consent).toBeVisible();
  await expect(sentImage).toHaveCSS('filter', 'blur(28px)');

  await consent.check();
  await expect(sentImage).toHaveCSS('filter', 'blur(0px)');
  await expect(sentImage).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await expectNoHorizontalOverflow(page);
});

const roles = [
  {
    role: 'client',
    destination: '/panel',
    heading: /Merhaba, Mavi Defter/,
  },
  {
    role: 'psychologist',
    destination: '/psikolog-panel',
    heading: /Hoş geldiniz, Klinik Psikolog Demo Uzmanı/,
  },
  {
    role: 'admin',
    destination: '/admin',
    heading: 'Yönetici Paneli',
  },
];

for (const roleCase of roles) {
  test(`${roleCase.role} demo rolü doğru panele açılır`, async ({ page }) => {
    await openDemoRole(page, roleCase.role, roleCase.destination);

    await expect(page.getByRole('heading', {
      level: 1,
      name: roleCase.heading,
    })).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => page.evaluate(() => (
      JSON.parse(window.localStorage.getItem('mock_user_session'))?.role
    ))).toBe(roleCase.role);
    await expectNoHorizontalOverflow(page);
  });
}

test('yönetici demo belgesini aynı sekmede güvenilir biçimde görüntüler', async ({ page }) => {
  await openDemoRole(page, 'admin', '/admin');

  await page.locator('summary').click();
  await page.getByRole('button', { name: 'Görüntüle', exact: true }).click();

  await expect(page).toHaveURL(/\/demo-belge\.html$/);
  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Mesleki Belge İnceleme Örneği',
  })).toBeVisible();
});

test('danışan seans odasında blursuz görüntüyü yalnızca açık onayla paylaşır', async ({ page }) => {
  await openDemoRole(page, 'client', '/panel');

  const sessionLink = page.locator('a[href="/seans/demo-session-privacy"]');
  await expect(sessionLink).toBeVisible();
  await sessionLink.click();
  await expect(page).toHaveURL(/\/seans\/demo-session-privacy$/);

  const sessionSlider = page.locator('#session-blur-level');
  await expect(sessionSlider).toBeVisible();
  await expect(sessionSlider).toHaveValue('5');
  await expect(page.locator('.blur-send-status strong')).toHaveText('Blurlu');

  await sessionSlider.fill('0');
  const sessionConsent = page.locator('.blur-clear-consent input[type="checkbox"]');
  await expect(sessionConsent).toBeVisible();
  await expect(page.locator('.blur-send-status strong')).toHaveText('Blurlu');

  await sessionConsent.check();
  await expect(page.locator('.blur-send-status strong')).toHaveText('Blursuz');

  const startSimulation = page.getByRole('button', {
    name: 'Görüşme Simülasyonunu Başlat',
  });
  await expect(startSimulation).toBeVisible();
  await startSimulation.click();
  await expect(startSimulation).toBeHidden();
  await expectNoHorizontalOverflow(page);
});
