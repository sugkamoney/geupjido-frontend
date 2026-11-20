import type { createMapApi } from './client';
import type { MapCity, MapZone, MapComplexPin, MapBounds } from './contracts';
import { geometryBounds } from './validation';
import type {
  ExplorationData,
  Zone,
  MapLabel,
  Apartment,
  ExplorationSource,
  GeoBounds,
} from '../types';
import type { Grade } from '../../../components/ui/grade';
import type { SearchSource } from '../../search/source';
import {
  highlightParts,
  type SearchGroup,
  type SearchTarget,
  type HighlightPart,
} from '../../search/model';

export const geoBounds = (b: MapBounds): GeoBounds => ({
  sw: { lat: b.south, lng: b.west },
  ne: { lat: b.north, lng: b.east },
});
function tier(value: number | null) {
  return {
    grade:
      value !== null && value >= 1 && value < 6
        ? (Math.floor(value) as Grade)
        : undefined,
    value: value === null ? '정보 없음' : value.toFixed(1),
  };
}
function toCity(city: MapCity): MapLabel {
  return {
    id: city.id,
    kind: 'gu',
    name: city.name,
    region: city.regionName,
    point: { lat: city.center.latitude, lng: city.center.longitude },
    bounds: geoBounds(city.bounds),
    ...tier(city.initialTier),
    detail: `초기 급지 평균 · ${city.initialTierZoneCount}개 권역`,
    live: true,
  };
}
export function cityData(cities: MapCity[]): ExplorationData {
  if (!cities.length) throw new Error('No service cities');
  return {
    districts: cities.map(toCity),
    zones: [],
    apartments: [],
    overview: geoBounds({
      west: Math.min(...cities.map((c) => c.bounds.west)),
      south: Math.min(...cities.map((c) => c.bounds.south)),
      east: Math.max(...cities.map((c) => c.bounds.east)),
      north: Math.max(...cities.map((c) => c.bounds.north)),
    }),
  };
}
export function toZone(zone: MapZone): Zone {
  return {
    id: zone.id,
    kind: 'zone',
    name: zone.name,
    district: zone.cityName,
    region: zone.regionName,
    point: { lat: zone.center.latitude, lng: zone.center.longitude },
    ...tier(zone.initialTier),
    detail:
      zone.initialRank === null
        ? '초기 급지 순위 정보 없음'
        : `초기 급지 ${zone.initialRank}위 / ${zone.initialRankTotal}곳`,
    rating: zone,
    live: true,
  };
}
export function toApartment(pin: MapComplexPin): Apartment {
  return {
    id: pin.id,
    zoneId: pin.zoneId,
    name: pin.name,
    point: { lat: pin.location.latitude, lng: pin.location.longitude },
    households: pin.households,
    live: true,
  };
}
function splitHighlights(context: string, name: string, query: string) {
  const parts = highlightParts(`${context} ${name}`, query);
  function slice(start: number, end: number): HighlightPart[] {
    let offset = 0;
    return parts.flatMap((part) => {
      const from = Math.max(0, start - offset),
        to = Math.min(part.text.length, end - offset);
      offset += part.text.length;
      return to > from
        ? [{ text: part.text.slice(from, to), match: part.match }]
        : [];
    });
  }
  return {
    contextParts: slice(0, context.length),
    nameParts: slice(context.length + 1, context.length + 1 + name.length),
  };
}
export function createLiveSources(api: ReturnType<typeof createMapApi>): {
  source: ExplorationSource;
  searchSource: SearchSource;
} {
  return {
    source: {
      async loadZone(id, signal) {
        const detail = await api.zone(id, signal);
        const bbox = geometryBounds(detail.polygon);
        let pins: MapComplexPin[] = [],
          locationLookupFailed = false;
        try {
          pins = await api.complexes(
            {
              west: Math.max(-180, bbox.west - 0.000001),
              south: Math.max(-90, bbox.south - 0.000001),
              east: Math.min(180, bbox.east + 0.000001),
              north: Math.min(90, bbox.north + 0.000001),
            },
            signal,
          );
        } catch (error) {
          signal.throwIfAborted();
          if (error instanceof Error && error.name === 'AbortError')
            throw error;
          locationLookupFailed = true;
        }
        signal.throwIfAborted();
        const locations = new Map(
          pins.filter((p) => p.zoneId === id).map((p) => [p.id, p.location]),
        );
        return {
          zone: { ...toZone(detail.zone), geometry: detail.polygon },
          locationLookupFailed,
          apartments: detail.complexes.map((c) => {
            const p = locations.get(c.id);
            return {
              id: c.id,
              zoneId: id,
              name: c.name,
              households: c.households,
              point: p ? { lat: p.latitude, lng: p.longitude } : undefined,
              rank: c.zoneRank,
              priceManwon: c.price,
              areaM2: c.representativeArea,
              year: c.approvalDate
                ? Number(c.approvalDate.slice(0, 4))
                : undefined,
              live: true,
            };
          }),
        };
      },
    },
    searchSource: {
      debounceMs: 200,
      maxLength: 80,
      async search(query, signal) {
        const result = await api.search(query, signal);
        const groups: SearchGroup[] = [];
        const add = (
          kind: SearchGroup['kind'],
          rows: { target: SearchTarget; context: string }[],
        ) => {
          if (rows.length)
            groups.push({
              kind,
              results: rows.map(({ target, context }) => ({
                id: target.item.id,
                name: target.item.name,
                context,
                position: 0,
                target,
                ...splitHighlights(context, target.item.name, query),
              })),
            });
        };
        add(
          'zone',
          result.zones.map((z) => ({
            target: { kind: 'zone', item: toZone(z) },
            context: z.cityName,
          })),
        );
        add(
          'gu',
          result.cities.map((c) => ({
            target: { kind: 'gu', item: toCity(c) },
            context: `권역 ${c.zoneCount}곳`,
          })),
        );
        add(
          'apartment',
          result.complexes.map((p) => ({
            target: { kind: 'apartment', item: toApartment(p) },
            context: `${p.cityName} ${p.zoneName}`,
          })),
        );
        return groups;
      },
    },
  };
}
