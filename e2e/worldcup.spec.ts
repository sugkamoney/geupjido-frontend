import { expect, test, type Page } from '@playwright/test';
async function open(page: Page, isMobile: boolean, scenario = 'mixed') {
  await page.goto(`/worldcup?scenario=${scenario}`);
  await page.getByRole('button', { name: '월드컵', exact: true }).click();
  if (!isMobile)
    await page
      .getByRole('button', { name: '월드컵 시작', exact: true })
      .click();
  const start = page.getByRole('button', { name: '시작하기', exact: true });
  if (await start.count()) await start.click();
  await expect(page.locator('.worldcup-card')).toHaveCount(2);
}
test('entry, hidden grades, whole card choice, skip, own timeline and focus restoration', async ({
  page,
  isMobile,
}) => {
  await open(page, isMobile);
  const dialog = page.getByRole('dialog', { name: '어디 살고 싶으세요?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[aria-label^="민심급지"]')).toHaveCount(0);
  if (isMobile) await dialog.locator('.worldcup-card').first().tap();
  else await dialog.locator('.worldcup-card').first().click();
  await expect(dialog.getByText('1개의 선택이 담겼어요')).toBeVisible();
  await expect(dialog.locator('.worldcup-card[data-picked=true]')).toHaveCount(
    1,
  );
  await expect(dialog.locator('[aria-label^="민심급지"]')).toHaveCount(2);
  await expect(dialog.getByText('53%', { exact: true })).toBeVisible();
  await expect(dialog.locator('.worldcup-card[data-dimmed=true]')).toHaveCount(
    1,
  );
  await expect(
    dialog.getByRole('button', { name: '잘 모르겠어요' }),
  ).toBeEnabled();
  await dialog.getByRole('button', { name: '잘 모르겠어요' }).click();
  await expect(dialog.getByText('넘긴 판은 담기지 않아요')).toBeVisible();
  await expect(dialog.locator('.worldcup-card[data-dimmed=true]')).toHaveCount(
    0,
  );
  await expect(dialog.getByText('1개의 선택이 담겼어요')).toBeVisible();
  await dialog.getByRole('button', { name: '월드컵 닫기' }).click();
  await expect(
    page.getByRole('button', {
      name: isMobile ? '월드컵' : '월드컵 시작',
      exact: true,
    }),
  ).toBeFocused();
  if (!isMobile) {
    await expect(page.getByText('나', { exact: true })).toBeVisible();
    await page.locator('.worldcup-timeline-cell').first().click();
    await expect(
      page.getByRole('heading', { name: '압구정', exact: true }),
    ).toBeVisible();
  }
});
test('first explanation once even after close without starting and from zone detail', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: '지역 검색' }).fill('압구정');
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: '이 권역 단지 비교하기' }).click();
  await expect(page.getByRole('dialog')).toContainText(
    '더 살고 싶은 곳을 고르세요',
  );
  await expect(page.locator('.worldcup-picks')).toHaveCount(0);
  await page.getByRole('button', { name: '월드컵 닫기' }).click();
  await expect(
    page.getByRole('button', { name: '이 권역 단지 비교하기' }),
  ).toBeFocused();
  await page.getByRole('button', { name: '이 권역 단지 비교하기' }).click();
  await expect(page.locator('.worldcup-card')).toHaveCount(2);
  await expect(page.locator('.worldcup-band strong')).toHaveText([
    '압구정',
    '압구정',
  ]);
  await page.getByRole('button', { name: '월드컵 닫기' }).click();
  await page.reload();
  await page.getByRole('button', { name: '월드컵', exact: true }).click();
  if (!isMobile)
    await page
      .getByRole('button', { name: '월드컵 시작', exact: true })
      .click();
  await expect(
    page.getByRole('button', { name: '시작하기', exact: true }),
  ).toHaveCount(0);
});
test('pending close/reopen cancels old success and failure retry commits once', async ({
  page,
  isMobile,
}) => {
  await open(page, isMobile, 'pending');
  await page.locator('.worldcup-card button').first().click();
  await expect(page.getByText('선택을 보내고 있어요.')).toBeVisible();
  await page.getByRole('button', { name: '월드컵 닫기' }).click();
  await page
    .getByRole('button', {
      name: isMobile ? '월드컵' : '월드컵 시작',
      exact: true,
    })
    .click();
  await expect(page.getByText('아직 담긴 선택이 없어요')).toBeVisible();
  await page.waitForTimeout(5100);
  await expect(page.getByText('아직 담긴 선택이 없어요')).toBeVisible();
  await page.getByRole('button', { name: '월드컵 닫기' }).click();
  await open(page, isMobile, 'pending');
  await page.locator('.worldcup-card button').first().click();
  await expect(page.getByText('선택을 보내고 있어요.')).toBeVisible();
  const close = page.getByRole('button', { name: '월드컵 닫기' });
  await close.focus();
  await expect(page.getByText('1개의 선택이 담겼어요')).toBeVisible({
    timeout: 7000,
  });
  await expect(close).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await open(page, isMobile, 'failure');
  await page.locator('.worldcup-card button').first().click();
  await expect(page.getByRole('alert')).toContainText('선택을 보내지 못했어요');
  await expect(page.getByText('아직 담긴 선택이 없어요')).toBeVisible();
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('1개의 선택이 담겼어요')).toBeVisible();
});
test('keyboard focus trap, inert background, IME Escape, scroll lock and reduced motion', async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, isMobile, 'hidden');
  const dialog = page.getByRole('dialog');
  expect(await page.locator('body').evaluate((n) => n.style.overflow)).toBe(
    'hidden',
  );
  await page
    .locator('.shell-nav-item')
    .first()
    .evaluate((node) => node.focus());
  expect(
    await dialog.evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true);
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    expect(
      await dialog.evaluate((n) => n.contains(document.activeElement)),
    ).toBe(true);
  }
  await dialog.dispatchEvent('compositionstart');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.dispatchEvent('compositionend');
  await page.locator('.worldcup-card button').first().focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.getByText('1개의 선택이 담겼어요')).toBeVisible();
  await expect(dialog.locator('.worldcup-ratio')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '잘 모르겠어요' }),
  ).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await page.locator('body').evaluate((n) => n.style.overflow)).toBe('');
});
test('short narrow screen, long copy and touch keep close/skip reachable without horizontal overflow', async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize({
    width: isMobile ? 320 : 800,
    height: isMobile ? 460 : 600,
  });
  await open(page, isMobile, 'long');
  const dialog = page.getByRole('dialog');
  expect(await dialog.evaluate((n) => n.scrollWidth <= n.clientWidth)).toBe(
    true,
  );
  await page
    .getByRole('button', { name: '잘 모르겠어요' })
    .scrollIntoViewIfNeeded();
  if (isMobile) await page.getByRole('button', { name: '잘 모르겠어요' }).tap();
  else await page.getByRole('button', { name: '잘 모르겠어요' }).click();
  await expect(page.getByText('넘긴 판은 담기지 않아요')).toBeAttached();
  await page.getByRole('button', { name: '월드컵 닫기' }).click();
  await expect(dialog).toHaveCount(0);
});
test('desktop centered window independent of picks and timeline scroll/filter/sparse policy', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, '타임라인은 desktop 전용');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, false);
  const box = await page.locator('.worldcup-window').boundingBox();
  expect(box!.width).toBe(600);
  expect(Math.abs(box!.x + box!.width / 2 - 960)).toBeLessThan(1);
  expect(Math.abs(box!.y + box!.height / 2 - 540)).toBeLessThan(1);
  await page.screenshot({ path: 'test-results/worldcup-desktop.png' });
  await page.getByRole('button', { name: '월드컵 닫기' }).click();
  const list = page.getByLabel('타임라인 목록', { exact: true });
  await list.evaluate((n) => {
    n.scrollTop = 180;
  });
  await page.locator('.worldcup-timeline-cell').nth(4).click();
  await expect(
    page.getByRole('heading', { name: '압구정', exact: true }),
  ).toBeVisible();
  expect(await list.evaluate((n) => n.scrollTop)).toBe(180);
  await page.locator('.worldcup-timeline-cell').nth(5).click();
  await expect(
    page.getByRole('heading', { name: '청담', exact: true }),
  ).toBeVisible();
  expect(await list.evaluate((n) => n.scrollTop)).toBe(180);
  await page.getByRole('button', { name: '청담 대진', exact: true }).click();
  expect(await list.evaluate((n) => n.scrollTop)).toBe(0);
  await page.goto('/worldcup?scenario=sparse');
  await page.getByRole('button', { name: '월드컵', exact: true }).click();
  await expect(page.getByText('월드컵 타임라인', { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: '월드컵 시작' })).toBeEnabled();
});
test('twenty-one choices continue with twenty filled cells and feedback resets after 2.4 seconds', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, '누적 경계는 desktop에서 검증, 모바일은 동일 상태 사용');
  await open(page, false, 'hidden');
  await page.clock.install();
  for (let i = 1; i <= 21; i++) {
    await page.locator('.worldcup-card button').first().click();
    await page.clock.runFor(140);
    await expect(
      page.getByText(`${i}개의 선택이 담겼어요`, { exact: true }),
    ).toBeVisible();
    await page.clock.runFor(660);
    await expect(
      page.getByRole('button', { name: '잘 모르겠어요' }),
    ).toBeEnabled();
  }
  await expect(page.locator('.worldcup-board [data-filled=true]')).toHaveCount(
    20,
  );
  await expect(page.locator('.worldcup-board b')).toHaveText('21개');
  await page.clock.runFor(1740);
  await expect(
    page.getByText('고른 곳은 계속 담겨요', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.worldcup-card')).toHaveCount(2);
  await page.getByRole('button', { name: '월드컵 닫기' }).click();
  await page.getByRole('button', { name: '월드컵 시작', exact: true }).click();
  await expect(page.getByText('21개의 선택이 담겼어요')).toBeVisible();
});
test('revealed choice keeps primary crown button and original illustration crop', async ({
  page,
  isMobile,
}) => {
  await page.goto('/worldcup');
  await page.getByRole('button', { name: '월드컵', exact: true }).click();
  if (!isMobile)
    await page
      .getByRole('button', { name: '월드컵 시작', exact: true })
      .click();
  const illustration = page.locator('.worldcup-explanation');
  const geometry = await illustration.evaluate((n) => ({
    width: n.clientWidth,
    height: n.clientHeight,
    imgWidth: n.querySelector('img')?.clientWidth ?? n.clientWidth,
  }));
  expect(geometry.width).toBe(220);
  expect(geometry.height).toBe(181);
  expect(geometry.imgWidth).toBeGreaterThan(500);
  await page.getByRole('button', { name: '시작하기', exact: true }).click();
  await page.locator('.worldcup-card button').first().click();
  const picked = page.locator('.worldcup-card[data-picked=true]');
  await expect(picked).toBeVisible();
  expect(
    await picked
      .locator('button')
      .evaluate((n) => getComputedStyle(n).backgroundColor),
  ).toBe('rgb(21, 120, 251)');
  await expect(picked.locator('.ui-crown')).toBeVisible();
  expect(
    await picked
      .locator('.ui-crown')
      .evaluate((n) => (n as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
});
test('blocked storage, reverse focus trap, responsive focus return and asset loading', async ({
  page,
  isMobile,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  await open(page, isMobile);
  const dialog = page.getByRole('dialog');
  const close = dialog.getByRole('button', { name: '월드컵 닫기' });
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(
    dialog.getByRole('button', { name: '잘 모르겠어요' }),
  ).toBeFocused();
  for (const img of await dialog.locator('img').all())
    expect(
      await img.evaluate(
        (n) =>
          (n as HTMLImageElement).complete &&
          (n as HTMLImageElement).naturalWidth > 0,
      ),
    ).toBe(true);
  await close.click();
  await page
    .getByRole('button', {
      name: isMobile ? '월드컵' : '월드컵 시작',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('button', { name: '시작하기', exact: true }),
  ).toHaveCount(0);
  if (!isMobile) {
    await page.setViewportSize({ width: 390, height: 460 });
    await page.getByRole('button', { name: '월드컵 닫기' }).click();
    await expect(
      page.getByRole('button', { name: '지도', exact: true }),
    ).toBeFocused();
  }
});
test('skip reveals both grades and neutral ratio chips; mobile layout stays stacked', async ({
  page,
  isMobile,
}, testInfo) => {
  await open(page, isMobile);
  await page.screenshot({ path: testInfo.outputPath('match.png') });
  if (isMobile) {
    const cards = page.locator('.worldcup-card');
    const a = await cards.nth(0).boundingBox(),
      b = await cards.nth(1).boundingBox();
    expect(b!.y).toBeGreaterThan(a!.y + a!.height);
  }
  await page.getByRole('button', { name: '잘 모르겠어요' }).click();
  await expect(page.locator('.worldcup-ratio')).toHaveCount(2);
  await expect(page.locator('.worldcup-card[data-dimmed=true]')).toHaveCount(0);
  expect(
    await page
      .locator('.worldcup-ratio')
      .first()
      .evaluate((n) => getComputedStyle(n).color),
  ).toBe('rgb(22, 24, 28)');
  await expect(page.getByText('아직 담긴 선택이 없어요')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('skipped.png') });
});
