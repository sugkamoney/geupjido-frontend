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
    zone: async () => parseZoneDetail(detailRecord),
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
    ).toBeDisabled();
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
