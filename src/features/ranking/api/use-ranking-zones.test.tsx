import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_RANKING_FILTERS, type RankingFilters } from './contracts';
import { responseBody } from './test-data';
import { useRankingZones } from './use-ranking-zones';

afterEach(() => vi.unstubAllGlobals());

function wrapper() {
  const client = new QueryClient();
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

it.each([
  { region: 'SEOUL' },
  { tab: 'GRADE_2' },
  { sort: 'RISEN' },
] satisfies Partial<RankingFilters>[])(
  'cancels superseded requests when %j changes and ignores late results',
  async (change) => {
    const initial = DEFAULT_RANKING_FILTERS;
    const next = { ...initial, ...change };
    const requests: {
      url: string;
      signal: AbortSignal;
      resolve: (response: Response) => void;
    }[] = [];
    vi.stubGlobal(
      'fetch',
      (url: string, { signal }: { signal: AbortSignal }) =>
        new Promise<Response>((resolve) =>
          requests.push({ url, signal, resolve }),
        ),
    );
    const { result, rerender } = renderHook(
      (filters: RankingFilters) => useRankingZones(filters),
      { initialProps: initial, wrapper: wrapper() },
    );
    await waitFor(() => expect(requests).toHaveLength(1));
    rerender(next);
    await waitFor(() => expect(requests).toHaveLength(2));
    const [superseded, active] = requests;
    if (!superseded || !active) throw new Error('Expected both requests');
    expect(superseded.signal.aborted).toBe(true);
    expect(active.url).toBe(
      `/api/v1/rankings/zones?${new URLSearchParams(next)}`,
    );
    expect(result.current.data).toBeUndefined();
    active.resolve(Response.json(responseBody(next)));
    await waitFor(() =>
      expect(result.current.data).toEqual(responseBody(next)),
    );
    await act(async () =>
      superseded.resolve(Response.json(responseBody(initial))),
    );
    expect(result.current.data).toEqual(responseBody(next));
  },
);

it('exposes a failure and retries the same filters on refetch', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json(responseBody()));
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(() => useRankingZones(), {
    wrapper: wrapper(),
  });
  await waitFor(() => expect(result.current.isError).toBe(true));
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.data).toEqual(responseBody()));
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(
    Array(2).fill('/api/v1/rankings/zones?region=ALL&tab=GRADE_1&sort=CURRENT'),
  );
});
