import type {
  MapBounds,
  MapCity,
  MapComplex,
  MapComplexPin,
  MapGeometry,
  MapPoint,
  MapSearch,
  MapZone,
  MapZoneDetail,
  PolygonCoordinates,
  Position,
} from './contracts';

export class MapContractError extends Error {
  constructor(path: string) {
    super(`Invalid map API data at ${path}`);
    this.name = 'MapContractError';
  }
}

type Parser<T> = (value: unknown, path: string) => T;
export function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new MapContractError(path);
  return value as Record<string, unknown>;
}
export function array<T>(value: unknown, path: string, parse: Parser<T>): T[] {
  if (!Array.isArray(value)) throw new MapContractError(path);
  return value.map((item, index) => parse(item, `${path}[${index}]`));
}
const string: Parser<string> = (value, path) => {
  if (typeof value !== 'string' || !value.trim())
    throw new MapContractError(path);
  return value;
};
const number: Parser<number> = (value, path) => {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new MapContractError(path);
  return value;
};
const area: Parser<number> = (value, path) => {
  const n = number(value, path);
  if (n < 0) throw new MapContractError(path);
  return n;
};
export const count: Parser<number> = (value, path) => {
  const n = number(value, path);
  if (!Number.isSafeInteger(n) || n < 0) throw new MapContractError(path);
  return n;
};
const rank: Parser<number> = (value, path) => {
  const n = count(value, path);
  if (n === 0) throw new MapContractError(path);
  return n;
};
const boolean: Parser<boolean> = (value, path) => {
  if (typeof value !== 'boolean') throw new MapContractError(path);
  return value;
};
const date: Parser<string> = (value, path) => {
  const s = string(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new MapContractError(path);
  const parsed = new Date(`${s}T00:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== s
  )
    throw new MapContractError(path);
  return s;
};
export function nullable<T>(
  value: unknown,
  path: string,
  parse: Parser<T>,
): T | null {
  return value === null ? null : parse(value, path);
}
const point: Parser<MapPoint> = (value, path) => {
  const v = object(value, path);
  const longitude = number(v.longitude, `${path}.longitude`);
  const latitude = number(v.latitude, `${path}.latitude`);
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90)
    throw new MapContractError(path);
  return { longitude, latitude };
};

export function parseBounds(value: unknown, path = 'bounds'): MapBounds {
  const v = object(value, path);
  const west = number(v.west, `${path}.west`),
    south = number(v.south, `${path}.south`);
  const east = number(v.east, `${path}.east`),
    north = number(v.north, `${path}.north`);
  if (
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90 ||
    west >= east ||
    south >= north
  )
    throw new MapContractError(path);
  return { west, south, east, north };
}

const city: Parser<MapCity> = (value, path) => {
  const v = object(value, path);
  return {
    id: string(v.id, `${path}.id`),
    regionCode: string(v.regionCode, `${path}.regionCode`),
    regionName: string(v.regionName, `${path}.regionName`),
    name: string(v.name, `${path}.name`),
    center: point(v.center, `${path}.center`),
    bounds: parseBounds(v.bounds, `${path}.bounds`),
    zoneCount: count(v.zoneCount, `${path}.zoneCount`),
    initialTierZoneCount: count(
      v.initialTierZoneCount,
      `${path}.initialTierZoneCount`,
    ),
    voteTierZoneCount: count(v.voteTierZoneCount, `${path}.voteTierZoneCount`),
    initialTier: nullable(v.initialTier, `${path}.initialTier`, number),
    voteTier: nullable(v.voteTier, `${path}.voteTier`, number),
  };
};
const zone: Parser<MapZone> = (value, path) => {
  const v = object(value, path);
  if (v.rankingBasis !== 'INITIAL' && v.rankingBasis !== 'VOTE')
    throw new MapContractError(`${path}.rankingBasis`);
  return {
    id: string(v.id, `${path}.id`),
    cityId: string(v.cityId, `${path}.cityId`),
    cityName: string(v.cityName, `${path}.cityName`),
    regionCode: string(v.regionCode, `${path}.regionCode`),
    regionName: string(v.regionName, `${path}.regionName`),
    name: string(v.name, `${path}.name`),
    center: point(v.center, `${path}.center`),
    areaSquareMeters: area(v.areaSquareMeters, `${path}.areaSquareMeters`),
    initialTier: nullable(v.initialTier, `${path}.initialTier`, number),
    voteTier: nullable(v.voteTier, `${path}.voteTier`, number),
    rankingBasis: v.rankingBasis,
    initialRank: nullable(v.initialRank, `${path}.initialRank`, rank),
    initialRankTotal: count(v.initialRankTotal, `${path}.initialRankTotal`),
    voteRank: nullable(v.voteRank, `${path}.voteRank`, rank),
    voteRankTotal: count(v.voteRankTotal, `${path}.voteRankTotal`),
    complexCount: count(v.complexCount, `${path}.complexCount`),
    validVoteCount: count(v.validVoteCount, `${path}.validVoteCount`),
  };
};
const pin: Parser<MapComplexPin> = (value, path) => {
  const v = object(value, path);
  return {
    id: string(v.id, `${path}.id`),
    zoneId: string(v.zoneId, `${path}.zoneId`),
    cityName: string(v.cityName, `${path}.cityName`),
    zoneName: string(v.zoneName, `${path}.zoneName`),
    name: string(v.name, `${path}.name`),
    location: point(v.location, `${path}.location`),
    households: count(v.households, `${path}.households`),
  };
};
const complex: Parser<MapComplex> = (value, path) => {
  const v = object(value, path);
  return {
    location: nullable(v.location, `${path}.location`, point),
    id: string(v.id, `${path}.id`),
    name: string(v.name, `${path}.name`),
    zoneRank: nullable(v.zoneRank, `${path}.zoneRank`, rank),
    score: nullable(v.score, `${path}.score`, number),
    price: nullable(v.price, `${path}.price`, count),
    representativeArea: nullable(
      v.representativeArea,
      `${path}.representativeArea`,
      number,
    ),
    lastDealDate: nullable(v.lastDealDate, `${path}.lastDealDate`, date),
    approvalDate: nullable(v.approvalDate, `${path}.approvalDate`, date),
    households: count(v.households, `${path}.households`),
    voteCandidate: boolean(v.voteCandidate, `${path}.voteCandidate`),
  };
};

const position: Parser<Position> = (value, path) => {
  if (!Array.isArray(value) || value.length !== 2)
    throw new MapContractError(path);
  const p = point({ longitude: value[0], latitude: value[1] }, path);
  return [p.longitude, p.latitude];
};
const ring: Parser<Position[]> = (value, path) => {
  const points = array(value, path, position);
  if (points.length < 4) throw new MapContractError(path);
  const first = points[0]!,
    last = points[points.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1])
    throw new MapContractError(path);
  return points;
};
const polygon: Parser<PolygonCoordinates> = (value, path) => {
  const rings = array(value, path, ring);
  if (!rings.length) throw new MapContractError(path);
  return rings;
};
function geometry(value: unknown, path: string): MapGeometry {
  const v = object(value, path);
  if (v.type === 'Polygon')
    return {
      type: 'Polygon',
      coordinates: polygon(v.coordinates, `${path}.coordinates`),
    };
  if (v.type === 'MultiPolygon') {
    const coordinates = array(v.coordinates, `${path}.coordinates`, polygon);
    if (!coordinates.length) throw new MapContractError(`${path}.coordinates`);
    return { type: 'MultiPolygon', coordinates };
  }
  throw new MapContractError(`${path}.type`);
}

export function geometryBounds(value: MapGeometry): MapBounds {
  const polygons =
    value.type === 'Polygon' ? [value.coordinates] : value.coordinates;
  let west = Infinity,
    south = Infinity,
    east = -Infinity,
    north = -Infinity;
  for (const rings of polygons)
    for (const [lng, lat] of rings[0] ?? []) {
      west = Math.min(west, lng);
      south = Math.min(south, lat);
      east = Math.max(east, lng);
      north = Math.max(north, lat);
    }
  return parseBounds({ west, south, east, north }, 'polygon.bounds');
}

export const parseCities = (value: unknown): MapCity[] =>
  array(value, 'cities', city);
export const parseZones = (value: unknown): MapZone[] =>
  array(value, 'zones', zone);
export const parseComplexPins = (value: unknown): MapComplexPin[] =>
  array(value, 'complexes', pin);
export function parseZoneDetail(value: unknown): MapZoneDetail {
  const v = object(value, 'detail');
  return {
    zone: zone(v.zone, 'detail.zone'),
    polygon: geometry(v.polygon, 'detail.polygon'),
    complexes: array(v.complexes, 'detail.complexes', complex),
  };
}
export function parseSearch(value: unknown): MapSearch {
  const v = object(value, 'search');
  return {
    cities: parseCities(v.cities),
    zones: parseZones(v.zones),
    complexes: parseComplexPins(v.complexes),
  };
}
