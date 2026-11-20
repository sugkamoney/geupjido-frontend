import { expect, test, type Page } from '@playwright/test';
import {
  cityRecord,
  zoneRecord,
  pinRecord,
  detailRecord,
  searchRecord,
} from '../src/features/map-exploration/api/test-data';
import {
  gameRecord,
  progressRecord,
  timelineRecord,
  zoneSelectionRecord,
} from '../src/features/worldcup/api/test-data';

async function mapRoutes(page: Page) {
  await page.route('**/api/v1/map/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json: path.endsWith('/cities')
        ? [cityRecord]
        : path.endsWith('/zones')
          ? [zoneRecord]
          : path.endsWith('/complexes')
            ? [pinRecord]
            : path.endsWith('/search')
              ? searchRecord
              : detailRecord,
    });
  });
}
async function open(page: Page, isMobile: boolean) {
  await page.getByRole('button', { name: '월드컵', exact: true }).click();
  if (!isMobile)
    await page
      .getByRole('button', { name: '월드컵 시작', exact: true })
      .click();
  const intro = page.getByRole('button', { name: '시작하기', exact: true });
  if (await intro.isVisible()) await intro.click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('live general game resumes, votes, skips, refreshes read models and survives page reload', async ({
  page,
  isMobile,
}) => {
  await mapRoutes(page);
  let game = gameRecord(),
    writes = 0,
    progressReads = 0,
    timelineReads = 0;
  const methods: string[] = [];
  await page.route('**/api/v1/worldcup/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    methods.push(`${request.method()} ${path}`);
    if (path.endsWith('/progress')) {
      progressReads++;
      return route.fulfill({
        json: {
          ...progressRecord,
          completedRounds: game.selections.length + game.skips.length,
          remainingRounds: 60 - game.selections.length - game.skips.length,
          roundsUntilNextMilestone:
            30 - game.selections.length - game.skips.length,
        },
      });
    }
    if (path.endsWith('/timeline')) {
      timelineReads++;
      return route.fulfill({
        json: {
          items: Array.from({ length: 5 }, () => timelineRecord.items[0]),
        },
      });
    }
    if (request.method() === 'PUT') {
      writes++;
      const n = Number(path.split('/').at(-2));
      if (path.endsWith('/vote')) {
        expect(request.postDataJSON()).toEqual({
          selectedComplexId: `left-${n}`,
        });
        game = {
          ...game,
          selections: [
            ...game.selections,
            {
              roundNumber: n,
              selectedComplexId: `left-${n}`,
              selectedAt: '2026-11-20T01:00:00Z',
            },
          ],
        };
      } else {
        expect(request.postData()).toBeNull();
        game = {
          ...game,
          skips: [
            ...game.skips,
            { roundNumber: n, skippedAt: '2026-11-20T01:00:00Z' },
          ],
        };
      }
      game.nextRoundNumber = n + 1;
      game.roundResult = {
        roundNumber: n,
        available: true,
        leftPercent: 53,
        rightPercent: 47,
      };
    }
    if (request.method() === 'POST')
      return route.fulfill({
        status: 201,
        json: game,
      });
    if (!methods.some((m) => m.startsWith('POST')))
      return route.fulfill({ status: 404, json: { code: 'GAME_NOT_FOUND' } });
    return route.fulfill({ json: game });
  });
  await page.goto('/');
  await open(page, isMobile);
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.worldcup-card')).toHaveCount(2);
  await expect(
    dialog.getByText('대표 거래 15.00억', { exact: true }),
  ).toHaveCount(2);
  await expect(
    dialog.getByText('계약일 2026-10-01', { exact: true }),
  ).toHaveCount(2);
  await page.screenshot({
    path: test.info().outputPath('live-worldcup.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain('gjd_uid');
  await dialog
    .getByRole('button', { name: '왼쪽단지 선택', exact: true })
    .click();
  await expect(dialog.getByText('53%', { exact: true })).toBeVisible();
  await expect(dialog.getByText('1개의 선택이 담겼어요')).toBeVisible();
  await expect(dialog.getByText('오늘 일반 월드컵 1 / 60판')).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: '잘 모르겠어요' }),
  ).toBeEnabled();
  await dialog.getByRole('button', { name: '잘 모르겠어요' }).click();
  await expect(dialog.getByText('오늘 일반 월드컵 2 / 60판')).toBeVisible();
  await expect(dialog.getByText('1개의 선택이 담겼어요')).toBeVisible();
  await dialog.getByRole('button', { name: '월드컵 닫기' }).click();
  await page.reload();
  await open(page, isMobile);
  await expect(
    page.getByRole('button', { name: '왼쪽단지 선택', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: '왼쪽단지 선택', exact: true })
    .click();
  await expect(dialog.getByText('오늘 일반 월드컵 3 / 60판')).toBeVisible();
  expect(writes).toBe(3);
  expect(methods.filter((m) => m.startsWith('POST'))).toHaveLength(1);
  expect(progressReads).toBeGreaterThan(2);
  expect(timelineReads).toBeGreaterThan(2);
});

test('zone comparison offers server alternatives and uses a separate vote route', async ({
  page,
}) => {
  await mapRoutes(page);
  let scope = 'zone-a';
  const writes: string[] = [];
  await page.route('**/api/v1/worldcup/**', (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (path.endsWith('/progress'))
      return route.fulfill({ json: progressRecord });
    if (path.endsWith('/timeline'))
      return route.fulfill({ json: { items: [] } });
    if (path.endsWith('/alternatives'))
      return route.fulfill({
        json: [
          { ...zoneSelectionRecord, zoneId: 'zone-b', zoneName: '대안권역' },
        ],
      });
    if (path.endsWith('/zones'))
      return route.fulfill({
        json: [
          { ...zoneSelectionRecord, canStart: false, activeComplexCount: 4 },
          { ...zoneSelectionRecord, zoneId: 'zone-b', zoneName: '대안권역' },
        ],
      });
    if (request.method() === 'GET')
      return route.fulfill({ status: 404, json: { code: 'GAME_NOT_FOUND' } });
    if (request.method() === 'POST') {
      scope = 'zone-b';
      return route.fulfill({ status: 201, json: gameRecord(0, scope) });
    }
    writes.push(path);
    const result = gameRecord(1, scope);
    result.roundResult = {
      roundNumber: 1,
      available: false,
      leftPercent: null,
      rightPercent: null,
    };
    return route.fulfill({ json: result });
  });
  await page.goto('/');
  await page.getByRole('combobox', { name: '지역 검색' }).fill('예시');
  await page
    .getByRole('option', { name: '예시권역 예시구', exact: true })
    .click();
  await page.getByRole('button', { name: '이 권역 단지 비교하기' }).click();
  const intro = page.getByRole('button', { name: '시작하기', exact: true });
  if (await intro.isVisible()) await intro.click();
  await expect(
    page.getByText('이 권역은 비교할 단지가 아직 부족해요.'),
  ).toBeVisible();
  await page.getByRole('button', { name: '예시구 대안권역 비교하기' }).click();
  await page
    .getByRole('button', { name: '왼쪽단지 선택', exact: true })
    .click();
  await expect(page.getByText('1개의 선택이 담겼어요')).toBeVisible();
  expect(writes).toEqual([
    '/api/v1/worldcup/zones/zone-b/games/current/rounds/1/vote',
  ]);
  await expect(page.getByText('오늘 일반 월드컵 0 / 60판')).toBeVisible();
});

test('the tenth round continues into a new set and the daily cap has a clear ending', async ({
  page,
  isMobile,
}) => {
  await mapRoutes(page);
  let game = gameRecord(9),
    starts = 0;
  const sentRounds: number[] = [];
  await page.route('**/api/v1/worldcup/**', (route) => {
    const path = new URL(route.request().url()).pathname,
      method = route.request().method();
    if (path.endsWith('/progress'))
      return route.fulfill({ json: progressRecord });
    if (path.endsWith('/timeline'))
      return route.fulfill({ json: { items: [] } });
    if (method === 'POST') {
      starts++;
      if (starts === 1) {
        game = gameRecord();
        game.matchups = game.matchups.map((r) => ({
          ...r,
          left: { ...r.left, name: '다음세트단지' },
        }));
      } else
        return route.fulfill({
          status: 429,
          json: { code: 'DAILY_GAME_LIMIT_REACHED' },
        });
    }
    if (method === 'PUT') {
      const name = game.matchups[0]!.left.name;
      const n = Number(path.split('/').at(-2));
      sentRounds.push(n);
      game = gameRecord(n);
      game.matchups = game.matchups.map((r) => ({
        ...r,
        left: { ...r.left, name },
      }));
      game.roundResult = {
        roundNumber: Number(path.split('/').at(-2)),
        available: false,
        leftPercent: null,
        rightPercent: null,
      };
    }
    return route.fulfill({ json: game });
  });
  await page.goto('/');
  await open(page, isMobile);
  await page
    .getByRole('button', { name: '왼쪽단지 선택', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '다음세트단지 선택', exact: true }),
  ).toBeEnabled();
  for (let n = 1; n <= 10; n++) {
    await expect(
      page.getByRole('button', { name: '다음세트단지 선택', exact: true }),
    ).toBeEnabled();
    await page
      .getByRole('button', { name: '다음세트단지 선택', exact: true })
      .click();
  }
  await expect(
    page.getByText('오늘 일반 월드컵을 모두 마쳤어요.', { exact: false }),
  ).toBeVisible();
  expect(starts).toBe(2);
  expect(sentRounds).toEqual([10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  await expect(page.getByRole('button', { name: '잘 모르겠어요' })).toHaveCount(
    0,
  );
});

test('timeline read failure never falls back to sample activity', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, '모바일 타임라인 패널은 제공하지 않음');
  await mapRoutes(page);
  await page.route('**/api/v1/worldcup/**', (route) =>
    route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: '월드컵', exact: true }).click();
  await expect(
    page.getByText('타임라인을 불러오지 못했어요.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('검토용 예시', { exact: false })).toHaveCount(0);
});

test('conflicts resync without a new pick and a lost vote response is recovered without repeating PUT', async ({
  page,
  isMobile,
}) => {
  await mapRoutes(page);
  let game = gameRecord(),
    writes = 0;
  await page.route('**/api/v1/worldcup/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/progress'))
      return route.fulfill({ json: progressRecord });
    if (path.endsWith('/timeline'))
      return route.fulfill({ json: { items: [] } });
    if (route.request().method() === 'PUT') {
      writes++;
      if (writes === 1) {
        game = gameRecord(1);
        return route.fulfill({
          status: 409,
          json: { code: 'VOTE_ALREADY_RECORDED' },
        });
      }
      game = gameRecord(2);
      return route.abort('failed');
    }
    return route.fulfill({ json: game });
  });
  await page.goto('/');
  await open(page, isMobile);
  await page
    .getByRole('button', { name: '오른쪽단지 선택', exact: true })
    .click();
  await expect(
    page.getByText('다른 요청으로 진행이 바뀌어 최신 대진을 불러왔어요.'),
  ).toBeVisible();
  await expect(page.getByText('아직 담긴 선택이 없어요')).toBeVisible();
  await page
    .getByRole('button', { name: '왼쪽단지 선택', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('저장 여부부터 확인해요');
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('1개의 선택이 담겼어요')).toBeVisible();
  expect(writes).toBe(2);
});

