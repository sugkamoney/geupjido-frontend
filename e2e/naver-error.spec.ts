import { expect, test, type Page } from '@playwright/test';

const NETWORK =
  '지도를 불러오지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.';
const AUTH =
  '지도 인증에 실패했습니다. 등록된 주소에서 접속했는지 확인해 주세요.';
const NAVER = '**/oapi.map.naver.com/**';

const script = (body: string) => ({
  status: 200,
  contentType: 'application/javascript',
  body,
});

async function expectNoMapLabels(page: Page) {
  await expect(
    page
      .getByRole('region', { name: '검토용 지도' })
      .getByRole('button')
      .filter({ hasNotText: '다시 시도' }),
  ).toHaveCount(0);
}

test('network error shows alert and retry requests maps.js once more', async ({
  page,
}) => {
  await page.route(NAVER, (r) => r.abort());
  await page.goto('/');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText(NETWORK);
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
  await expectNoMapLabels(page);

  let mapsRequests = 0;
  await page.unroute(NAVER);
  await page.route(NAVER, (r) => {
    if (r.request().url().includes('/maps.js')) mapsRequests += 1;
    return r.fulfill(script(''));
  });
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect.poll(() => mapsRequests).toBe(1);
});

test('auth failure shows the authentication message', async ({ page }) => {
  await page.route(NAVER, (r) =>
    r.fulfill(
      script('window.navermap_authFailure && window.navermap_authFailure();'),
    ),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText(AUTH);
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
  await expectNoMapLabels(page);
});

test('search input stays usable while the map failed', async ({ page }) => {
  await page.route(NAVER, (r) => r.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText(NETWORK);
  const field = page.getByRole('combobox', { name: '지역 검색' });
  await field.click();
  await expect(field).toBeVisible();
  await field.fill('강남');
  await expect(field).toHaveValue('강남');
});
