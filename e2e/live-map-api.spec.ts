import { expect, test } from '@playwright/test';
import {
  cityRecord,
  zoneRecord,
  pinRecord,
  detailRecord,
  searchRecord,
} from '../src/features/map-exploration/api/test-data';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/map/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const body = path.endsWith('/cities')
      ? [cityRecord]
      : path.endsWith('/zones')
        ? [zoneRecord]
        : path.endsWith('/complexes')
          ? [pinRecord]
          : path.endsWith('/search')
            ? url.searchParams.get('q') === '없는검색'
              ? { cities: [], zones: [], complexes: [] }
              : searchRecord
            : detailRecord;
    await route.fulfill({ json: body });
  });
});

test('existing map uses server search, real detail and list selection on desktop and mobile', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '구 예시구', exact: true }),
  ).toBeVisible();
  const field = page.getByRole('combobox', { name: '지역 검색' });
  await field.fill('예시');
  await page
    .getByRole('option', { name: '예시권역 예시구', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '예시권역', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('초기 급지', { exact: true })).toBeVisible();
  const row = page.getByRole('button', {
    name: '목록 단지 예시단지',
    exact: true,
  });
  if (isMobile && !(await row.isVisible())) {
    await page
      .getByRole('button', { name: '상세 펼치기', exact: true })
      .click();
  }
  await row.click();
  await expect(
    page.getByRole('button', { name: '지도 단지 예시단지', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-selected-polygon]')).toHaveAttribute(
    'fill-rule',
    'evenodd',
  );
  await expect(
    page.getByRole('button', { name: '이 권역 단지 비교하기' }),
  ).toBeDisabled();
  // A server apartment result has only a zoneId reference, not a complete Zone.
  await field.fill('예시단지');
  await page
    .getByRole('option', { name: '예시단지 예시구 예시권역', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '지도 단지 예시단지', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('heading', { name: '예시권역', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await field.fill('a'.repeat(81));
  await expect(field).toHaveValue('a'.repeat(80));
  await field.fill('없는검색');
  await expect(
    page.getByText("'없는검색'에 맞는 권역 · 구 · 단지가 없습니다"),
  ).toBeVisible();
});

test('missing initial tier keeps a neutral detail card instead of the first tier gradient', async ({
  page,
}) => {
  await page.route('**/api/v1/map/search?*', (route) =>
    route.fulfill({
      json: {
        cities: [],
        complexes: [],
        zones: [{ ...zoneRecord, initialTier: null, initialRank: null }],
      },
    }),
  );
  await page.route('**/api/v1/map/zones/zone-a', (route) =>
    route.fulfill({
      json: {
        ...detailRecord,
        zone: { ...zoneRecord, initialTier: null, initialRank: null },
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('combobox', { name: '지역 검색' }).fill('예시권역');
  await page.getByRole('option').first().click();
  const card = page.locator('.ui-grade-card');
  await expect(card.getByText('정보 없음', { exact: true })).toBeVisible();
  const colors = await card.evaluate((node) => {
    const probe = document.createElement('div');
    probe.style.background = 'var(--map-grade-1)';
    document.body.append(probe);
    const firstTierColor = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return {
      firstTierColor,
      gradient: getComputedStyle(node, '::before').backgroundImage,
    };
  });
  expect(colors.gradient).not.toContain(colors.firstTierColor);
});

test('initial API failure offers retry and does not silently show fixture cities', async ({
  page,
}) => {
  await page.route('**/api/v1/map/cities', (route) =>
    route.fulfill({
      status: 503,
      json: { code: 'UNAVAILABLE', message: 'internal' },
    }),
  );
  await page.goto('/map-exploration');
  await expect(
    page.getByText('지도 데이터를 불러오지 못했어요.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '구 강남구', exact: true }),
  ).toHaveCount(0);
  await page.route('**/api/v1/map/cities', (route) =>
    route.fulfill({ json: [cityRecord] }),
  );
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(
    page.getByRole('button', { name: '구 예시구', exact: true }),
  ).toBeVisible();
});
