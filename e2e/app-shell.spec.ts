import { expect, test } from '@playwright/test';

test('shell panels, focus and search work without API or map keys', async ({
  page,
  isMobile,
}) => {
  // Reference size only; device defaults (e.g. WebKit 664px tall) remain in other scenarios.
  if (isMobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app-shell');
  await expect(
    page.getByText('검토용 화면 · 실제 지도와 데이터가 아닙니다.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /랭킹/ })).toBeDisabled();
  await page.getByRole('button', { name: '검토 상세 열기' }).click();
  await expect(page.getByRole('region', { name: '검토용 권역' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '권역 상세 닫기' }),
  ).toBeFocused();
  if (isMobile) {
    await expect(page.locator('.shell-fixture-stage')).toBeHidden();
    await expect(
      page.getByRole('button', { name: '이 권역 단지 비교하기' }),
    ).toBeVisible();
    await page.getByRole('button', { name: '상세 펼치기' }).tap();
    await expect(
      page.getByRole('button', { name: '상세 접기' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      await page
        .locator('.shell-detail-summary')
        .evaluate((element) => element.scrollHeight <= element.clientHeight),
    ).toBe(true);
  } else {
    await page.getByRole('button', { name: '월드컵', exact: true }).click();
    await page.getByRole('button', { name: '패널 접기' }).click();
    await expect(
      page.getByRole('region', { name: '월드컵 타임라인 패널' }),
    ).toBeHidden();
    await page.getByRole('button', { name: '패널 펼치기' }).press('Enter');
    await expect(
      page.getByRole('region', { name: '월드컵 타임라인 패널' }),
    ).toBeVisible();
  }
  await page.getByRole('button', { name: '권역 상세 닫기' }).click();
  await expect(
    page.getByRole('button', { name: '검토 상세 열기' }),
  ).toBeFocused();
  await page.getByRole('searchbox', { name: '지역 검색' }).fill('한글 검색');
  if (isMobile) {
    await expect(page.getByRole('dialog', { name: '지역 검색' })).toBeVisible();
    await page.getByRole('button', { name: '검색 닫기' }).click();
    await expect(page.getByRole('searchbox')).toBeFocused();
    await expect(page.getByRole('searchbox')).toHaveValue('한글 검색');
  }
  await page.getByRole('button', { name: '검색어 지우기' }).click();
  await expect(page.getByRole('searchbox')).toBeFocused();
  await expect(
    page.getByRole('button', { name: '지도 전체 보기' }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('desktop geometry follows panel and detail state at 1920', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Desktop geometry is checked on desktop project.');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/app-shell');
  const search = page.getByRole('searchbox');
  const searchBox = page.locator('.ui-search-field');
  expect((await searchBox.boundingBox())?.x).toBe(80);
  await page.getByRole('button', { name: '월드컵', exact: true }).click();
  expect(
    (
      await page
        .getByRole('region', { name: '월드컵 타임라인 패널' })
        .boundingBox()
    )?.width,
  ).toBe(390);
  expect((await searchBox.boundingBox())?.x).toBe(470);
  await page.getByRole('button', { name: '검토 상세 열기' }).click();
  const detail = page.getByRole('region', { name: '검토용 권역' });
  expect(await detail.boundingBox()).toMatchObject({
    x: 476,
    y: 16,
    width: 360,
    height: 1048,
  });
  expect(await searchBox.boundingBox()).toMatchObject({
    x: 844,
    y: 16,
    width: 340,
    height: 44,
  });
  await page.getByRole('button', { name: '패널 접기' }).click();
  expect((await detail.boundingBox())?.x).toBe(76);
  expect((await searchBox.boundingBox())?.x).toBe(444);
  await search.fill('검토');
  await page.getByRole('button', { name: '구', exact: true }).click();
  await expect(detail).toBeHidden();
  expect((await searchBox.boundingBox())?.x).toBe(80);
});

test('lists scroll independently and retain their headers', async ({
  page,
  isMobile,
}) => {
  if (!isMobile) await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/app-shell');
  await page.getByRole('button', { name: '검토 상세 열기' }).click();
  if (isMobile) await page.getByRole('button', { name: '상세 펼치기' }).tap();
  else await page.getByRole('button', { name: '월드컵', exact: true }).click();
  const detailList = page.getByLabel('권역 단지 목록', { exact: true });
  const titleBefore = await page
    .getByRole('heading', { name: '권역 안 단지 순위' })
    .boundingBox();
  await detailList.focus();
  await detailList.press('End');
  await expect
    .poll(() => detailList.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  expect(
    await page
      .getByRole('heading', { name: '권역 안 단지 순위' })
      .boundingBox(),
  ).toEqual(titleBefore);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  if (!isMobile) {
    const timeline = page.getByLabel('타임라인 목록', { exact: true });
    expect(await timeline.evaluate((element) => element.scrollTop)).toBe(0);
    await timeline.hover();
    await page.mouse.wheel(0, 900);
    await expect
      .poll(() => timeline.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
  }
});

test('review layouts handle long text, short heights and widths without clipping close controls', async ({
  page,
}) => {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 800, height: 600 },
    { width: 320, height: 568 },
    { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/app-shell');
    await page.getByRole('button', { name: '긴 문구 검토' }).click();
    if (size.width >= 768)
      await page.getByRole('button', { name: '월드컵', exact: true }).click();
    await page.getByRole('button', { name: '검토 상세 열기' }).click();
    const close = page.getByRole('button', { name: '권역 상세 닫기' });
    const rect = await close.boundingBox();
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(size.width);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(size.height);
    await close.click();
    await expect(
      page.getByRole('button', { name: '검토 상세 열기' }),
    ).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test('mobile search traps focus, preserves IME Escape and restores its field', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Full screen search is a mobile review policy.');
  await page.goto('/app-shell');
  const input = page.getByRole('searchbox');
  await input.tap();
  const dialog = page.getByRole('dialog', { name: '지역 검색' });
  await expect(dialog).toBeVisible();
  await input.fill('입력 유지');
  await input.dispatchEvent('keydown', { key: 'Escape', isComposing: true });
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: '검색 닫기' }).focus();
  await page.keyboard.press('Tab');
  await expect(input).toBeFocused();
  await input.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('입력 유지');
  // Reopening an already focused input must also work by touch.
  await input.tap();
  await expect(dialog).toBeVisible();
});

test('layout changes preserve usable focus and leave mobile search mode behind', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Resize continuity is checked in desktop Chromium.');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/app-shell');
  await page.getByRole('button', { name: '월드컵', exact: true }).click();
  await page.getByLabel('타임라인 목록', { exact: true }).focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('button', { name: '지도', exact: true }),
  ).toBeFocused();
  await page.getByRole('searchbox').click();
  await expect(page.getByRole('dialog', { name: '지역 검색' })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByRole('dialog', { name: '지역 검색' })).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('dialog', { name: '지역 검색' })).toBeHidden();
});

test('responsive transitions rescue focus from removed mobile controls', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Resize focus continuity uses desktop Chromium.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app-shell');
  await page.getByRole('button', { name: '검토 상세 열기' }).click();
  await page.getByRole('button', { name: '상세 펼치기' }).focus();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(
    page.getByRole('button', { name: '권역 상세 닫기' }),
  ).toBeFocused();
  await page.getByLabel('권역 단지 목록', { exact: true }).focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('button', { name: '권역 상세 닫기' }),
  ).toBeFocused();
  await page.getByRole('searchbox').click();
  await page.getByRole('button', { name: '검색 닫기' }).focus();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByRole('searchbox')).toBeFocused();
});

test('narrow desktop search inside a detail does not obscure the remaining map frame', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Narrow desktop map frame is a desktop scenario.');
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto('/app-shell');
  await page.getByRole('button', { name: '검토 상세 열기' }).click();
  const frame = page.locator('.shell-map-placeholder');
  expect((await frame.boundingBox())!.height).toBe(600);
});

