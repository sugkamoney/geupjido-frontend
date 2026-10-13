import { expect, test } from '@playwright/test';

test('loads the production build without page errors or horizontal overflow', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: '급지도' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('serves a direct unknown route and allows returning home', async ({
  page,
}) => {
  await page.goto('/missing');
  await expect(
    page.getByRole('heading', { name: '페이지를 찾을 수 없어요' }),
  ).toBeVisible();
  await page.getByRole('link', { name: '홈으로 돌아가기' }).click();
  await expect(page).toHaveURL('/');
  await expect(
    page.getByRole('heading', { level: 1, name: '급지도' }),
  ).toBeVisible();
});
