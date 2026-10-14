import { expect, test, type Page } from '@playwright/test';
const field = (page: Page) => page.getByRole('combobox', { name: '지역 검색' });
const map = (page: Page) => page.getByRole('region', { name: '검토용 지도' });
async function centered(page: Page, name: string) {
  await expect
    .poll(async () => {
      const p = await page
        .getByRole('button', { name, exact: true })
        .evaluate((node) => ({
          x: parseFloat((node as HTMLElement).style.left),
          y: parseFloat((node as HTMLElement).style.top),
        }));
      const f = JSON.parse((await map(page).getAttribute('data-frame'))!) as {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      return Math.max(
        Math.abs(p.x - f.x - f.width / 2),
        Math.abs(p.y - f.y - f.height / 2),
      );
    })
    .toBeLessThan(1);
}
test.beforeEach(async ({ page }) => {
  await page.goto('/map-exploration');
});
test('group limits, highlighting, keyboard wrap and zone focus restoration', async ({
  page,
  isMobile,
}) => {
  await field(page).fill('압');
  const options = page.getByRole('option');
  await expect(options).toHaveCount(7);
  await expect(options.first().locator('strong')).toHaveText('압');
  await field(page).press('ArrowUp');
  await expect(options.last()).toHaveAttribute('aria-selected', 'true');
  await field(page).press('ArrowDown');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await field(page).press('Enter');
  await expect(field(page)).toHaveValue('압구정');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  if (isMobile)
    await expect(page.getByRole('dialog', { name: '지역 검색' })).toHaveCount(
      0,
    );
  await expect(
    page.getByRole('button', { name: '권역 상세 닫기' }),
  ).toBeFocused();
  await centered(page, '권역 압구정');
  await page.getByRole('button', { name: '권역 상세 닫기' }).click();
  await expect(field(page)).toBeFocused();
});
test('no results, whitespace, clear, IME and two-stage Escape', async ({
  page,
  isMobile,
}) => {
  await field(page).fill('없는 이름');
  await expect(page.getByRole('status')).toHaveText(
    "'없는 이름'에 맞는 권역 · 구 · 단지가 없습니다",
  );
  await field(page).press('Escape');
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveAttribute('aria-expanded', 'false');
  if (isMobile)
    await expect(page.getByRole('dialog', { name: '지역 검색' })).toBeVisible();
  await field(page).press('Escape');
  if (isMobile) {
    await expect(page.getByRole('dialog', { name: '지역 검색' })).toHaveCount(
      0,
    );
    await expect(field(page)).toBeFocused();
  } else await expect(field(page)).not.toBeFocused();
  await expect(field(page)).toHaveValue('없는 이름');
  await field(page).click();
  await page.getByRole('button', { name: '검색어 지우기' }).click();
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveValue('');
  await field(page).fill('   ');
  await expect(page.locator('.shell-search-results')).toHaveCount(0);
  await field(page).dispatchEvent('compositionstart');
  await field(page).fill('청담');
  await expect(
    page.getByRole('option', { name: '청담 강남구', exact: true }),
  ).toBeVisible();
  await field(page).dispatchEvent('keydown', {
    key: 'Escape',
    isComposing: false,
    keyCode: 27,
  });
  if (isMobile)
    await expect(page.getByRole('dialog', { name: '지역 검색' })).toBeVisible();
  await expect(field(page)).toHaveAttribute('aria-expanded', 'true');
  await field(page).dispatchEvent('keydown', {
    key: 'Enter',
    isComposing: true,
    keyCode: 229,
  });
  await expect(
    page.getByRole('heading', { name: '청담', exact: true }),
  ).toHaveCount(0);
  await field(page).dispatchEvent('compositionend');
  await field(page).press('ArrowDown');
  await field(page).press('Enter');
  await expect(
    page.getByRole('heading', { name: '청담', exact: true }),
  ).toBeVisible();
});
test('district fit and apartment outside viewport use the authoritative selection and unobscured frame', async ({
  page,
  isMobile,
}) => {
  await field(page).fill('성동구');
  await page
    .getByRole('option', { name: '성동구 권역 1곳', exact: true })
    .click();
  await expect
    .poll(async () => Number(await map(page).getAttribute('data-zoom')))
    .toBeGreaterThanOrEqual(12.55);
  expect(Number(await map(page).getAttribute('data-zoom'))).toBeLessThanOrEqual(
    13.5,
  );
  // Move far enough that the apartment is not in the map's viewport response.
  await map(page).focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowLeft');
  await expect(
    page.getByRole('button', { name: '지도 단지 청담 검토 단지', exact: true }),
  ).toHaveCount(0);
  await field(page).fill('청담 검토');
  const option = page.getByRole('option', {
    name: '청담 검토 단지 강남구 청담',
    exact: true,
  });
  if (isMobile) await option.tap();
  else await option.click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  if (isMobile) {
    await expect(page.getByRole('dialog', { name: '지역 검색' })).toHaveCount(
      0,
    );
    await page.getByRole('button', { name: '상세 펼치기' }).tap();
  }
  await expect(
    page.getByRole('button', { name: '목록 단지 청담 검토 단지', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: '지도 단지 청담 검토 단지', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(map(page)).toHaveAttribute('data-zoom', '15');
  await centered(page, '지도 단지 청담 검토 단지');
  await page.getByRole('button', { name: '권역 상세 닫기' }).click();
  await expect(field(page)).toBeFocused();
});
test('short mobile search scrolls results without selecting and keeps clear and close accessible', async ({
  page,
  isMobile,
  browserName,
}) => {
  test.skip(!isMobile, 'Full-screen search is mobile-only');
  await page.setViewportSize({ width: 390, height: 320 });
  await field(page).tap();
  await field(page).fill('압');
  await expect(page.getByRole('option')).toHaveCount(7);
  const results = page.locator('.shell-search-results');
  expect(
    await results.evaluate((node) => node.scrollHeight > node.clientHeight),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/search-mobile-${browserName}.png`,
  });
  await expect(field(page)).toBeInViewport();
  await expect(
    page.getByRole('button', { name: '검색 닫기' }),
  ).toBeInViewport();
  if (browserName === 'chromium') {
    const session = await page.context().newCDPSession(page),
      box = (await results.boundingBox())!;
    const x = box.x + box.width / 2,
      y = box.y + box.height - 15;
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    for (const delta of [20, 40, 60])
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - delta }],
      });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await expect
      .poll(() => results.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0);
    await expect(
      page.getByRole('heading', { name: '압구정', exact: true }),
    ).toHaveCount(0);
    await session.detach();
  } else
    await results.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
  await field(page).press('ArrowUp');
  await expect(page.getByRole('option').last()).toBeInViewport();
  await page.getByRole('button', { name: '검색어 지우기' }).tap();
  await expect(field(page)).toBeFocused();
  await page.getByRole('button', { name: '검색 닫기' }).tap();
  await expect(page.getByRole('dialog', { name: '지역 검색' })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('desktop result geometry and original assets match Figma search slots', async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    'Desktop Figma geometry; mobile uses supported adaptive layout',
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await field(page).fill('청담');
  await expect(page.getByRole('option')).toHaveCount(2);
  const input = (await page.locator('.ui-search-field').boundingBox())!,
    results = (await page.locator('.shell-search-results').boundingBox())!;
  expect(input.width).toBe(340);
  expect(input.height).toBe(44);
  expect(results.width).toBe(340);
  expect(results.y - input.y - input.height).toBe(8);
  expect(
    (await page.locator('.search-group-title').first().boundingBox())!.height,
  ).toBe(32);
  expect((await page.getByRole('option').first().boundingBox())!.height).toBe(
    40,
  );
  const icon = page.locator('.search-apartment-icon img');
  expect(
    await icon.evaluate(
      (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
    ),
  ).toBe(true);
  await expect(page.locator('.search-apartment-icon img')).toHaveCSS(
    'width',
    '16px',
  );
  await page.screenshot({ path: 'test-results/search-desktop.png' });
  await field(page).fill('부산');
  await expect(page.getByRole('status')).toHaveText(
    "'부산'에 맞는 권역 · 구 · 단지가 없습니다",
  );
  await page.screenshot({ path: 'test-results/search-empty-desktop.png' });
});

for (const action of ['type', 'arrow'] as const) {
  test(`mobile search reopens on ${action} after close and district selection`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Full-screen re-entry is mobile-only');
    await field(page).fill('청담');
    await expect(page.getByRole('option')).toHaveCount(2);
    await page.getByRole('button', { name: '검색 닫기' }).tap();
    await expect(field(page)).toBeFocused();
    await field(page).press(action === 'type' ? 'Backspace' : 'ArrowDown');
    await expect(page.getByRole('dialog', { name: '지역 검색' })).toBeVisible();
    await expect(page.getByRole('listbox')).toBeVisible();
    await field(page).fill('성동구');
    await page
      .getByRole('option', { name: '성동구 권역 1곳', exact: true })
      .tap();
    await expect(page.getByRole('dialog', { name: '지역 검색' })).toHaveCount(
      0,
    );
    await expect(field(page)).toBeFocused();
    await field(page).press(action === 'type' ? 'Backspace' : 'ArrowDown');
    await expect(page.getByRole('dialog', { name: '지역 검색' })).toBeVisible();
    await expect(page.getByRole('listbox')).toBeVisible();
    await field(page).fill('압구정');
    await page
      .getByRole('option', { name: '압구정 강남구', exact: true })
      .tap();
    await expect(
      page.getByRole('heading', { name: '압구정', exact: true }),
    ).toBeVisible();
    await field(page).tap();
    await expect(
      page.getByRole('option', { name: '압구정 강남구', exact: true }),
    ).toBeVisible();
    await field(page).press('Enter');
    await expect(page.getByRole('dialog', { name: '지역 검색' })).toHaveCount(
      0,
    );
    await expect(field(page)).toBeFocused();
    await field(page).press(action === 'type' ? 'Backspace' : 'ArrowDown');
    await expect(page.getByRole('dialog', { name: '지역 검색' })).toBeVisible();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('button', { name: '검색 닫기' }).tap();
    await page.getByRole('button', { name: '권역 상세 닫기' }).tap();
    await expect(field(page)).toBeFocused();
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(field(page)).toHaveAttribute('aria-expanded', 'false');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('dialog', { name: '지역 검색' })).toHaveCount(
      0,
    );
    await expect(field(page)).toHaveAttribute('aria-expanded', 'false');
    await field(page).press(action === 'type' ? 'Backspace' : 'ArrowDown');
    await expect(page.getByRole('dialog', { name: '지역 검색' })).toBeVisible();
    await expect(page.getByRole('listbox')).toBeVisible();
  });
}
