import { expect, test, type Page } from '@playwright/test';

const map = (page: Page) => page.getByRole('region', { name: '검토용 지도' });
async function camera(page: Page) {
  return map(page).evaluate((node) => ({
    x: node.getAttribute('data-center-x'),
    y: node.getAttribute('data-center-y'),
    zoom: Number(node.getAttribute('data-zoom')),
  }));
}
async function zoneView(page: Page) {
  await page.getByRole('button', { name: '권역', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '권역 압구정', exact: true }),
  ).toBeVisible();
}
async function centerInFrame(page: Page, target: string) {
  const position = await page
    .getByRole('button', { name: target, exact: true })
    .evaluate((node) => ({
      x: parseFloat((node as HTMLElement).style.left),
      y: parseFloat((node as HTMLElement).style.top),
    }));
  const frame = JSON.parse((await map(page).getAttribute('data-frame'))!) as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  expect(Math.abs(position.x - (frame.x + frame.width / 2))).toBeLessThan(1);
  expect(Math.abs(position.y - (frame.y + frame.height / 2))).toBeLessThan(1);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/map-exploration');
});
test('zone, list and pin selection preserve their distinct camera and clear contracts', async ({
  page,
  isMobile,
}) => {
  await zoneView(page);
  await page.getByRole('button', { name: '권역 압구정', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '압구정', exact: true }),
  ).toBeVisible();
  await centerInFrame(page, '권역 압구정');
  if (isMobile) await page.getByRole('button', { name: '상세 펼치기' }).tap();
  await page
    .getByRole('button', { name: '목록 단지 압구정 검토 단지 1', exact: true })
    .click();
  await expect(map(page)).toHaveAttribute('data-zoom', '15');
  if (isMobile)
    await expect(
      page.getByRole('button', { name: '상세 펼치기' }),
    ).toBeVisible();
  await centerInFrame(page, '지도 단지 압구정 검토 단지 1');
  const before = await camera(page);
  await page
    .getByRole('button', { name: '지도 단지 압구정 검토 단지 6', exact: true })
    .click();
  expect(await camera(page)).toEqual(before);
  if (isMobile) await page.getByRole('button', { name: '상세 펼치기' }).tap();
  await expect(
    page.getByRole('button', {
      name: '목록 단지 압구정 검토 단지 6',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true');
  const scroll = await page
    .getByLabel('권역 단지 목록')
    .evaluate((node) => ({ top: node.scrollTop, height: node.clientHeight }));
  expect(scroll.top).toBeGreaterThan(0);
  await expect
    .poll(async () => {
      const row = await page
        .getByRole('button', {
          name: '목록 단지 압구정 검토 단지 6',
          exact: true,
        })
        .boundingBox();
      const list = await page.getByLabel('권역 단지 목록').boundingBox();
      return Math.abs(row!.y + row!.height / 2 - list!.y - list!.height / 2);
    })
    .toBeLessThan(2);
  await page.getByRole('button', { name: '권역 상세 닫기' }).click();
  await expect(
    page.getByRole('heading', { name: '압구정', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: '지도 단지 압구정 검토 단지 1',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '구', exact: true }).click();
  await expect(page.locator('[data-selected-polygon]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^지도 단지/ })).toHaveCount(0);
});

test('keyboard selection restores focus, zoom boundaries and low-zoom selection persist', async ({
  page,
}) => {
  await zoneView(page);
  const label = page.getByRole('button', { name: '권역 압구정', exact: true });
  await label.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: '권역 상세 닫기' }),
  ).toBeFocused();
  await page.getByRole('button', { name: '권역 상세 닫기' }).click();
  await expect(label).toBeFocused();
  await label.press('Enter');
  await map(page).focus();
  await page.keyboard.press('-');
  await expect(page.locator('[data-selected-polygon]')).toHaveCount(0);
  await expect(label).toHaveAttribute('aria-pressed', 'true');
  for (let i = 0; i < 15; i++) await page.keyboard.press('-');
  await expect(map(page)).toHaveAttribute('data-zoom', '9.5');
  await page.getByRole('button', { name: '권역 상세 닫기' }).click();
  await expect(
    page.getByRole('button', { name: '지도', exact: true }),
  ).toBeFocused();
  // Recenter the known fixture location after closing changes the frame.
  await zoneView(page);
  await map(page).focus();
  for (let i = 0; i < 15; i++) await page.keyboard.press('+');
  await expect(map(page)).toHaveAttribute('data-zoom', '17');
  await expect(
    page.getByRole('button', { name: /^지도 단지/ }),
  ).not.toHaveCount(0);
});

test('visible-area centering follows panel or sheet changes and stays within small screens', async ({
  page,
  isMobile,
}) => {
  if (!isMobile) await page.setViewportSize({ width: 1920, height: 1080 });
  await zoneView(page);
  await page.getByRole('button', { name: '권역 압구정', exact: true }).click();
  await centerInFrame(page, '권역 압구정');
  if (isMobile) await page.getByRole('button', { name: '상세 펼치기' }).tap();
  else await page.getByRole('button', { name: '패널 펼치기' }).click();
  await centerInFrame(page, '권역 압구정');
  await page.setViewportSize(
    isMobile ? { width: 320, height: 568 } : { width: 800, height: 600 },
  );
  await expect(
    page.getByRole('button', { name: '권역 상세 닫기' }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('desktop hover waits, swaps immediately and closes when camera moves', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'hover card is desktop-only');
  await zoneView(page);
  await page.getByRole('button', { name: '권역 압구정', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('압구정');
  await page.getByRole('button', { name: '권역 청담', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('청담');
  await map(page).focus();
  await page.keyboard.press('+');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});

test('a map pin opening detail leaves camera unchanged while list scrolling stays independent', async ({
  page,
  isMobile,
}) => {
  await zoneView(page);
  await map(page).focus();
  for (let i = 0; i < 2; i++) await page.keyboard.press('+');
  const before = await camera(page);
  await page
    .getByRole('button', { name: '지도 단지 압구정 검토 단지 2', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '압구정', exact: true }),
  ).toBeVisible();
  expect(await camera(page)).toEqual(before);
  if (isMobile) await page.getByRole('button', { name: '상세 펼치기' }).tap();
  const list = page.getByLabel('권역 단지 목록');
  await list.focus();
  await page.keyboard.press('End');
  expect(await camera(page)).toEqual(before);
  await page.getByRole('button', { name: '권역 상세 닫기' }).click();
  await expect(
    page.getByRole('button', {
      name: '지도 단지 압구정 검토 단지 2',
      exact: true,
    }),
  ).toBeFocused();
});

test('trusted mobile pan, pinch and double tap do not select overlays or scroll the sheet', async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(
    !isMobile || browserName !== 'chromium',
    'CDP touch stream is Chromium-only; WebKit uses tap/keyboard coverage',
  );
  await zoneView(page);
  await page.getByRole('button', { name: '권역 압구정', exact: true }).tap();
  const client = await page.context().newCDPSession(page);
  const send = (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    points: { x: number; y: number; id?: number }[],
  ) => client.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const rect = (await map(page).boundingBox())!;
  const x = rect.x + 100,
    y = rect.y + 220;
  const before = await camera(page);
  await send('touchStart', [{ x, y }]);
  await send('touchMove', [{ x: x + 45, y }]);
  await send('touchEnd', []);
  expect((await camera(page)).x).not.toBe(before.x);
  await expect(page.getByRole('button', { name: '상세 펼치기' })).toBeVisible();
  const zoom = Number(await map(page).getAttribute('data-zoom'));
  await send('touchStart', [
    { x: x - 30, y, id: 0 },
    { x: x + 30, y, id: 1 },
  ]);
  await send('touchMove', [
    { x: x - 60, y, id: 0 },
    { x: x + 60, y, id: 1 },
  ]);
  await send('touchEnd', []);
  await expect
    .poll(async () => Number(await map(page).getAttribute('data-zoom')))
    .toBeCloseTo(zoom + 1);
  const tapZoom = Number(await map(page).getAttribute('data-zoom'));
  await send('touchStart', [{ x: rect.x + 45, y }]);
  await send('touchEnd', []);
  await send('touchStart', [{ x: rect.x + 45, y }]);
  await send('touchEnd', []);
  await expect
    .poll(async () => Number(await map(page).getAttribute('data-zoom')))
    .toBeCloseTo(tapZoom + 1);
  await page.getByRole('button', { name: '상세 펼치기' }).tap();
  const list = page.getByLabel('권역 단지 목록'),
    bounds = (await list.boundingBox())!;
  const cameraBeforeScroll = await camera(page);
  const sx = bounds.x + bounds.width / 2,
    sy = bounds.y + bounds.height - 15;
  await send('touchStart', [{ x: sx, y: sy }]);
  for (const delta of [20, 40, 60])
    await send('touchMove', [{ x: sx, y: sy - delta }]);
  await send('touchEnd', []);
  await expect
    .poll(() => list.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  expect(await camera(page)).toEqual(cameraBeforeScroll);
  await client.detach();
});

test('initial camera matches whole-view fit in the current unobscured rectangle', async ({
  page,
}) => {
  await expect(
    page.getByRole('button', { name: '구', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const initial = await camera(page);
  await page.getByRole('button', { name: '전체 보기' }).click();
  expect(await camera(page)).toEqual(initial);
});

test('releasing a marker drag outside the map ends the gesture and allows later selection', async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    'desktop mouse pointer capture; mobile touch streams are covered separately',
  );
  await zoneView(page);
  await page.getByRole('button', { name: '권역 압구정', exact: true }).click();
  const label = page.getByRole('button', { name: '권역 압구정', exact: true }),
    box = (await label.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(200, 300, { steps: 4 });
  await page.mouse.up();
  const released = await camera(page);
  await page.mouse.move(1400, 600, { steps: 4 });
  expect(await camera(page)).toEqual(released);
  await page.getByRole('button', { name: '권역 상세 닫기' }).click();
  await zoneView(page);
  await page.getByRole('button', { name: '권역 압구정', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '압구정', exact: true }),
  ).toBeVisible();
});