test('live cards remain usable in a short mobile viewport and return focus after closing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 460 });
  await mapRoutes(page);
  await page.route('**/api/v1/worldcup/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json: path.endsWith('/progress')
        ? progressRecord
        : path.endsWith('/timeline')
          ? { items: [] }
          : gameRecord(),
    });
  });
  await page.goto('/');
  await open(page, true);
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.worldcup-card')).toHaveCount(2);
  await dialog
    .getByRole('button', { name: '잘 모르겠어요' })
    .scrollIntoViewIfNeeded();
  await expect(
    dialog.getByRole('button', { name: '잘 모르겠어요' }),
  ).toBeVisible();
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await dialog.getByRole('button', { name: '월드컵 닫기' }).click();
  await expect(
    page.getByRole('button', { name: '월드컵', exact: true }),
  ).toBeFocused();
});

test('live timeline preserves scroll across zone changes and resets only when a filter chip changes', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, '모바일 타임라인 패널 미제공');
  await mapRoutes(page);
  let release: (() => void) | undefined;
  await page.route('**/api/v1/worldcup/timeline*', async (route) => {
    if (new URL(route.request().url()).searchParams.get('zoneId') === 'zone-b')
      await new Promise<void>((r) => {
        release = r;
      });
    return route.fulfill({
      json: {
        items: Array.from({ length: 20 }, () => timelineRecord.items[0]),
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '월드컵', exact: true }).click();
  const list = page.getByLabel('타임라인 목록', { exact: true });
  await expect(list.locator('.worldcup-timeline-row')).toHaveCount(20);
  await list.evaluate((node) => {
    node.scrollTop = 200;
  });
  const field = page.getByRole('combobox', { name: '지역 검색' });
  await field.fill('예시권역');
  await page
    .getByRole('option', { name: '예시권역 예시구', exact: true })
    .click();
  await page
    .getByRole('button', { name: '예시권역 대진', exact: true })
    .click();
  await expect(list.locator('.worldcup-timeline-row')).toHaveCount(20);
  expect(await list.evaluate((node) => node.scrollTop)).toBe(0);
  await list.evaluate((node) => {
    node.scrollTop = 200;
  });
  await page.route('**/api/v1/map/search?*', (route) =>
    route.fulfill({
      json: {
        cities: [],
        zones: [{ ...zoneRecord, id: 'zone-b', name: '다른권역' }],
        complexes: [],
      },
    }),
  );
  await page.route('**/api/v1/map/zones/zone-b', (route) =>
    route.fulfill({
      json: {
        ...detailRecord,
        zone: { ...zoneRecord, id: 'zone-b', name: '다른권역' },
        complexes: [],
      },
    }),
  );
  await field.fill('다른권역');
  await page
    .getByRole('option', { name: '다른권역 예시구', exact: true })
    .click();
  await expect.poll(() => !!release).toBe(true);
  expect(await list.evaluate((node) => node.scrollTop)).toBe(200);
  release!();
  await expect(list.locator('.worldcup-timeline-row')).toHaveCount(20);
  expect(await list.evaluate((node) => node.scrollTop)).toBe(200);
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await expect(list.locator('.worldcup-timeline-row')).toHaveCount(20);
  expect(await list.evaluate((node) => node.scrollTop)).toBe(0);
});

test('a delayed all-timeline navigation cannot replace a newer search selection', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, '타임라인 패널은 desktop 전용');
  await mapRoutes(page);
  await page.route('**/api/v1/worldcup/timeline*', (route) =>
    route.fulfill({
      json: { items: Array.from({ length: 5 }, () => timelineRecord.items[0]) },
    }),
  );
  let release: (() => void) | undefined;
  let finish: () => void = () => {};
  const finished = new Promise<void>((r) => {
    finish = r;
  });
  await page.route('**/api/v1/map/zones/zone-a', async (route) => {
    await new Promise<void>((r) => {
      release = r;
    });
    try {
      await route.fulfill({ json: detailRecord });
    } finally {
      finish();
    }
  });
  await page.route('**/api/v1/map/search?*', (route) =>
    route.fulfill({
      json: {
        cities: [],
        zones: [
          {
            ...zoneRecord,
            id: 'zone-b',
            name: '최신권역',
            center: { longitude: 127.3, latitude: 37.7 },
          },
        ],
        complexes: [],
      },
    }),
  );
  await page.route('**/api/v1/map/zones/zone-b', (route) =>
    route.fulfill({
      json: {
        ...detailRecord,
        zone: {
          ...zoneRecord,
          id: 'zone-b',
          name: '최신권역',
          center: { longitude: 127.3, latitude: 37.7 },
        },
        complexes: [],
      },
    }),
  );
  await page.goto('/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '월드컵', exact: true }).click();
  await page
    .getByRole('button', { name: '예시권역 왼쪽단지 권역 상세', exact: true })
    .first()
    .click();
  await expect.poll(() => !!release).toBe(true);
  await page.getByRole('combobox', { name: '지역 검색' }).fill('최신권역');
  await page
    .getByRole('option', { name: '최신권역 예시구', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '최신권역', exact: true }),
  ).toBeVisible();
  const map = page.getByRole('region', { name: '지도', exact: true });
  const center = await map.getAttribute('data-center-lat');
  release!();
  await finished;
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await expect(
    page.getByRole('heading', { name: '최신권역', exact: true }),
  ).toBeVisible();
  expect(await map.getAttribute('data-center-lat')).toBe(center);
});

