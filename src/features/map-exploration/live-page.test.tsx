import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveExplorationPage } from './live-page';
import { createMapApi } from './api/client';
import { cityRecord, zoneRecord } from './api/test-data';
import { parseCities, parseZones } from './api/validation';
import { FixtureMapAdapter } from './fixture-adapter';
import type { MapStatusCardProps } from './map-status-slot';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function StatusProbe({ basis, phase, data, onRetry }: MapStatusCardProps) {
  return (
    <button data-testid="status-probe" onClick={onRetry}>
      {basis} {phase} {data?.initialTierZoneCount}
    </button>
  );
}
function mount(
  api: ReturnType<typeof createMapApi>,
  map = new FixtureMapAdapter(),
  mapStatusRenderer?: typeof StatusProbe,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <LiveExplorationPage
        api={api}
        createAdapter={() => map}
        mapStatusRenderer={mapStatusRenderer}
      />
    </QueryClientProvider>,
  );
  return queryClient;
}
describe('live exploration route', () => {
  it('passes the last good snapshot through refresh failure and retries only status', async () => {
    const status = {
      zoneCount: 6,
      initialTierZoneCount: 5,
      missingInitialTierZoneCount: 1,
      voteBasedZoneCount: 2,
      collectingZoneCount: 4,
      initialGradeCounts: [0, 2, 1, 1, 1].map((count, index) => ({
        grade: index + 1,
        count,
      })),
      validVoteCount: 95,
      participantCount: 21,
      lastCompletedAt: null,
      nextScheduledAt: null,
    };
    const path = '/api/v1/map/status';
    const request = vi.fn(async (url: string) =>
      Response.json(url === path ? status : { items: [] }),
    );
    vi.stubGlobal('fetch', request);
    const cities = vi.fn(async () => parseCities([cityRecord]));
    const client = mount({ ...createMapApi(), cities }, undefined, StatusProbe);
    const probe = await screen.findByTestId('status-probe');
    await waitFor(() => expect(probe).toHaveTextContent('initial ready 5'));

    const requestsBeforeRefresh = request.mock.calls.length;
    let failRefresh!: (response: Response) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          failRefresh = resolve;
        }),
    );
    act(() => {
      void client.refetchQueries({ queryKey: ['map', 'status'] });
    });
    await waitFor(() =>
      expect(probe).toHaveTextContent('initial refreshing 5'),
    );
    failRefresh(Response.json({}, { status: 404 }));
    await waitFor(() =>
      expect(probe).toHaveTextContent('initial refresh-error 5'),
    );

    fireEvent.click(probe);
    await waitFor(() => expect(probe).toHaveTextContent('initial ready 5'));
    expect(cities).toHaveBeenCalledOnce();
    expect(request.mock.calls.slice(requestsBeforeRefresh)).toEqual([
      [path, expect.any(Object)],
      [path, expect.any(Object)],
    ]);
  });

  it('skips the status observer in the compact shell', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const request = vi.fn(async (url: string) =>
      Response.json({ items: [], url }),
    );
    vi.stubGlobal('fetch', request);
    const client = mount(
      { ...createMapApi(), cities: async () => parseCities([cityRecord]) },
      undefined,
      StatusProbe,
    );
    await screen.findByRole('region', { name: /^지도$/ });
    expect(screen.queryByTestId('status-probe')).not.toBeInTheDocument();
    expect(client.getQueryState(['map', 'status'])).toBeUndefined();
    expect(request.mock.calls.map(([url]) => url)).not.toContain(
      '/api/v1/map/status',
    );
  });

  it('offers initial failure retry and never falls back to example data', async () => {
    const api = {
      ...createMapApi(),
      cities: vi.fn().mockRejectedValue(new Error('offline')),
    };
    mount(api);
    await screen.findByText('지도 데이터를 불러오지 못했어요.');
    expect(
      screen.queryByRole('button', { name: '구 강남구' }),
    ).not.toBeInTheDocument();
    api.cities.mockResolvedValue(parseCities([cityRecord]));
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    await screen.findByRole('button', { name: '구 예시구' });
  });
  it('requests the measured viewport and renders actual zone results', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
      toJSON() {},
    });
    const api = {
      ...createMapApi(),
      cities: async () => parseCities([cityRecord]),
      zones: vi.fn(async () => parseZones([zoneRecord])),
    };
    const map = new FixtureMapAdapter();
    map.center({ lat: 37.5, lng: 127 }, 13);
    mount(api, map);
    await screen.findByRole('button', { name: '권역 예시권역' });
    await waitFor(() => expect(api.zones).toHaveBeenCalled());
    const args = api.zones.mock.calls as unknown as [
      import('./api/contracts').MapBounds,
      AbortSignal,
    ][];
    expect(args[0]![0].west).toBeLessThan(127);
    expect(args[0]![0].east).toBeGreaterThan(127);
    expect(args[0]![1]).toBeInstanceOf(AbortSignal);
  });
  it('distinguishes an empty service catalog from a request failure', async () => {
    mount({ ...createMapApi(), cities: async () => [] });
    await screen.findByText('현재 서비스 지역이 없어요.');
    expect(
      screen.queryByRole('region', { name: '검토용 지도' }),
    ).not.toBeInTheDocument();
  });
  it('keeps the mounted map when background city refresh fails', async () => {
    const api = {
      ...createMapApi(),
      cities: vi.fn().mockResolvedValue(parseCities([cityRecord])),
    };
    const client = mount(api);
    await screen.findByRole('button', { name: '구 예시구' });
    api.cities.mockRejectedValue(new Error('offline'));
    await act(async () => {
      await client.refetchQueries({ queryKey: ['map', 'cities'] });
    });
    expect(screen.getByRole('button', { name: '구 예시구' })).toBeVisible();
    expect(
      await screen.findByText('서비스 지역 갱신에 실패했어요.'),
    ).toBeVisible();
  });
  it('does not replace the current viewport with a late previous viewport response', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
      toJSON() {},
    });
    let resolve!: (value: ReturnType<typeof parseZones>) => void;
    const api = {
      ...createMapApi(),
      cities: async () => parseCities([cityRecord]),
      zones: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((done) => {
              resolve = done;
            }),
        )
        .mockResolvedValue(
          parseZones([
            {
              ...zoneRecord,
              id: 'zone-b',
              name: '새권역',
              center: { longitude: 128, latitude: 37.5 },
            },
          ]),
        ),
    };
    const map = new FixtureMapAdapter();
    map.center({ lat: 37.5, lng: 127 }, 13);
    mount(api, map);
    await waitFor(() => expect(api.zones).toHaveBeenCalledTimes(1));
    act(() => map.center({ lat: 37.5, lng: 128 }, 13));
    await screen.findByRole('button', { name: '권역 새권역' });
    await act(async () => {
      resolve(parseZones([zoneRecord]));
    });
    expect(screen.getByRole('button', { name: '권역 새권역' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: '권역 예시권역' }),
    ).not.toBeInTheDocument();
  });
});
