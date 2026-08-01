import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('sakli_terapi_language', 'tr');
  });
});

test('atlama bağlantısı ana içeriğe taşır ve odak görünürdür', async ({ page, browserName }) => {
  await page.goto('/');

  const main = page.locator('main');
  const skipLink = page.getByRole('link', { name: 'Ana içeriğe geç' });
  await expect(main).toHaveAttribute('id', 'main-content');

  if (browserName === 'webkit') {
    // Safari link tabbing depends on the host OS full-keyboard-access setting.
    await skipLink.focus();
  } else {
    await page.keyboard.press('Tab');
  }
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await expect.poll(() => skipLink.evaluate(element => {
    const style = getComputedStyle(element);
    return `${style.outlineStyle} ${style.outlineWidth}`;
  })).toBe('solid 3px');

  await page.keyboard.press('Enter');
  await expect(main).toBeFocused();
});

test('istemci tarafı rota değişimi yeni ana içeriğe odaklanır', async ({ page }) => {
  await page.goto('/');

  const isMobile = (page.viewportSize()?.width || 0) <= 900;
  if (isMobile) {
    await page.locator('#nav-hamburger').click();
    await expect(page.locator('#nav-home')).toBeFocused();
  }
  const psychologistsLink = page.locator('#nav-psychologists');
  await psychologistsLink.focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/psikologlar$/);
  await expect(page.locator('main')).toBeFocused();
  await expect(page).toHaveTitle(/\| Saklı Terapi$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://sakli-terapi.vercel.app/psikologlar');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://sakli-terapi.vercel.app/psikologlar');
});

test('gizlilik demosu ekran okuyucu adlarını ve durumunu sunar', async ({ page }) => {
  await page.goto('/giris');

  await expect(page.getByRole('main')).toContainText('Görüntünüzün nasıl iletildiğini anında görün');
  const slider = page.getByRole('slider', { name: 'Görüntü gizliliği' });
  await expect(slider).toHaveAttribute('aria-valuetext', 'Maksimum');
  await expect(page.locator('.blur-demo-status')).toHaveRole('status');
  await expect(page.locator('.blur-demo-status')).toContainText('Karşı taraf şu anda');
});

test('asenkron seans görünümü ana içerik sözleşmesini korur', async ({ page }) => {
  await page.goto('/giris');
  await page.locator('#demo-login-client').click();
  await expect(page).toHaveURL(/\/panel$/);
  await page.locator('a[href="/seans/demo-session-privacy"]').click();

  await expect(page).toHaveURL(/\/seans\/demo-session-privacy$/);
  await expect(page.getByRole('slider', { name: 'Bulanıklık' })).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('id', 'main-content');
  await expect(page.locator('main')).toHaveAttribute('tabindex', '-1');
  await expect(page).toHaveTitle('Psikolog ile seans odası | Saklı Terapi');
});

test('yönetici sekmeleri ok, Home ve End tuşlarıyla çalışır', async ({ page }) => {
  await page.goto('/giris');
  await page.locator('#demo-login-admin').click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('tabpanel')).not.toContainText('Veriler yükleniyor...');

  const tabs = page.getByRole('tab');
  const pendingTab = tabs.nth(0);
  const activeTab = tabs.nth(1);
  const auditTab = tabs.nth(3);

  await pendingTab.press('ArrowRight');
  await expect(activeTab).toBeFocused();
  await expect(activeTab).toHaveAttribute('aria-selected', 'true');

  await activeTab.press('End');
  await expect(auditTab).toBeFocused();
  await expect(auditTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'admin-tab-audit');

  await auditTab.press('Home');
  await expect(pendingTab).toBeFocused();
  await expect(pendingTab).toHaveAttribute('aria-selected', 'true');
});

test('SSS sekmeleri klavyeyle değiştirilir', async ({ page }) => {
  await page.goto('/sss');

  const tabs = page.getByRole('tab');
  const firstTab = tabs.first();
  const secondTab = tabs.nth(1);

  await firstTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(secondTab).toBeFocused();
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', await secondTab.getAttribute('id'));
});

test('ana sayfa SSS düğmeleri durumlarını ve yanıt görünürlüğünü bildirir', async ({ page }) => {
  await page.goto('/');

  const question = page.getByRole('button', { name: 'Saklı Terapi nasıl çalışır?' });
  await expect(question).toHaveAttribute('aria-expanded', 'false');
  const answerId = await question.getAttribute('aria-controls');
  await expect(page.locator(`#${answerId}`)).toBeHidden();

  await question.focus();
  await page.keyboard.press('Enter');
  await expect(question).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator(`#${answerId}`)).toBeVisible();
});

test('ayar sekmeleri dikey ok tuşlarıyla değiştirilir', async ({ page }) => {
  await page.goto('/giris');
  await page.locator('#demo-login-client').click();
  await expect(page).toHaveURL(/\/panel$/);
  await page.goto('/ayarlar');

  const tabList = page.getByRole('tablist', { name: 'Ayar bölümleri' });
  const tabs = tabList.getByRole('tab');
  const accountTab = tabs.first();
  const notificationsTab = tabs.nth(1);

  await expect(tabList).toHaveAttribute('aria-orientation', 'vertical');
  await accountTab.focus();
  await page.keyboard.press('ArrowDown');
  await expect(notificationsTab).toBeFocused();
  await expect(notificationsTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', await notificationsTab.getAttribute('id'));
});

test('mobil menü odağı içeride tutar ve Escape ile kapanır', async ({ page }) => {
  test.skip((page.viewportSize()?.width || 0) > 900, 'Yalnızca mobil menü profilinde çalışır.');
  await page.goto('/');

  const menuButton = page.locator('#nav-hamburger');
  const firstMenuLink = page.locator('#nav-home');
  const lastMenuAction = page.locator('#nav-mobile-login');

  await expect(firstMenuLink).toBeHidden();
  await menuButton.focus();
  await page.keyboard.press('Enter');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(firstMenuLink).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(lastMenuAction).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(firstMenuLink).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await expect(firstMenuLink).toBeHidden();
  await expect(menuButton).toBeFocused();
});
