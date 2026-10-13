import { expect, test } from '@playwright/test';

test('catalogue controls work with keyboard and touch without API keys', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/design-system');
  await expect(
    page.getByRole('heading', { level: 1, name: '디자인 시스템' }),
  ).toBeVisible();
  const input = page.getByRole('searchbox', { name: '카탈로그 지역 검색' });
  await input.fill('강남');
  await page.getByRole('button', { name: '검색어 지우기' }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  const handle = page.getByRole('button', { name: '패널 접기' });
  // WebKit on macOS uses Option+Tab to include buttons in focus traversal.
  const nextControl =
    testInfo.project.name === 'mobile-webkit' ? 'Alt+Tab' : 'Tab';
  await page.keyboard.press(nextControl);
  await page.keyboard.press(nextControl);
  await expect(handle).toBeFocused();
  await expect(handle).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: '패널 펼치기' }),
  ).toHaveAttribute('aria-expanded', 'false');
  const zoomIn = page.getByRole('button', { name: '지도 확대' });
  if (testInfo.project.name.startsWith('mobile')) await zoomIn.tap();
  else await zoomIn.click();
  await expect(page.getByRole('status')).toHaveText('확대 1 · 패널 닫힘');
  const zoomOut = page.getByRole('button', { name: '지도 축소' });
  if (testInfo.project.name.startsWith('mobile')) await zoomOut.tap();
  else await zoomOut.click();
  await expect(page.getByRole('status')).toHaveText('확대 0 · 패널 닫힘');
  if (testInfo.project.name.startsWith('mobile')) {
    const box = await page
      .getByRole('button', { name: '패널 펼치기' })
      .boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await expect(input).toHaveCSS('font-size', '16px');
  }
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page
      .locator('img')
      .evaluateAll((images) =>
        images.every(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth > 0,
        ),
      ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('variants have original geometry, colours and real hover/pressed states', async ({
  page,
}, testInfo) => {
  await page.goto('/design-system');
  await page.evaluate(() => document.fonts.ready);
  const primary = page.getByRole('button', { name: '시작하기', exact: true });
  await expect(primary).toHaveCSS('background-color', 'rgb(21, 120, 251)');
  if (testInfo.project.name === 'desktop-chromium') {
    await expect(primary).toHaveCSS('height', '44px');
    await primary.hover();
    await expect(primary).toHaveCSS('background-color', 'rgb(3, 104, 210)');
    await page.mouse.down();
    await expect(primary).toHaveCSS('background-color', 'rgb(3, 85, 164)');
    await page.mouse.up();
    await expect(page.locator('.ui-search-field')).toHaveCSS('width', '340px');
    await expect(page.locator('.ui-grade-card').first()).toHaveCSS(
      'height',
      '104px',
    );
    await expect(page.locator('.ui-grade-stage').first()).toHaveCSS(
      'height',
      '75px',
    );
  }
  await expect(page.getByLabel('민심급지 2.3')).toHaveCSS(
    'color',
    'rgb(22, 24, 28)',
  );
  await expect(page.getByLabel('민심급지 1.3')).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  );
  await expect(
    page.getByRole('button', { name: '비활성 버튼' }),
  ).toBeDisabled();
  await expect(page.locator('.ui-button--gradient')).toHaveCSS(
    'background-image',
    /radial-gradient/,
  );
  await page.screenshot({
    path: testInfo.outputPath('catalogue.png'),
    fullPage: true,
  });
});

test('narrow layouts and zoomed text retain content and visible focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/design-system');
  await page.locator('.ui-button--outline > span').evaluate((label) => {
    label.textContent = '아주 긴 권역 이름의 모든 단지를 비교하는 공통 버튼';
  });
  await page.evaluate(() => {
    const text = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button span, .ui-grade-card > span, .ui-grade-stage p, .ui-grade-stage li > span[aria-current], input',
      ),
    );
    const styles = text.map((element) => ({
      element,
      size: getComputedStyle(element).fontSize,
      line: getComputedStyle(element).lineHeight,
    }));
    for (const { element, size, line } of styles) {
      element.style.fontSize = `${parseFloat(size) * 2}px`;
      element.style.lineHeight = `${parseFloat(line) * 2}px`;
    }
  });
  await expect(
    page.getByRole('button', {
      name: '아주 긴 권역 이름의 모든 단지를 비교하는 공통 버튼',
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const input = page.getByRole('searchbox');
  await input.focus();
  await expect(page.locator('.ui-search-field')).toHaveCSS(
    'outline-style',
    'solid',
  );
});
