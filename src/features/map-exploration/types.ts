import type { MapFrame } from '../../components/app-shell/types';
import type { Grade, GradeStageName } from '../../components/ui/grade';

/** Fixture coordinates are local planar units, never longitude/latitude. */
export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Bounds = { min: Point; max: Point };
export type MapLabel = {
  id: string;
  kind: 'gu' | 'zone';
  name: string;
  district?: string;
  point: Point;
  area: number;
  bounds: Bounds;
  grade: Grade;
  value: string;
  detail: string;
  stage?: GradeStageName;
};
export type Zone = MapLabel & { kind: 'zone'; polygon: Point[] };
export type Apartment = {
  id: string;
  zoneId: string;
  name: string;
  point: Point;
  households: number;
  year?: number;
  priceManwon?: number;
  areaM2?: number;
};
export type ExplorationData = {
  districts: MapLabel[];
  zones: Zone[];
  apartments: Apartment[];
  overview: Bounds;
};
export type ZoneDetail = { zone: Zone; apartments: Apartment[] };
export type ExplorationSource = {
  loadZone: (id: string, signal: AbortSignal) => Promise<ZoneDetail>;
};
export type Camera = { center: Point; zoom: number; revision: number };
export interface MapAdapter {
  getSnapshot: () => Camera;
  subscribe: (listener: () => void) => () => void;
  setViewport: (size: Size, frame: MapFrame) => void;
  project: (point: Point) => Point;
  unproject: (point: Point) => Point;
  center: (point: Point, zoom?: number) => void;
  fit: (
    bounds: Bounds,
    padding?: number,
    zoomLimits?: [number, number],
  ) => void;
  zoom: (delta: number, around?: Point) => void;
  pan: (delta: Point) => void;
  releaseAnchor: () => void;
  destroy: () => void;
}
