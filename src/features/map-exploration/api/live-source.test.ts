import { describe, expect, it, vi } from 'vitest';
import { createLiveSources, cityData, toZone } from './live-source';
import {
  cityRecord,
  zoneRecord,
  pinRecord,
  detailRecord,
  complexRecord,
  polygonRecord,
} from './test-data';
import { parseCities, parseZoneDetail, parseZones } from './validation';
import type { createMapApi } from './client';
import { layoutOverlays } from '../model';

function backend() {
  return {
    cities: vi.fn(async () => parseCities([cityRecord])),
    zones: vi.fn(async () => parseZones([zoneRecord])),
    complexes: vi.fn(async () => [pinRecord]),
    zone: vi.fn(async () => parseZoneDetail(detailRecord)),
    search: vi.fn(async () => ({
      cities: [cityRecord],
      zones: parseZones([zoneRecord]),
      complexes: [pinRecord],
    })),
  } satisfies ReturnType<typeof createMapApi>;
}
describe('live exploration sources', () => {
  it('uses real city bounds and preserves missing initial tier without inventing geometry or area', () => {
    expect(cityData(parseCities([cityRecord])).overview).toEqual({
      sw: { lat: 37, lng: 126 },
      ne: { lat: 38, lng: 128 },
    });
    const zone = toZone(parseZones([{ ...zoneRecord, initialTier: null }])[0]!);
    expect(zone).toMatchObject({
      value: '정보 없음',
      grade: undefined,
      rating: { initialTier: null, voteTier: null },
    });
    expect(zone.bounds).toBeUndefined();
    expect(zone.area).toBe(2685802.872975988);
    expect(zone.geometry).toBeUndefined();
  });
  it('prioritizes selected then larger measured zones when live labels overlap', () => {
    const zones = parseZones([
      { ...zoneRecord, id: 'a-small', areaSquareMeters: 1500000 },
      { ...zoneRecord, id: 'z-large', areaSquareMeters: 2600000.5 },
    ]).map(toZone);
    const layout = (selected?: string) =>
      layoutOverlays(
        zones,
        [],
        () => ({ x: 100, y: 100 }),
        { width: 500, height: 400 },
        selected,
      )
        .labels.filter((x) => x.showLabel)
        .map((x) => x.item.id);
    expect(layout()).toEqual(['z-large']);
    expect(layout('a-small')).toEqual(['a-small']);
  });
  it('uses detail locations directly, retains null-location rows and every ring', async () => {
    const api = backend();
    api.zone.mockResolvedValue(
      parseZoneDetail({
        ...detailRecord,
        complexes: [
          { ...complexRecord, location: pinRecord.location },
          { ...complexRecord, id: 'missing', location: null },
        ],
      }),
    );
    const result = await createLiveSources(api).source.loadZone(
      'zone-a',
      new AbortController().signal,
    );
    expect(result.zone.geometry).toEqual(polygonRecord);
    expect(result.apartments[0]).toMatchObject({
      point: { lat: 37.5, lng: 127.1 },
      rank: null,
      priceManwon: null,
    });
    expect(result.apartments[1]?.point).toBeUndefined();
    expect(api.complexes).not.toHaveBeenCalled();
  });
  it('propagates cancellation after detail resolution', async () => {
    const api = backend();
    const controller = new AbortController();
    api.zone.mockImplementation(async () => {
      controller.abort();
      return parseZoneDetail(detailRecord);
    });
    await expect(
      createLiveSources(api).source.loadZone('zone-a', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('highlights a direct name match before the repeated context match', async () => {
    const api = backend();
    api.search.mockResolvedValue({
      cities: [],
      zones: [],
      complexes: [{ ...pinRecord, name: '예시권역아파트' }],
    });
    const groups = await createLiveSources(api).searchSource.search(
      '예시권역',
      new AbortController().signal,
    );
    expect(groups[0]?.results[0]?.nameParts).toEqual([
      { text: '예시권역', match: true },
      { text: '아파트', match: false },
    ]);
    expect(groups[0]?.results[0]?.contextParts.every((p) => !p.match)).toBe(
      true,
    );
  });
  it('searches outside the viewport and returns lightweight apartment references without a fabricated zone', async () => {
    const groups = await createLiveSources(backend()).searchSource.search(
      '예시구예시',
      new AbortController().signal,
    );
    expect(groups.map((g) => g.kind)).toEqual(['zone', 'gu', 'apartment']);
    expect(groups[0]?.results[0]?.nameParts.some((p) => p.match)).toBe(true);
    const target = groups[2]?.results[0]?.target;
    expect(target).toMatchObject({
      kind: 'apartment',
      item: { zoneId: 'zone-a', point: { lat: 37.5, lng: 127.1 } },
    });
    expect(
      target && 'zone' in target ? target.zone : undefined,
    ).toBeUndefined();
  });
});
