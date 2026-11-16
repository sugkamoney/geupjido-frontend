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

afterEach(() => vi.restoreAllMocks());
function mount(
  api: ReturnType<typeof createMapApi>,
  map = new FixtureMapAdapter(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <LiveExplorationPage api={api} createAdapter={() => map} />
    </QueryClientProvider>,
  );
  return queryClient;
}
describe('live exploration route', () => {
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
