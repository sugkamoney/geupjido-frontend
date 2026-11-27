import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import {
  fetchWeeklyReport,
  fetchWeeklyReportList,
  isWeeklyReportNotFound,
} from './client';
import {
  weeklyReportDetailFixtures,
  weeklyReportListFixtures,
} from './fixtures';
import { weeklyReportDetailOptions, weeklyReportListOptions } from './query';
import { WeeklyReportContractError } from './validation';

const { first, previous, latest } = weeklyReportDetailFixtures;
const signal = new AbortController().signal;

afterEach(() => vi.unstubAllGlobals());

it.each(Object.values(weeklyReportListFixtures))(
  'reads $state as delivered by the server',
  async (body) => {
    const fetch = vi.fn(async () => Response.json(body));
    vi.stubGlobal('fetch', fetch);
    await expect(fetchWeeklyReportList(signal)).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/v1/reports', {
      method: 'GET',
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  },
);

it.each(['PREPARING', 'DELAYED'] as const)(
  'allows %s before the first release',
  async (state) => {
    const body = {
      ...weeklyReportListFixtures.COLLECTING,
      state,
      collectingZones: [],
    };
    vi.stubGlobal('fetch', async () => Response.json(body));
    await expect(fetchWeeklyReportList(signal)).resolves.toEqual(body);
  },
);

it('preserves list order and latest markers independently of numeric IDs', async () => {
  const body = {
    ...weeklyReportListFixtures.PUBLISHED,
    reports: weeklyReportListFixtures.PUBLISHED.reports.map(
      (report, index) => ({
        ...report,
        reportId: [3, 90, 6][index],
      }),
    ),
  };
  vi.stubGlobal('fetch', async () => Response.json(body));
  await expect(fetchWeeklyReportList(signal)).resolves.toEqual(body);
});

it.each([0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid report ID %s before fetching',
  async (id) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(fetchWeeklyReport(id, signal)).rejects.toBeInstanceOf(
      RangeError,
    );
    expect(fetch).not.toHaveBeenCalled();
  },
);

it.each([
  [404, 'REPORT_NOT_FOUND', true],
  [404, 'OTHER', false],
  [500, 'REPORT_NOT_FOUND', false],
] as const)('retains HTTP %i and code %s', async (status, code, missing) => {
  vi.stubGlobal('fetch', async () => Response.json({ code }, { status }));
  const error: unknown = await fetchWeeklyReport(1, signal).catch(
    (cause: unknown) => cause,
  );
  expect(error).toMatchObject({ status, code });
  expect(isWeeklyReportNotFound(error)).toBe(missing);
});

it('retains a gateway error with a non-JSON body', async () => {
  vi.stubGlobal(
    'fetch',
    async () => new Response('Bad gateway', { status: 502 }),
  );
  await expect(fetchWeeklyReportList(signal)).rejects.toMatchObject({
    status: 502,
    code: undefined,
  });
});

it.each([
  { reportId: previous.reportId },
  { cutoffCompletedAt: '2026-02-30T09:00:00Z' },
  { publishedAt: '2026-11-22T08:00:00Z' },
  { changedGradeZoneCount: undefined },
  { previousReportId: 0 },
  { nextReportId: latest.reportId },
  { participantCount: -1 },
  { cityChanges: [{ ...latest.cityChanges[0], movement: 'SAME' }] },
  { fallenZones: null },
])('rejects malformed detail fields %j', async (fields) => {
  vi.stubGlobal('fetch', async () => Response.json({ ...latest, ...fields }));
  await expect(
    fetchWeeklyReport(latest.reportId, signal),
  ).rejects.toBeInstanceOf(WeeklyReportContractError);
});

it.each([
  { state: 'UNKNOWN' },
  { expectedReleaseAt: null },
  { reports: undefined },
  {
    collectingZones: [
      {
        ...weeklyReportListFixtures.COLLECTING.collectingZones[0],
        validVoteCount: '42',
      },
    ],
  },
])('rejects malformed list fields %j', async (fields) => {
  vi.stubGlobal('fetch', async () =>
    Response.json({ ...weeklyReportListFixtures.COLLECTING, ...fields }),
  );
  await expect(fetchWeeklyReportList(signal)).rejects.toBeInstanceOf(
    WeeklyReportContractError,
  );
});

it('classifies malformed successful JSON as a contract failure', async () => {
  vi.stubGlobal('fetch', async () => new Response('{'));
  await expect(fetchWeeklyReportList(signal)).rejects.toMatchObject({
    path: 'response',
  });
});

it('keeps list and details isolated when navigating using server IDs', async () => {
  const fetch = vi.fn(async (url: string) => {
    if (url === '/api/v1/reports')
      return Response.json(weeklyReportListFixtures.PUBLISHED);
    const body = [first, previous, latest].find(
      (report) => url === `/api/v1/reports/${report.reportId}`,
    );
    return Response.json(body ?? { code: 'REPORT_NOT_FOUND' }, {
      status: body ? 200 : 404,
    });
  });
  vi.stubGlobal('fetch', fetch);
  const client = new QueryClient();
  const list = await client.fetchQuery(weeklyReportListOptions());
  const newest = await client.fetchQuery(
    weeklyReportDetailOptions(list.reports[0]?.reportId ?? null),
  );
  const older = await client.fetchQuery(
    weeklyReportDetailOptions(newest.previousReportId),
  );
  const oldest = await client.fetchQuery(
    weeklyReportDetailOptions(older.previousReportId),
  );
  expect([newest, older, oldest]).toEqual([latest, previous, first]);
  expect(older.changedGradeZoneCount).toBe(0);
  expect(oldest).toMatchObject({
    changedGradeZoneCount: null,
    previousReportId: null,
    nextReportId: older.reportId,
    risenZones: [],
    fallenZones: [],
    cityChanges: [],
  });
  expect(
    client.getQueryData(weeklyReportDetailOptions(latest.reportId).queryKey),
  ).toEqual(latest);
  expect(client.getQueryData(weeklyReportListOptions().queryKey)).toEqual(list);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    '/api/v1/reports',
    '/api/v1/reports/25',
    '/api/v1/reports/17',
    '/api/v1/reports/11',
  ]);
  client.clear();
});

it('aborts the previous detail when an observer switches IDs', async () => {
  let oldSignal: AbortSignal | null | undefined;
  const fetch = vi.fn(async (url: string, options: RequestInit) => {
    expect(options.cache).toBe('no-store');
    if (url.endsWith('/17')) return Response.json(previous);
    oldSignal = options.signal;
    return new Promise<Response>((resolve) => {
      options.signal?.addEventListener(
        'abort',
        () => resolve(Response.json(latest)),
        { once: true },
      );
    });
  });
  vi.stubGlobal('fetch', fetch);
  const client = new QueryClient();
  const observer = new QueryObserver(
    client,
    weeklyReportDetailOptions(latest.reportId),
  );
  const unsubscribe = observer.subscribe(() => {});
  try {
    observer.setOptions(weeklyReportDetailOptions(previous.reportId));
    expect(oldSignal?.aborted).toBe(true);
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data).toEqual(previous),
    );
    expect(
      client.getQueryData(weeklyReportDetailOptions(latest.reportId).queryKey),
    ).toBeUndefined();
    observer.setOptions(weeklyReportDetailOptions(null));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().data).toBeUndefined();
  } finally {
    unsubscribe();
    client.clear();
  }
});
