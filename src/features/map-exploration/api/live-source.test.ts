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
    expect(zone.area).toBeUndefined();
    expect(zone.geometry).toBeUndefined();
  });
  it('joins detail locations by zone and ID and keeps real null ranks/prices and every ring', async () => {
    const api = backend();
    api.zone.mockResolvedValue(
      parseZoneDetail({
        ...detailRecord,
        complexes: [complexRecord, { ...complexRecord, id: 'missing' }],
      }),
    );
    api.complexes.mockResolvedValue([
      pinRecord,
      { ...pinRecord, id: 'missing', zoneId: 'other' },
    ]);
    const result = await createLiveSources(api).source.loadZone(
      'zone-a',
      new AbortController().signal,
    );
    expect(result.zone.geometry).toEqual(polygonRecord);
    expect(result.apartments[0]).toMatchObject({
      zoneId: 'zone-a',
      point: { lat: 37.5, lng: 127.1 },
      rank: null,
      priceManwon: null,
    });
    expect(result.apartments[1]?.point).toBeUndefined();
  });
  it('keeps detail usable when coordinate lookup fails and propagates cancellation', async () => {
    const api = backend();
    api.complexes.mockRejectedValue(new TypeError('Network error'));
    const sources = createLiveSources(api);
    const result = await sources.source.loadZone(
      'zone-a',
      new AbortController().signal,
    );
    expect(result.apartments).toHaveLength(1);
    expect(result.locationLookupFailed).toBe(true);
    expect(result.apartments[0]?.point).toBeUndefined();
    const controller = new AbortController();
    api.complexes.mockImplementation(async () => {
      controller.abort();
      throw controller.signal.reason;
    });
    await expect(
      sources.source.loadZone('zone-a', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
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
