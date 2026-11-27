import { afterEach, expect, it, vi } from 'vitest';
import { fetchRankingZones, RankingApiError } from './client';
import { DEFAULT_RANKING_FILTERS } from './contracts';
import { responseBody } from './test-data';
import { RankingContractError } from './validation';

const zone = {
  zoneId: 'zone-1',
  name: '권역',
  cityName: '시',
  regionName: '지역',
  rankingBasis: 'INITIAL',
  tier: null,
  rank: null,
  rankTotal: 27,
  previousTier: null,
  tierDelta: null,
  movement: 'NONE',
  validVoteCount: 2,
  participantCount: 1,
  crossZoneVoteCount: 0,
};

afterEach(() => vi.unstubAllGlobals());

it.each([
  [undefined, { region: 'ALL', tab: 'GRADE_1', sort: 'CURRENT' }],
  [
    { region: 'SEOUL', tab: 'GRADE_5', sort: 'FALLEN' },
    { region: 'SEOUL', tab: 'GRADE_5', sort: 'FALLEN' },
  ],
  [
    { region: 'GYEONGGI_INCHEON', tab: 'COLLECTING', sort: 'RISEN' },
    { region: 'GYEONGGI_INCHEON', tab: 'COLLECTING', sort: 'CURRENT' },
  ],
] as const)(
  'serializes %j as %j and accepts an empty result',
  async (input, applied) => {
    const body = responseBody(applied);
    const fetch = vi.fn(async () => Response.json(body));
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    await expect(fetchRankingZones(input, signal)).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      `/api/v1/rankings/zones?${new URLSearchParams(applied)}`,
      {
        method: 'GET',
        signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      },
    );
  },
);

it('preserves response filters, nullable values, server order and ranks', async () => {
  const body = {
    ...responseBody({ ...DEFAULT_RANKING_FILTERS, tab: 'COLLECTING' }),
    lastCompletedAt: '2026-11-20T03:04:05.123456Z',
    zones: [
      zone,
      {
        ...zone,
        zoneId: 'zone-2',
        tier: 3.5,
        rank: 19,
        previousTier: 4,
        tierDelta: 0.5,
        movement: 'UP',
      },
      { ...zone, zoneId: 'zone-3', tier: 2, rank: 7 },
    ],
  };
  vi.stubGlobal('fetch', async () => Response.json(body));
  await expect(
    fetchRankingZones(
      { ...DEFAULT_RANKING_FILTERS, tab: 'COLLECTING' },
      new AbortController().signal,
    ),
  ).resolves.toEqual(body);
});

it.each([
  { zones: undefined },
  { zones: [{ ...zone, name: null }] },
  { zones: [{ ...zone, rank: undefined }] },
  { zones: [{ ...zone, movement: 'UNKNOWN' }] },
  { rankedZoneCount: -1 },
  { gradeCounts: [{ grade: 6, count: 2 }] },
  { previousCompletedAt: 'yesterday' },
  { sort: 'WRONG' },
])('rejects invalid response fields %j', async (fields) => {
  vi.stubGlobal('fetch', async () =>
    Response.json({ ...responseBody(), ...fields }),
  );
  await expect(
    fetchRankingZones(undefined, new AbortController().signal),
  ).rejects.toBeInstanceOf(RankingContractError);
});

it.each([
  ['region', 'SEOUL'],
  ['tab', 'GRADE_2'],
  ['sort', 'FALLEN'],
] as const)('rejects a response for a different %s', async (field, value) => {
  vi.stubGlobal('fetch', async () =>
    Response.json({ ...responseBody(), [field]: value }),
  );
  await expect(
    fetchRankingZones(undefined, new AbortController().signal),
  ).rejects.toMatchObject({ name: 'RankingContractError', path: field });
});

it.each([
  [{ previousCompletedAt: '2026-02-30T00:00:00Z' }, 'previousCompletedAt'],
  [
    {
      zones: [
        {
          ...zone,
          tier: 3.5,
          rank: 19,
          previousTier: 4,
          tierDelta: -0.5,
          movement: 'UP',
        },
      ],
    },
    'zones[0].tierDelta',
  ],
  [{ gradeCounts: [] }, 'gradeCounts'],
  [
    { gradeCounts: Array.from({ length: 5 }, () => ({ grade: 1, count: 2 })) },
    'gradeCounts',
  ],
] as const)('rejects inconsistent contract data %j', async (fields, path) => {
  vi.stubGlobal('fetch', async () =>
    Response.json({ ...responseBody(), ...fields }),
  );
  await expect(
    fetchRankingZones(undefined, new AbortController().signal),
  ).rejects.toMatchObject({ name: 'RankingContractError', path });
});

it('reports HTTP failures with status and code', async () => {
  vi.stubGlobal('fetch', async () =>
    Response.json({ code: 'INVALID_REQUEST' }, { status: 400 }),
  );
  const request = fetchRankingZones(undefined, new AbortController().signal);
  await expect(request).rejects.toBeInstanceOf(RankingApiError);
  await expect(request).rejects.toMatchObject({
    status: 400,
    code: 'INVALID_REQUEST',
  });
});

it('reports malformed successful JSON as a contract error', async () => {
  vi.stubGlobal('fetch', async () => new Response('<html>'));
  await expect(
    fetchRankingZones(undefined, new AbortController().signal),
  ).rejects.toBeInstanceOf(RankingContractError);
});