for (const height of [779, 780, 800, 1080])
  test(`desktop My Picks stays within the scrollable layout at height ${height}`, async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'desktop 높이 경계');
    await page.setViewportSize({ width: 1280, height });
    await mapRoutes(page);
    await page.route('**/api/v1/worldcup/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      const game = gameRecord();
      game.matchups = game.matchups.map((r) => ({
        ...r,
        left: {
          ...r.left,
          name: '긴 단지 이름으로 여러 줄을 사용하는 월드컵 회귀 검증 아파트',
        },
        right: {
          ...r.right,
          name: '다른 긴 단지 이름으로 여러 줄을 사용하는 월드컵 회귀 검증 아파트',
        },
      }));
      return route.fulfill({
        json: path.endsWith('/progress')
          ? progressRecord
          : path.endsWith('/timeline')
            ? { items: [] }
            : game,
      });
    });
    await page.goto('/');
    await open(page, false);
    await expect(page.locator('.worldcup-card')).toHaveCount(2);
    const picks = await page.locator('.worldcup-picks').boundingBox(),
      title = await page.locator('.worldcup-picks h3').boundingBox();
    expect(picks!.y).toBeGreaterThanOrEqual(0);
    expect(title!.y).toBeGreaterThanOrEqual(0);
    await page
      .getByRole('button', { name: '잘 모르겠어요' })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole('button', { name: '잘 모르겠어요' }),
    ).toBeVisible();
    await page.getByRole('button', { name: '월드컵 닫기' }).click();
  });

test('fractional fifth-grade matchups load and reveal the server tier after voting', async ({
  page,
  isMobile,
}) => {
  await mapRoutes(page);
  await page.route('**/api/v1/worldcup/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/progress'))
      return route.fulfill({ json: progressRecord });
    if (path.endsWith('/timeline'))
      return route.fulfill({ json: { items: [] } });
    const voted = route.request().method() === 'PUT',
      game = gameRecord(voted ? 5 : 4);
    for (const round of game.matchups) {
      round.left.zoneTier = 5.8;
      round.right.zoneTier = round.type === 'CROSS_ZONE' ? 5.9 : 5.8;
    }
    if (voted)
      game.roundResult = {
        roundNumber: 5,
        available: true,
        leftPercent: 53,
        rightPercent: 47,
      };
    return route.fulfill({ json: game });
  });
  await page.goto('/');
  await open(page, isMobile);
  await expect(
    page.getByRole('button', { name: '왼쪽단지 선택', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: '왼쪽단지 선택', exact: true })
    .click();
  await expect(page.getByLabel('권역 급지 5.8', { exact: true })).toBeVisible();
  await expect(page.getByLabel('권역 급지 5.9', { exact: true })).toBeVisible();
});
