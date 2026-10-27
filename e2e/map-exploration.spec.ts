import { expect, test, type Page } from '@playwright/test';

const map = (page: Page) => page.getByRole('region', { name: '검토용 지도' });
async function camera(page: Page) {
  return map(page).evaluate((node) => ({
    lat: node.getAttribute('data-center-lat'),
    lng: node.getAttribute('data-center-lng'),
    zoom: Number(node.getAttribute('data-zoom')),
  }));
}
async function zoneView(page: Page) {
  // The unselected zone level centers on the overview, which now spans Seoul plus Gyeonggi/Incheon
  // and no longer keeps 압구정 in view. Enter through the 강남구 and 청담 labels, switch to the zone
  // level around the selected 청담, then select and close 압구정 so it is a visible, unselected label.
  const gu = page.getByRole('button', { name: '구 강남구', exact: true });
  if (!(await gu.count())) {
    // Already at the zone level around 압구정 from an earlier call in the same test.
    await expect(
      page.getByRole('button', { name: '권역 압구정', exact: true }),
    ).toBeVisible();
    return;
  }
  await gu.click();
  await page.getByRole('button', { name: '권역 청담', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '청담', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '권역', exact: true }).click();
  await expect
    .poll(async () => Number(await map(page).getAttribute('data-zoom')))
    .toBeGreaterThanOrEqual(12.9);
  await page.getByRole('button', { name: '권역 압구정', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '압구정', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '권역 상세 닫기' }).click();
  await expect(
    page.getByRole('button', { name: '권역 압구정', exact: true }),
  ).toBeVisible();
}
/** The unselected zone level now centers on the overview, so center 압구정 by selecting it. */
async function selectApgujeong(page: Page) {
  await zoneView(page);
  await page.getByRole('button', { name: '권역 압구정', exact: true }).click();
  await centerInFrame(page, '권역 압구정');
}
/**
 * Reach 압구정 by taps only. On narrow screens the 강남구 fit keeps 압구정 off screen (or under the
 * search row), so go through the visible 청담 zone label, which brings 압구정 into view.
 */
async function tapApgujeongViaCheongdam(page: Page) {
  await page.getByRole('button', { name: '구 강남구', exact: true }).tap();
  await page.getByRole('button', { name: '권역 청담', exact: true }).tap();
  await expect(
    page.getByRole('heading', { name: '청담', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '권역 압구정', exact: true }).tap();
  await expect(
    page.getByRole('heading', { name: '압구정', exact: true }),
  ).toBeVisible();
}
/** Small viewports keep 압구정 outside the overview-centered zone view, so select it by search. */
async function selectApgujeongBySearch(page: Page) {
  const field = page.getByRole('combobox', { name: '지역 검색' });
  await field.fill('압구정');
  await field.press('Enter');
  await expect(
    page.getByRole('heading', { name: '압구정', exact: true }),
  ).toBeVisible();
}
async function centerInFrame(page: Page, target: string) {
  await expect
    .poll(async () => {
      const position = await page
        .getByRole('button', { name: target, exact: true })
        .evaluate((node) => ({
          x: parseFloat((node as HTMLElement).style.left),
          y: parseFloat((node as HTMLElement).style.top),
        }));
      const frame = JSON.parse(
        (await map(page).getAttribute('data-frame'))!,
      ) as { x: number; y: number; width: number; height: number };
      return Math.max(
        Math.abs(position.x - frame.x - frame.width / 2),
        Math.abs(position.y - frame.y - frame.height / 2),
      );
    })
    .toBeLessThan(1);
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
  // The list scrolls after the selection renders; poll instead of reading once.
  await expect
    .poll(() =>
      page.getByLabel('권역 단지 목록').evaluate((node) => node.scrollTop),
    )
    .toBeGreaterThan(0);
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
  await selectApgujeong(page);
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
  // Zoom while the detail frame keeps 압구정 centered, then close it so the pin opens the detail.
  await selectApgujeong(page);
  await map(page).focus();
  for (let i = 0; i < 2; i++) await page.keyboard.press('+');
  await page.getByRole('button', { name: '권역 상세 닫기' }).click();
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
  expect((await camera(page)).lng).not.toBe(before.lng);
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
  // Labels and pins are dense with the full data set, so double tap on an empty map spot. Wait
  // until the pinch animation settles, otherwise a label can move onto the chosen spot.
  let last = '';
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await camera(page));
        const settled = now === last;
        last = now;
        return settled;
      },
      { intervals: [300] },
    )
    .toBe(true);
  const spot = await page.evaluate(
    ({ left, top }) => {
      // Touch hit testing snaps to nearby buttons, so require a clear neighborhood, not one pixel.
      const clear = (x: number, y: number) =>
        [-32, 0, 32].every((dy) =>
          [-32, 0, 32].every((dx) => {
            const el = document.elementFromPoint(x + dx, y + dy);
            return (
              !!el?.closest('.exploration-map') &&
              !el.closest('button, [role="button"], input, a, svg')
            );
          }),
        );
      for (let sy = top; sy < top + 400; sy += 12)
        for (let sx = left; sx < left + 300; sx += 12)
          if (clear(sx, sy)) return { x: sx, y: sy };
      return undefined;
    },
    { left: rect.x + 45, top: y },
  );
  expect(spot).toBeDefined();
  // Queue both taps together so the 300ms double-tap window is not eaten by CDP round trips.
  await Promise.all([
    send('touchStart', [spot!]),
    send('touchEnd', []),
    send('touchStart', [spot!]),
    send('touchEnd', []),
  ]);
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