test('touch sheet gestures stay separate from list scrolling and keyboard activation', async ({
  page,
  isMobile,
  browserName,
}) => {
  test.skip(
    !isMobile || browserName !== 'chromium',
    'Trusted touch swipe uses Chromium CDP; WebKit checks tap and keyboard in other scenarios.',
  );
  await page.goto('/app-shell');
  await page.getByRole('button', { name: '검토 상세 열기' }).tap();
  const handle = page.getByRole('button', { name: '상세 펼치기' });
  const rect = (await handle.boundingBox())!;
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + 22 }],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y - 90 }],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.getByRole('button', { name: '상세 접기' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  // A drag without a generated click must not swallow the following tap.
  await page.getByRole('button', { name: '상세 접기' }).tap();
  await expect(
    page.getByRole('button', { name: '상세 펼치기' }),
  ).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: '상세 펼치기' }).press('Enter');
  const list = page.getByLabel('권역 단지 목록', { exact: true });
  const listRect = (await list.boundingBox())!;
  const x = listRect.x + 80;
  const y = listRect.y + Math.min(listRect.height - 12, 150);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (const delta of [30, 60, 100])
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - delta }],
    });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect
    .poll(() => list.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: '상세 접기' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await client.detach();
});

test('text enlargement keeps navigation, search and close reachable', async ({
  page,
  isMobile,
}) => {
  await page.goto('/app-shell');
  await page.getByRole('button', { name: '검토 상세 열기' }).click();
  await page.evaluate(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(
        'h1, h2, h3, p, button span, .shell-level-toggle button, input',
      ),
    );
    const styles = elements.map((element) => ({
      element,
      size: parseFloat(getComputedStyle(element).fontSize),
      line: parseFloat(getComputedStyle(element).lineHeight),
    }));
    for (const { element, size, line } of styles) {
      element.style.fontSize = `${size * 2}px`;
      element.style.lineHeight = `${line * 2}px`;
    }
  });
  const close = page.getByRole('button', { name: '권역 상세 닫기' });
  if (isMobile) {
    const rect = await close.boundingBox();
    expect(rect!.width).toBeGreaterThanOrEqual(44);
    expect(rect!.height).toBeGreaterThanOrEqual(44);
  }
  await close.press('Enter');
  await expect(
    page.getByRole('button', { name: '검토 상세 열기' }),
  ).toBeFocused();
  await page.getByRole('searchbox').focus();
  await expect(page.locator('.ui-search-field')).toHaveCSS(
    'outline-style',
    'solid',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('map frame excludes search overlays and map controls', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Adapter geometry is inspected on desktop.');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/app-shell');
  await page.getByRole('button', { name: '검토 상세 열기' }).click();
  await page.getByRole('searchbox').fill('검토');
  const frame = (await page.locator('.shell-map-placeholder').boundingBox())!;
  const result = (await page.getByLabel('검색 콘텐츠').boundingBox())!;
  const controls = (await page
    .getByLabel('지도 조작', { exact: true })
    .boundingBox())!;
  expect(frame.y).toBeGreaterThanOrEqual(result.y + result.height);
  expect(frame.x + frame.width).toBeLessThanOrEqual(controls.x);
});

test('mobile search fills a shortened viewport with a compact input row', async ({
  page,
  isMobile,
}) => {
  test.skip(
    !isMobile,
    'Short viewport full-screen search is a mobile scenario.',
  );
  await page.goto('/app-shell');
  await page.getByRole('button', { name: '검토 상세 열기' }).click();
  await page.getByRole('searchbox').tap();
  await page.setViewportSize({ width: 390, height: 460 });
  const dialog = page.getByRole('dialog', { name: '지역 검색' });
  await expect.poll(async () => (await dialog.boundingBox())!.y).toBe(0);
  expect(await dialog.boundingBox()).toMatchObject({
    x: 0,
    y: 0,
    width: 390,
    height: 460,
  });
  expect(
    (await page.locator('.shell-search-input-row').boundingBox())!.height,
  ).toBeLessThanOrEqual(60);
  await page.getByRole('button', { name: '검색 닫기' }).tap();
  await expect(page.getByRole('searchbox')).toBeFocused();
});
