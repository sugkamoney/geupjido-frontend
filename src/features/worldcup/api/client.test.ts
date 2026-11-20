import { afterEach, expect, it, vi } from 'vitest';
import { createWorldcupApi, WorldcupApiError } from './client';
import {
  parseGame,
  parseProgress,
  parseTimeline,
  parseZones,
} from './validation';
import {
  gameRecord,
  progressRecord,
  timelineRecord,
  zoneSelectionRecord,
} from './test-data';
afterEach(() => vi.unstubAllGlobals());
it('validates fixed games, nullable fields and confirmed round ordering', () => {
  expect(parseGame(gameRecord(10)).nextRoundNumber).toBeNull();
  expect(parseGame(gameRecord(0, 'zone-a')).tierRangeUsed).toBeNull();
  for (const value of [
    { ...gameRecord(), matchups: gameRecord().matchups.slice(1) },
    { ...gameRecord(1), nextRoundNumber: 1 },
    {
      ...gameRecord(1),
      skips: [{ roundNumber: 1, skippedAt: '2026-11-20T01:00:00Z' }],
    },
    {
      ...gameRecord(1),
      selections: [
        {
          roundNumber: 1,
          selectedComplexId: 'outsider',
          selectedAt: '2026-11-20T01:00:00Z',
        },
      ],
    },
    {
      ...gameRecord(),
      roundResult: {
        roundNumber: 1,
        available: true,
        leftPercent: 60,
        rightPercent: 50,
      },
    },
  ])
    expect(() => parseGame(value)).toThrow();
});
it('rejects malformed read models instead of supplying example data', () => {
  expect(parseProgress(progressRecord).completedRounds).toBe(0);
  expect(parseTimeline(timelineRecord).items[0]?.mine).toBe(true);
  expect(parseZones([zoneSelectionRecord])[0]?.canStart).toBe(true);
  expect(() =>
    parseProgress({ ...progressRecord, remainingRounds: 59 }),
  ).toThrow();
  expect(() =>
    parseTimeline({
      items: [{ ...timelineRecord.items[0], selectedComplexId: 'unknown' }],
    }),
  ).toThrow();
  expect(() =>
    parseZones([{ ...zoneSelectionRecord, activeComplexCount: 4 }]),
  ).toThrow();
});
it('uses scope-specific relative requests with cookies, exact vote payload and no skip body', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(gameRecord())));
  vi.stubGlobal('fetch', fetcher);
  const api = createWorldcupApi(),
    signal = new AbortController().signal;
  await api.start(undefined, signal);
  await api.current('zone/a', signal);
  await api.submit('zone/a', 1, 'left-1', signal);
  await api.submit(undefined, 2, 'skip', signal);
  expect(fetcher.mock.calls.map((args) => (args as unknown[])[0])).toEqual([
    '/api/v1/worldcup/games',
    '/api/v1/worldcup/zones/zone%2Fa/games/current',
    '/api/v1/worldcup/zones/zone%2Fa/games/current/rounds/1/vote',
    '/api/v1/worldcup/games/current/rounds/2/skip',
  ]);
  const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
  expect(calls.every(([, init]) => init.credentials === 'include')).toBe(true);
  expect(calls[2]![1].body).toBe('{"selectedComplexId":"left-1"}');
  expect(calls[3]![1].body).toBeUndefined();
});
it('keeps HTTP error codes and aborts without consuming late results', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('{"code":"DAILY_GAME_LIMIT_REACHED"}', { status: 429 }),
    ),
  );
  const api = createWorldcupApi(),
    controller = new AbortController();
  await expect(api.start(undefined, controller.signal)).rejects.toEqual(
    new WorldcupApiError(429, 'DAILY_GAME_LIMIT_REACHED'),
  );
  controller.abort();
  await expect(api.start(undefined, controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
});
