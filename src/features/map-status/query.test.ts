import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapApiError } from '../map-exploration/api/client';
import { MapContractError } from '../map-exploration/api/validation';
import { mapStatusQueryOptions } from './query';

const status = {
  zoneCount: 6,
  initialTierZoneCount: 5,
  missingInitialTierZoneCount: 1,
  voteBasedZoneCount: 2,
  collectingZoneCount: 4,
  initialGradeCounts: [
    { grade: 1, count: 0 },
    { grade: 2, count: 2 },
    { grade: 3, count: 1 },
    { grade: 4, count: 1 },
    { grade: 5, count: 1 },
  ],
  validVoteCount: 95,
  participantCount: 21,
  lastCompletedAt: '2026-11-27T12:00:00+09:00',
  nextScheduledAt: '2026-11-27T15:00:00+09:00',
};

afterEach(() => vi.unstubAllGlobals());

function respond(body: unknown, statusCode = 200) {
  const fetch = vi.fn(async () => Response.json(body, { status: statusCode }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function fetchStatus() {
  return new QueryClient().fetchQuery({
    ...mapStatusQueryOptions(),
    retry: false,
    gcTime: Infinity,
  });
}

describe('map status query', () => {
  it('reads the status snapshot via the same-origin map endpoint', async () => {
    const fetch = respond(status);
    expect(await fetchStatus()).toEqual(status);
    expect(fetch).toHaveBeenCalledWith('/api/v1/map/status', {
      method: 'GET',
      signal: expect.any(AbortSignal),
      headers: { Accept: 'application/json' },
    });
  });

  it('preserves zero votes and participants before the first publication', async () => {
    const firstPublicationPending = {
      ...status,
      validVoteCount: 0,
      participantCount: 0,
      voteBasedZoneCount: 0,
      collectingZoneCount: 6,
      lastCompletedAt: null,
    };
    respond(firstPublicationPending);
    expect(await fetchStatus()).toEqual(firstPublicationPending);
  });

  it('preserves null for a disabled schedule after publication', async () => {
    const scheduleDisabled = { ...status, nextScheduledAt: null };
    respond(scheduleDisabled);
    expect(await fetchStatus()).toEqual(scheduleDisabled);
  });

  it('surfaces HTTP failures with the original status and code', async () => {
    respond({ code: 'SERVICE_UNAVAILABLE' }, 503);
    const request = fetchStatus();
    await expect(request).rejects.toBeInstanceOf(MapApiError);
    await expect(request).rejects.toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it.each([
    { validVoteCount: -1 },
    { participantCount: '21' },
    { lastCompletedAt: '2026-11-27' },
    { nextScheduledAt: undefined },
    { initialGradeCounts: [{ grade: 6, count: 1 }] },
    { initialGradeCounts: [{ grade: 1, count: 0 }] },
  ])('rejects malformed snapshot fields %j', async (override) => {
    respond({ ...status, ...override });
    await expect(fetchStatus()).rejects.toBeInstanceOf(MapContractError);
  });
});
