/** Validated read models for the current BE contract, not generated OpenAPI types. */
export type MapPoint = { longitude: number; latitude: number };
export type MapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};
export type Position = [longitude: number, latitude: number];
export type PolygonCoordinates = Position[][];
export type MapGeometry =
  | { type: 'Polygon'; coordinates: PolygonCoordinates }
  | { type: 'MultiPolygon'; coordinates: PolygonCoordinates[] };

export type MapCity = {
  id: string;
  regionCode: string;
  regionName: string;
  name: string;
  center: MapPoint;
  bounds: MapBounds;
  zoneCount: number;
  initialTierZoneCount: number;
  voteTierZoneCount: number;
  initialTier: number | null;
  voteTier: number | null;
};

export type MapZone = {
  id: string;
  cityId: string;
  cityName: string;
  regionCode: string;
  regionName: string;
  name: string;
  center: MapPoint;
  initialTier: number | null;
  voteTier: number | null;
  rankingBasis: 'INITIAL' | 'VOTE';
  initialRank: number | null;
  initialRankTotal: number;
  voteRank: number | null;
  voteRankTotal: number;
  complexCount: number;
  validVoteCount: number;
};

export type MapComplexPin = {
  id: string;
  zoneId: string;
  cityName: string;
  zoneName: string;
  name: string;
  location: MapPoint;
  households: number;
};

export type MapComplex = {
  id: string;
  name: string;
  zoneRank: number | null;
  score: number | null;
  /** Ten thousand KRW; not a price per square meter. */
  price: number | null;
  representativeArea: number | null;
  lastDealDate: string | null;
  approvalDate: string | null;
  households: number;
  voteCandidate: boolean;
};

export type MapZoneDetail = {
  zone: MapZone;
  polygon: MapGeometry;
  complexes: MapComplex[];
};

export type MapSearch = {
  cities: MapCity[];
  zones: MapZone[];
  complexes: MapComplexPin[];
};
