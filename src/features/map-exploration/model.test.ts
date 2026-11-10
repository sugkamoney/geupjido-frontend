import { describe, expect, it } from 'vitest';
import { FixtureMapAdapter } from './fixture-adapter';
import { fixtures } from './fixtures';
import {
  layoutOverlays,
  polygonOpacity,
  visibleApartments,
  visibleLabels,
} from './model';

const data = fixtures;
describe('map visibility and collision policy', () => {
  it('switches at fractional boundaries and keeps selected overlays exactly once', () => {
    expect(visibleLabels(data, 12.49).every((x) => x.kind === 'gu')).toBe(true);
    expect(visibleLabels(data, 12.5).every((x) => x.kind === 'zone')).toBe(
      true,
    );
    expect(
      visibleLabels(data, 12.49, 'apgujeong').filter(
        (x) => x.id === 'apgujeong',
      ),
    ).toHaveLength(1);
    expect(
      visibleLabels(data, 12.5, 'apgujeong').filter(
        (x) => x.id === 'apgujeong',
      ),
    ).toHaveLength(1);
    expect(visibleApartments(data, 14.49)).toHaveLength(0);
    expect(visibleApartments(data, 14.49, 'apt-1').map((x) => x.id)).toEqual([
      'apt-1',
    ]);
    expect(visibleApartments(data, 14.5, 'apt-1')).toHaveLength(
      data.apartments.length,
    );
  });
  it('interpolates only the selected area opacity', () => {
    expect(polygonOpacity(12.49)).toBe(0);
    expect(polygonOpacity(13.5)).toBeCloseTo(0.3);
    expect(polygonOpacity(14)).toBeCloseTo(0.2);
    expect(polygonOpacity(14.5)).toBeCloseTo(0.1);
    expect(polygonOpacity(17)).toBeCloseTo(0.1);
  });
  it('prioritizes selected and larger areas, and apartment names by household count', () => {
    const project = () => ({ x: 100, y: 100 });
    const labels = layoutOverlays(
      data.zones,
      [],
      project,
      { width: 600, height: 400 },
      'cheongdam',
    );
    expect(
      labels.labels.find((x) => x.item.id === 'cheongdam')?.showLabel,
    ).toBe(true);
    expect(labels.labels.filter((x) => x.showLabel)).toHaveLength(1);
    const pins = layoutOverlays([], data.apartments.slice(0, 2), project, {
      width: 600,
      height: 400,
    });
    expect(pins.pins.filter((x) => x.showName).map((x) => x.item.id)).toEqual([
      'apt-1',
    ]); // bodies end below the name; larger household count wins name collision
  });
  it('reserves selected label before overlapping district labels', () => {
    const placed = layoutOverlays(
      [...data.districts, data.zones[0]!],
      [],
      () => ({ x: 100, y: 100 }),
      { width: 400, height: 400 },
      'apgujeong',
    );
    expect(
      placed.labels.find((x) => x.item.id === 'apgujeong')?.showLabel,
    ).toBe(true);
    expect(placed.labels.filter((x) => x.showLabel)).toHaveLength(1);
  });
});
describe('substitutable fixture camera', () => {
  it('centers in unobscured frame and refits after resize without invalid zero frames', () => {
    const spot = { lat: 37.5, lng: 127.01 };
    const map = new FixtureMapAdapter();
    map.setViewport(
      { width: 1200, height: 800 },
      { x: 400, y: 80, width: 700, height: 620 },
    );
    map.center(spot, 12.9);
    expect(map.project(spot).x).toBeCloseTo(750, 6);
    expect(map.project(spot).y).toBeCloseTo(390, 6);
    map.setViewport(
      { width: 1200, height: 800 },
      { x: 800, y: 80, width: 300, height: 620 },
    );
    expect(map.project(spot).x).toBeCloseTo(950, 6);
    expect(map.project(spot).y).toBeCloseTo(390, 6);
    map.setViewport(
      { width: 320, height: 200 },
      { x: 0, y: 0, width: 0, height: 0 },
    );
    expect(Number.isFinite(map.getSnapshot().center.lat)).toBe(true);
    expect(Number.isFinite(map.getSnapshot().center.lng)).toBe(true);
  });
  it('preserves camera for pin selections, clamps zoom and uses district fit limits', () => {
    const map = new FixtureMapAdapter();
    map.setViewport(
      { width: 1000, height: 800 },
      { x: 0, y: 0, width: 1000, height: 800 },
    );
    map.center({ lat: 37.5, lng: 127.02 }, 15);
    map.releaseAnchor();
    const before = map.getSnapshot();
    map.setViewport(
      { width: 1000, height: 800 },
      { x: 400, y: 0, width: 600, height: 800 },
    );
    expect(map.getSnapshot().center).toEqual(before.center);
    map.zoom(100);
    expect(map.getSnapshot().zoom).toBe(17);
    map.zoom(-100);
    expect(map.getSnapshot().zoom).toBe(9.5);
    map.fit(data.districts[0]!.bounds, 48, [12.55, 13.5]);
    expect(map.getSnapshot().zoom).toBeGreaterThanOrEqual(12.55);
    expect(map.getSnapshot().zoom).toBeLessThanOrEqual(13.5);
  });
  it('cleans subscribers and ignores later mutations after destroy', () => {
    const map = new FixtureMapAdapter();
    let count = 0;
    const off = map.subscribe(() => count++);
    map.zoom(1);
    expect(count).toBe(1);
    off();
    map.zoom(1);
    expect(count).toBe(1);
    map.destroy();
    const final = map.getSnapshot();
    map.zoom(-1);
    expect(map.getSnapshot()).toBe(final);
  });
});

it('reserves the complete selected apartment name before placing neighboring names', () => {
  const selected = {
    ...fixtures.apartments[0]!,
    id: 'long',
    name: '아주 긴 이름을 가진 압구정 재건축 검토 단지 이름',
    point: { lat: 250, lng: 250 },
  };
  const other = {
    ...fixtures.apartments[1]!,
    id: 'other',
    name: '다른 단지',
    point: { lat: 250, lng: 395 },
  };
  const placed = layoutOverlays(
    [],
    [selected, other],
    (point) => ({ x: point.lng, y: point.lat }),
    { width: 600, height: 400 },
    undefined,
    'long',
  );
  expect(placed.pins.find((x) => x.item.id === 'long')?.showName).toBe(true);
  expect(placed.pins.find((x) => x.item.id === 'other')?.showName).toBe(false);
});
