import { expect, test } from '@playwright/test';
import { startWorldcupServer } from './helpers/worldcup-server';
test.use({ ignoreHTTPSErrors: true });
test('HTTPS cookie is HttpOnly, Secure and reused for voting and reload resume', async ({
  page,
  isMobile,
}) => {
  const server = await startWorldcupServer();
  try {
    await page.goto(server.url);
    const open = async () => {
      await page.getByRole('button', { name: '월드컵', exact: true }).click();
      if (!isMobile)
        await page
          .getByRole('button', { name: '월드컵 시작', exact: true })
          .click();
      const intro = page.getByRole('button', { name: '시작하기', exact: true });
      if (await intro.isVisible()) await intro.click();
      await expect(
        page.getByRole('button', { name: '왼쪽단지 선택', exact: true }),
      ).toBeEnabled();
    };
    await open();
    const cookies = await page.context().cookies(server.url);
    expect(cookies.find((c) => c.name === 'gjd_uid')).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    });
    expect(await page.evaluate(() => document.cookie)).not.toContain('gjd_uid');
    await page
      .getByRole('button', { name: '왼쪽단지 선택', exact: true })
      .click();
    await expect(page.getByText('오늘 일반 월드컵 1 / 60판')).toBeVisible();
    await page.reload();
    await open();
    await expect(page.getByText('아직 담긴 선택이 없어요')).toBeVisible();
    await page
      .getByRole('button', { name: '왼쪽단지 선택', exact: true })
      .click();
    await expect(page.getByText('오늘 일반 월드컵 2 / 60판')).toBeVisible();
    expect(server.stats().votes).toBe(2);
    expect(server.stats().cookieReads).toBeGreaterThan(0);
  } finally {
    await page.goto('about:blank');
    await server.close();
  }
});
