import type { components } from './generated';

/** Pinned deployed OpenAPI types; network values still pass runtime validation. */
export type MapPoint = components['schemas']['Point'];
export type MapBounds = components['schemas']['Bounds'];
export type MapCity = components['schemas']['City'];
export type MapZone = components['schemas']['MapZone'];
export type MapComplexPin = components['schemas']['ComplexPin'];
/** price is in ten thousand KRW, not a price per square meter. */
export type MapComplex = components['schemas']['MapComplex'];
export type MapSearch = components['schemas']['SearchResult'];

export type Position = [longitude: number, latitude: number];
export type PolygonCoordinates = Position[][];
/** Require two-dimensional positions and retain legacy Polygon compatibility. */
export type MapGeometry =
  | { type: 'Polygon'; coordinates: PolygonCoordinates }
  | { type: 'MultiPolygon'; coordinates: PolygonCoordinates[] };
export type MapZoneDetail = Omit<
  components['schemas']['ZoneDetailResponse'],
  'polygon'
> & { polygon: MapGeometry };