test('district clicks animate through intermediate zoom levels and reduced motion applies the target immediately', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const samples = await page.evaluate(async () => {
    const surface = document.querySelector<HTMLElement>('.exploration-map')!;
    const label = document.querySelector<HTMLButtonElement>(
      '[aria-label="구 강남구"]',
    )!;
    const zoom = () => Number(surface.dataset.zoom);
    const before = zoom();
    label.click();
    const immediate = zoom();
    const values: number[] = [];
    await new Promise<void>((resolve) => {
      const start = performance.now();
      const sample = (now: number) => {
        values.push(zoom());
        if (now - start < 400) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    return { before, immediate, values };
  });
  expect(samples.immediate).toBe(samples.before);
  const final = samples.values.at(-1)!;
  expect(final).toBeGreaterThanOrEqual(12.55);
  expect(final).toBeLessThanOrEqual(13.5);
  expect(
    samples.values.some((value) => value > samples.before && value < final),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '구', exact: true }).click();
  await page.getByRole('button', { name: '구 강남구', exact: true }).click();
  expect(
    Number(await map(page).getAttribute('data-zoom')),
  ).toBeGreaterThanOrEqual(12.55);
});

test('a marker removed during drag cannot leave pointer movement active', async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    'mouse drag lifecycle; touch cancellation is covered separately',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await zoneView(page);
  const label = page.getByRole('button', { name: '권역 압구정', exact: true }),
    box = (await label.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(20, 350, { steps: 15 });
  await expect(label).toHaveCount(0);
  await page.mouse.up();
  const released = await camera(page);
  await page.mouse.move(1100, 500, { steps: 3 });
  expect(await camera(page)).toEqual(released);
});

test('short mobile details retain a scrollable apartment list and fixed list heading', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'mobile sheet geometry');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 667, height: 375 });
  await selectApgujeongBySearch(page);
  await page.getByRole('button', { name: '상세 펼치기' }).tap();
  const list = page.getByLabel('권역 단지 목록');
  // Wait for the expanded sheet geometry to settle before scrolling the list.
  await list.evaluate(
    (node) =>
      new Promise<void>((resolve) => {
        let last = '';
        let stable = 0;
        const check = () => {
          const r = node.getBoundingClientRect();
          const now = `${r.top}|${r.height}|${node.scrollHeight}`;
          stable = now === last ? stable + 1 : 0;
          last = now;
          if (stable >= 5) resolve();
          else requestAnimationFrame(check);
        };
        check();
      }),
  );
  expect(
    await list.evaluate((node) => node.clientHeight),
  ).toBeGreaterThanOrEqual(65);
  await list.focus();
  await page.keyboard.press('End');
  await expect(
    page.getByRole('button', {
      name: '목록 단지 압구정 검토 단지 18',
      exact: true,
    }),
  ).toBeInViewport();
  await expect(
    page.getByRole('heading', { name: /권역 안 단지 순위/ }),
  ).toBeInViewport();
});

test('selected apartment summary is fully visible after collapsing a narrow mobile detail', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'mobile selected summary');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 568 });
  await tapApgujeongViaCheongdam(page);
  await page.getByRole('button', { name: '상세 펼치기' }).tap();
  await page
    .getByRole('button', { name: '목록 단지 압구정 검토 단지 1', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  const summary = page.getByRole('button', {
    name: '선택 단지 확대 압구정 검토 단지 1',
  });
  await expect(summary).toBeInViewport({ ratio: 1 });
  await expect(summary).toBeFocused();
  await summary.tap();
  await expect(map(page)).toHaveAttribute('data-zoom', '15');
});

test('mobile taps reach the 압구정 zone through 강남구 and 청담 labels and its detail sheet', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'mobile tap path');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await tapApgujeongViaCheongdam(page);
  await expect(page.getByRole('button', { name: '상세 펼치기' })).toBeVisible();
});
