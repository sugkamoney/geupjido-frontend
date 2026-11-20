import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ExplorationPage } from './exploration-page';
import { FixtureMapAdapter } from './fixture-adapter';
import {
  cityData,
  createLiveSources,
  toZone,
  toApartment,
} from './api/live-source';
import { parseCities, parseZoneDetail, parseZones } from './api/validation';
import {
  cityRecord,
  detailRecord,
  pinRecord,
  zoneRecord,
} from './api/test-data';
import { createMapApi } from './api/client';

function setup(located = true) {
  const zone = toZone(parseZones([zoneRecord])[0]!);
  const data = { ...cityData(parseCities([cityRecord])), zones: [zone] };
  const map = new FixtureMapAdapter();
  map.setViewport(
    { width: 1000, height: 800 },
    { x: 0, y: 0, width: 1000, height: 800 },
  );
  map.center(zone.point, 13);
  const api = {
    ...createMapApi(),
    zone: async () =>
      parseZoneDetail({
        ...detailRecord,
        complexes: [
          {
            ...detailRecord.complexes[0],
            location: located ? pinRecord.location : null,
          },
        ],
      }),
    complexes: async () => (located ? [pinRecord] : []),
  };
  const sources = createLiveSources(api);
  render(
    <ExplorationPage
      adapter={map}
      data={data}
      source={sources.source}
      searchSource={sources.searchSource}
      live
    />,
  );
  return map;
}
describe('live data in the existing exploration screen', () => {
  it.each(['pending', 'failed'] as const)(
    'retains the selected zone while detail is %s and viewport zones disappear',
    async (state) => {
      const zone = toZone(parseZones([zoneRecord])[0]!);
      const data = { ...cityData(parseCities([cityRecord])), zones: [zone] };
      const map = new FixtureMapAdapter();
      map.setViewport(
        { width: 1000, height: 800 },
        { x: 0, y: 0, width: 1000, height: 800 },
      );
      map.center(zone.point, 13);
      const source = {
        loadZone: () =>
          state === 'failed'
            ? Promise.reject(new Error('offline'))
            : new Promise<never>(() => {}),
      };
      const view = render(
        <ExplorationPage live adapter={map} data={data} source={source} />,
      );
      fireEvent.click(screen.getByRole('button', { name: '권역 예시권역' }));
      if (state === 'failed')
        await screen.findByText('권역 정보를 불러오지 못했어요.');
      view.rerender(
        <ExplorationPage
          live
          adapter={map}
          data={{ ...data, zones: [] }}
          source={source}
        />,
      );
      expect(
        screen.getByRole('button', { name: '권역 예시권역' }),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('서울특별시 › 예시구')).toBeVisible();
      expect(screen.getByText('초기 급지')).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: '권역 상세 닫기' }));
      expect(
        screen.queryByRole('button', { name: '권역 예시권역' }),
      ).not.toBeInTheDocument();
    },
  );
  it('uses latest detail after viewport loss and clears snapshots on district or different zone selection', async () => {
    const zone = toZone(parseZones([zoneRecord])[0]!);
    const other = {
      ...zone,
      id: 'zone-b',
      name: '다른권역',
      point: { lat: 37.501, lng: 127.001 },
    };
    const data = {
      ...cityData(parseCities([cityRecord])),
      zones: [zone, other],
    };
    const map = new FixtureMapAdapter();
    map.setViewport(
      { width: 1000, height: 800 },
      { x: 0, y: 0, width: 1000, height: 800 },
    );
    map.center(zone.point, 13);
    let finish!: (value: { zone: typeof zone; apartments: [] }) => void;
    const source = {
      loadZone: () =>
        new Promise<{ zone: typeof zone; apartments: [] }>((resolve) => {
          finish = resolve;
        }),
    };
    const page = (zones: typeof data.zones) => (
      <ExplorationPage
        live
        adapter={map}
        data={{ ...data, zones }}
        source={source}
      />
    );
    const view = render(page(data.zones));
    fireEvent.click(screen.getByRole('button', { name: '권역 예시권역' }));
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    view.rerender(page([other]));
    await act(async () =>
      finish({
        zone: { ...zone, name: '최신권역', value: '1.5' },
        apartments: [],
      }),
    );
    expect(
      screen.getByRole('button', { name: '권역 최신권역' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('.ui-grade-card')).toHaveTextContent('1.5');
    fireEvent.click(screen.getByRole('button', { name: '권역 다른권역' }));
    expect(
      screen.queryByRole('button', { name: '권역 최신권역' }),
    ).not.toBeInTheDocument();
    act(() => map.center(zone.point, 12));
    fireEvent.click(screen.getByRole('button', { name: '구 예시구' }));
    view.rerender(page([]));
    expect(
      screen.queryByRole('button', { name: '권역 다른권역' }),
    ).not.toBeInTheDocument();
  });
  it('retains coordinates acquired after selecting an unlocated row when viewport data disappears', async () => {
    const zone = toZone(parseZones([zoneRecord])[0]!);
    const data = { ...cityData(parseCities([cityRecord])), zones: [zone] };
    const map = new FixtureMapAdapter();
    map.setViewport(
      { width: 1000, height: 800 },
      { x: 0, y: 0, width: 1000, height: 800 },
    );
    map.center(zone.point, 13);
    const sources = createLiveSources({
      ...createMapApi(),
      zone: async () => parseZoneDetail(detailRecord),
      complexes: async () => [],
    });
    const page = (apartments: ReturnType<typeof toApartment>[]) => (
      <ExplorationPage
        live
        adapter={map}
        data={{ ...data, apartments }}
        source={sources.source}
        searchSource={sources.searchSource}
      />
    );
    const view = render(page([]));
    fireEvent.click(screen.getByRole('button', { name: '권역 예시권역' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '목록 단지 예시단지' }),
    );
    expect(screen.getByText(/이 단지의 위치 정보가 없어/)).toBeVisible();
    act(() => map.center({ lat: 37.5, lng: 127.1 }, 13));
    view.rerender(page([toApartment(pinRecord)]));
    expect(
      screen.getByRole('button', { name: '지도 단지 예시단지' }),
    ).toHaveAttribute('aria-pressed', 'true');
    view.rerender(page([]));
    act(() => map.center({ lat: 37.5, lng: 127.1 }, 12));
    expect(
      screen.getByRole('button', { name: '지도 단지 예시단지' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.queryByText(/이 단지의 위치 정보가 없어/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '목록 단지 예시단지' }),
    ).not.toHaveTextContent('위치 정보 없음');
    fireEvent.click(screen.getByRole('button', { name: '권역 상세 닫기' }));
    expect(
      screen.queryByRole('button', { name: '지도 단지 예시단지' }),
    ).not.toBeInTheDocument();
  });
  it('retains an already located selected pin when viewport pins disappear and detail lookup missed it', async () => {
    const zone = toZone(parseZones([zoneRecord])[0]!);
    const data = {
      ...cityData(parseCities([cityRecord])),
      zones: [zone],
      apartments: [toApartment(pinRecord)],
    };
    const map = new FixtureMapAdapter();
    map.setViewport(
      { width: 1000, height: 800 },
      { x: 0, y: 0, width: 1000, height: 800 },
    );
    map.center({ lat: 37.5, lng: 127.1 }, 15);
    const sources = createLiveSources({
      ...createMapApi(),
      zone: async () => parseZoneDetail(detailRecord),
      complexes: async () => [],
    });
    const view = render(
      <ExplorationPage
        live
        adapter={map}
        data={data}
        source={sources.source}
        searchSource={sources.searchSource}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '지도 단지 예시단지' }));
    await screen.findByRole('button', { name: '목록 단지 예시단지' });
    act(() => map.center({ lat: 37.5, lng: 127.1 }, 13));
    view.rerender(
      <ExplorationPage
        live
        adapter={map}
        data={{ ...data, apartments: [] }}
        source={sources.source}
        searchSource={sources.searchSource}
      />,
    );
    expect(
      screen.getByRole('button', { name: '지도 단지 예시단지' }),
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '목록 단지 예시단지' }));
    await waitFor(() => expect(map.getSnapshot().zoom).toBe(15));
  });
  it('opens real zone details with initial tier, actual nullable rank and multipolygon path, without fixture voting', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '권역 예시권역' }));
    await screen.findByRole('button', { name: '목록 단지 예시단지' });
    expect(screen.getByText('초기 급지')).toBeVisible();
    expect(screen.getByText('서울특별시 › 예시구')).toBeVisible();
    expect(screen.getByText(/㎡당 대표 가격/)).toBeVisible();
    expect(screen.queryByText('예시')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '이 권역 단지 비교하기' }),
    ).toBeEnabled();
    expect(
      document.querySelector('[data-selected-polygon]')?.tagName.toLowerCase(),
    ).toBe('path');
    expect(document.querySelector('[data-selected-polygon]')).toHaveAttribute(
      'fill-rule',
      'evenodd',
    );
    expect(
      document.querySelector('.exploration-rank-number'),
    ).toHaveTextContent('—');
  });
  it('keeps selection without inventing a location or moving the camera when a list row has no position', async () => {
    const map = setup(false);
    await userEvent.click(
      screen.getByRole('button', { name: '권역 예시권역' }),
    );
    const row = await screen.findByRole('button', {
      name: '목록 단지 예시단지',
    });
    await waitFor(() => expect(map.getSnapshot().center.lat).toBeCloseTo(37.5));
    act(() => map.releaseAnchor());
    const before = map.getSnapshot();
    await userEvent.click(row);
    expect(row).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/이 단지의 위치 정보가 없어/)).toBeVisible();
    expect(map.getSnapshot()).toEqual(before);
    expect(
      screen.queryByRole('button', { name: '지도 단지 예시단지' }),
    ).not.toBeInTheDocument();
  });
});
