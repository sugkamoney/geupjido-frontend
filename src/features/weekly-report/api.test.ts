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
  'preserves collecting zones during %s before the first release',
  async (state) => {
    const { collectingZones } = weeklyReportListFixtures.COLLECTING;
    expect(collectingZones.length).toBeGreaterThan(0);
    for (const zones of [[], collectingZones]) {
      const body = {
        ...weeklyReportListFixtures.COLLECTING,
        state,
        collectingZones: zones,
      };
      vi.stubGlobal('fetch', async () => Response.json(body));
      await expect(fetchWeeklyReportList(signal)).resolves.toEqual(body);
    }
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

it.each([
  {
    name: 'report not found',
    respond: () => Response.json({ code: 'REPORT_NOT_FOUND' }, { status: 404 }),
    error: { status: 404, code: 'REPORT_NOT_FOUND' },
    attempts: 1,
  },
  {
    name: 'contract violation',
    respond: () => Response.json({ ...latest, cutoffCompletedAt: null }),
    error: {
      name: 'WeeklyReportContractError',
      path: 'response.cutoffCompletedAt',
    },
    attempts: 1,
  },
  {
    name: 'service unavailable',
    respond: () => new Response(null, { status: 503 }),
    error: { status: 503 },
    attempts: 2,
  },
  {
    name: 'network failure',
    respond: () => {
      throw new TypeError('Failed to fetch');
    },
    error: { name: 'TypeError', message: 'Failed to fetch' },
    attempts: 2,
  },
])(
  'stops after $attempts request(s) on persistent $name',
  async ({ respond, error, attempts }) => {
    const fetch = vi.fn(async () => respond());
    vi.stubGlobal('fetch', fetch);
    const client = new QueryClient();
    try {
      await expect(
        client.fetchQuery(weeklyReportDetailOptions(latest.reportId)),
      ).rejects.toMatchObject(error);
      expect(fetch).toHaveBeenCalledTimes(attempts);
    } finally {
      client.clear();
    }
  },
);

it.each([
  [200, 'fulfills'],
  [200, 'rejects'],
  [404, 'fulfills'],
  [404, 'rejects'],
] as const)(
  'preserves cancellation when an HTTP %i body read %s',
  async (status, outcome) => {
    const controller = new AbortController();
    const reason = new DOMException('Detail request cancelled', 'AbortError');
    const body = status === 200 ? latest : { code: 'REPORT_NOT_FOUND' };
    const response = Response.json(body, { status });
    const json = vi.spyOn(response, 'json').mockImplementation(async () => {
      controller.abort(reason);
      if (outcome === 'rejects')
        throw new DOMException('Body read aborted', 'AbortError');
      return body;
    });
    vi.stubGlobal('fetch', async () => response);

    await expect(
      fetchWeeklyReport(latest.reportId, controller.signal),
    ).rejects.toBe(reason);
    expect(json).toHaveBeenCalledTimes(1);
  },
);

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
  for (const report of [latest, previous, first]) {
    expect(
      client.getQueryData(weeklyReportDetailOptions(report.reportId).queryKey),
    ).toEqual(report);
  }
  expect(client.getQueryData(weeklyReportListOptions().queryKey)).toEqual(list);
  const forwardOptions = weeklyReportDetailOptions(oldest.nextReportId);
  client.removeQueries({ queryKey: forwardOptions.queryKey, exact: true });
  await expect(client.fetchQuery(forwardOptions)).resolves.toEqual(previous);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    '/api/v1/reports',
    '/api/v1/reports/25',
    '/api/v1/reports/17',
    '/api/v1/reports/11',
    '/api/v1/reports/17',
  ]);
  client.clear();
});

it('aborts the previous detail and ignores its response after the new detail succeeds', async () => {
  let oldSignal: AbortSignal | null | undefined;
  let releaseOld!: (response: Response) => void;
  const oldResponse = new Promise<Response>((resolve) => {
    releaseOld = resolve;
  });
  const fetch = vi.fn((url: string, options: RequestInit) => {
    expect(options.cache).toBe('no-store');
    if (url.endsWith('/17')) return Promise.resolve(Response.json(previous));
    oldSignal = options.signal;
    return oldResponse;
  });
  vi.stubGlobal('fetch', fetch);
  const client = new QueryClient();
  const oldOptions = weeklyReportDetailOptions(latest.reportId);
  const oldQuery = vi.spyOn(oldOptions, 'queryFn');
  const observer = new QueryObserver(client, oldOptions);
  const unsubscribe = observer.subscribe(() => {});
  try {
    observer.setOptions(weeklyReportDetailOptions(previous.reportId));
    expect(oldSignal?.aborted).toBe(true);
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data).toEqual(previous),
    );
    releaseOld(Response.json(latest));
    expect(oldQuery).toHaveBeenCalledTimes(1);
    await expect(oldQuery.mock.results[0]?.value).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(observer.getCurrentResult().data).toEqual(previous);
    expect(
      client.getQueryData(
        weeklyReportDetailOptions(previous.reportId).queryKey,
      ),
    ).toEqual(previous);
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
