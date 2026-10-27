import type { MapFrame } from '../../components/app-shell/types';
import type { Grade, GradeStageName } from '../../components/ui/grade';

/** Screen pixel only; map positions use LatLng. */
export type Point = { x: number; y: number };
/** WGS84 coordinate. */
export type LatLng = { lat: number; lng: number };
export type Size = { width: number; height: number };
export type GeoBounds = { sw: LatLng; ne: LatLng };
export type MapLabel = {
  id: string;
  kind: 'gu' | 'zone';
  name: string;
  district?: string;
  point: LatLng;
  area: number;
  bounds: GeoBounds;
  grade: Grade;
  value: string;
  detail: string;
  stage?: GradeStageName;
};
export type Zone = MapLabel & { kind: 'zone'; polygon: LatLng[] };
export type Apartment = {
  id: string;
  zoneId: string;
  name: string;
  point: LatLng;
  households: number;
  year?: number;
  priceManwon?: number;
  areaM2?: number;
};
export type ExplorationData = {
  districts: MapLabel[];
  zones: Zone[];
  apartments: Apartment[];
  overview: GeoBounds;
};
export type ZoneDetail = { zone: Zone; apartments: Apartment[] };
export type ExplorationSource = {
  loadZone: (id: string, signal: AbortSignal) => Promise<ZoneDetail>;
};
export type Camera = { center: LatLng; zoom: number; revision: number };
export type MapStatus =
  'loading' | 'ready' | 'auth-error' | 'network-error' | 'config-error';
export interface MapAdapter {
  /** 입력 모드·고지 문구·grid 배경을 결정하는 capability. 빌드 env가 아니라 실제 adapter를 따른다. */
  readonly kind: 'naver' | 'fixture';
  getSnapshot: () => Camera;
  /** camera와 status 변경 모두에 호출된다. */
  subscribe: (listener: () => void) => () => void;
  /** 값이 바뀔 때만 새 값을 반환한다. fixture는 항상 'ready'. */
  getStatus: () => MapStatus;
  /** fixture: no-op. */
  mount: (container: HTMLElement) => void;
  /** fixture: no-op. */
  retry: () => void;
  setViewport: (size: Size, frame: MapFrame) => void;
  project: (point: LatLng) => Point;
  unproject: (point: Point) => LatLng;
  center: (target: LatLng, zoom?: number, animate?: boolean) => void;
  fit: (
    bounds: GeoBounds,
    padding?: number,
    zoomLimits?: [number, number],
    animate?: boolean,
  ) => void;
  zoom: (delta: number, around?: Point, animate?: boolean) => void;
  /** 화면 pixel 이동량. */
  pan: (delta: Point) => void;
  releaseAnchor: () => void;
  destroy: () => void;
  /** SDK가 처리한 사용자 조작 시작 알림. fixture는 구현하지 않는다. */
  noteUserGesture?: () => void;
  /**
   * overlay(면·라벨·핀·hover)를 portal로 렌더할 SDK 내부 요소. 대상 위에서 시작한
   * 드래그·휠이 SDK 입력 요소로 bubble되게 한다. ready일 때만 값이 있다. fixture는 구현하지 않는다.
   */
  getOverlayHost?: () => HTMLElement | undefined;
}
