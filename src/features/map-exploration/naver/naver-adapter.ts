import type { MapFrame } from '../../../components/app-shell/types';
import { fromWorldPixel, worldPixel } from '../mercator';
import type {
  Camera,
  GeoBounds,
  LatLng,
  MapAdapter,
  MapStatus,
  Point,
  Size,
} from '../types';
import type { NaverLoader } from './loader';

const MIN_ZOOM = 9.5;
const MAX_ZOOM = 17;
const OVERVIEW_LIMITS: [number, number] = [9.5, 12.49];
const FIT_PADDING = 48;
const DEFAULT_INIT_TIMEOUT_MS = 10000;
const PLACEHOLDER_ZOOM = 12;

const clamp = (value: number, min = MIN_ZOOM, max = MAX_ZOOM) =>
  Math.max(min, Math.min(max, value));
const finite = (...values: number[]) => values.every(Number.isFinite);

/**
 * 카메라 목적 하나. 준비 전에는 "보관한 목적", 준비 후에는 anchor/fit 기억으로 쓴다.
 * 사용자 조작·`releaseAnchor`·상대 명령이 지운다.
 */
type Intent =
  | { kind: 'center'; target: LatLng; zoom?: number }
  | {
      kind: 'fit';
      bounds: GeoBounds;
      padding: number;
      limits: [number, number];
    }
  | undefined;

/** adapter 자신이 시작한 진행 중 애니메이션 이동. */
type Motion = { center: LatLng; zoom: number; moved: boolean };

type MapPhase = 'loading' | 'ready' | 'network-error';

const defaultGetMaps = () =>
  (window as unknown as { naver: typeof naver }).naver.maps;

function readCoord(coord: naver.maps.Coord): LatLng {
  const c = coord as unknown as {
    x: number;
    y: number;
    lat?: unknown;
    lng?: unknown;
  };
  if (typeof c.lat === 'function' && typeof c.lng === 'function')
    return { lat: (c.lat as () => number)(), lng: (c.lng as () => number)() };
  return { lat: c.y, lng: c.x };
}

export class NaverMapAdapter implements MapAdapter {
  readonly kind = 'naver' as const;

  private readonly loader: NaverLoader;
  private readonly overview: GeoBounds;
  private readonly getMaps: () => typeof naver.maps;
  private readonly initTimeoutMs: number;
  private readonly unsubscribeLoader: () => void;

  private listeners = new Set<() => void>();
  private destroyed = false;
  private container: HTMLElement | undefined;
  private maps: typeof naver.maps | undefined;
  private map: naver.maps.Map | undefined;
  private mapListeners: naver.maps.MapEventListener[] = [];
  /** 지도 생성 시도 번호. 늦게 도착한 이전 지도의 콜백을 무시하는 데 쓴다. */
  private attempt = 0;
  private phase: MapPhase = 'loading';
  private initSeen = false;
  private initTimer: ReturnType<typeof setTimeout> | undefined;
  private status: MapStatus;

  private camera: Camera;
  private size: Size = { width: 0, height: 0 };
  private frame: MapFrame = { x: 0, y: 0, width: 0, height: 0 };
  private intent: Intent;
  private motion: Motion | undefined;

  constructor(options: {
    loader: NaverLoader;
    overview: GeoBounds;
    getMaps?: () => typeof naver.maps;
    initTimeoutMs?: number;
  }) {
    this.loader = options.loader;
    this.overview = options.overview;
    this.getMaps = options.getMaps ?? defaultGetMaps;
    this.initTimeoutMs = options.initTimeoutMs ?? DEFAULT_INIT_TIMEOUT_MS;
    const { sw, ne } = options.overview;
    this.camera = {
      center: { lat: (sw.lat + ne.lat) / 2, lng: (sw.lng + ne.lng) / 2 },
      zoom: PLACEHOLDER_ZOOM,
      revision: 0,
    };
    this.intent = this.overviewIntent();
    this.status = this.computeStatus();
    this.unsubscribeLoader = this.loader.subscribe(() => this.onLoader());
  }

  getSnapshot = () => this.camera;
  getStatus = (): MapStatus => this.status;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  mount(container: HTMLElement) {
    if (this.destroyed) return;
    if (this.container !== container) {
      if (this.map) this.teardownMap();
      this.phase = 'loading';
      this.container = container;
    }
    this.loader.start();
    this.onLoader();
  }

  retry() {
    if (this.destroyed) return;
    this.teardownMap();
    this.phase = 'loading';
    this.loader.retry();
    this.onLoader();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.teardownMap();
    this.unsubscribeLoader();
    this.loader.dispose();
    this.listeners.clear();
    this.intent = undefined;
  }

  noteUserGesture = () => {
    this.releaseAnchor();
  };

  // ---------------------------------------------------------------- status

  private computeStatus(): MapStatus {
    const loaderStatus = this.loader.getStatus();
    return loaderStatus === 'ready' ? this.phase : loaderStatus;
  }

  private refreshStatus() {
    if (this.destroyed) return;
    const next = this.computeStatus();
    if (next === this.status) return;
    this.status = next;
    this.notify();
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private get live(): boolean {
    return this.phase === 'ready' && this.map !== undefined;
  }

  private onLoader() {
    if (this.destroyed) return;
    if (
      this.loader.getStatus() === 'ready' &&
      this.container &&
      !this.map &&
      this.phase === 'loading'
    )
      this.createMap(this.container);
    this.refreshStatus();
  }

  private createMap(container: HTMLElement) {
    const attempt = ++this.attempt;
    this.initSeen = false;
    let maps: typeof naver.maps;
    let map: naver.maps.Map;
    try {
      maps = this.getMaps();
      map = new maps.Map(container, {
        gl: true,
        center: new maps.LatLng(this.camera.center.lat, this.camera.center.lng),
        zoom: this.camera.zoom,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        // 화살표·+/- 키는 지도 region이 adapter.pan/zoom으로 처리한다.
        keyboardShortcuts: false,
      });
    } catch {
      this.phase = 'network-error';
      return;
    }
    this.maps = maps;
    this.map = map;
    this.sdkSetSize(this.size);
    const on = (name: string, fn: () => void) =>
      this.mapListeners.push(
        maps.Event.addListener(map, name, () => {
          if (!this.destroyed && attempt === this.attempt) fn();
        }),
      );
    on('init', () => {
      this.initSeen = true;
      this.tryReady();
    });
    on('center_changed', () => this.onCameraEvent());
    on('zoom_changed', () => this.onCameraEvent());
    on('idle', () => {
      if (this.phase === 'loading') this.tryReady();
      else if (this.motion?.moved) this.motion = undefined;
    });
    on('dragstart', () => this.noteUserGesture());
    on('pinchstart', () => this.noteUserGesture());
    this.initTimer = setTimeout(() => {
      this.initTimer = undefined;
      if (this.destroyed || attempt !== this.attempt) return;
      this.tryReady();
      if (this.phase !== 'loading') return;
      this.phase = 'network-error';
      this.refreshStatus();
    }, this.initTimeoutMs);
  }

  private clearInitTimer() {
    if (this.initTimer !== undefined) clearTimeout(this.initTimer);
    this.initTimer = undefined;
  }

  private teardownMap() {
    this.attempt++;
    this.clearInitTimer();
    if (this.maps && this.mapListeners.length)
      this.maps.Event.removeListener(this.mapListeners);
    this.mapListeners = [];
    try {
      this.map?.destroy();
    } catch {
      // 이미 정리된 지도는 무시한다.
    }
    this.map = undefined;
    this.maps = undefined;
    this.motion = undefined;
    this.initSeen = false;
  }

  private projectionValid(): boolean {
    try {
      const p = this.sdkProject(this.camera.center);
      return !!p && finite(p.x, p.y);
    } catch {
      return false;
    }
  }

  /** `init`과 유효한 projection이 모두 확인되면 ready로 전환하고 보관 목적을 적용한다. */
  private tryReady() {
    if (this.phase !== 'loading' || !this.initSeen || !this.map) return;
    if (!this.projectionValid()) return;
    this.clearInitTimer();
    this.phase = 'ready';
    const intent = this.intent ?? this.overviewIntent();
    this.intent = undefined;
    if (intent?.kind === 'fit')
      this.fit(intent.bounds, intent.padding, intent.limits, false);
    else if (intent) this.center(intent.target, intent.zoom, false);
    this.syncCamera(true);
    this.refreshStatus();
  }

  private overviewIntent(): Intent {
    return {
      kind: 'fit',
      bounds: this.overview,
      padding: FIT_PADDING,
      limits: OVERVIEW_LIMITS,
    };
  }

  // ---------------------------------------------------------------- camera

  /**
   * SDK 카메라 이벤트. 프로그램 이동과 사용자 이동을 이 이벤트로 추정하지 않는다
   * (사용자 조작은 dragstart/pinchstart/noteUserGesture로만 판단한다).
   */
  private onCameraEvent() {
    if (this.phase === 'loading') {
      this.tryReady();
      return;
    }
    this.syncCamera(true);
    const motion = this.motion;
    if (!motion) return;
    motion.moved = true;
    const { center, zoom } = this.camera;
    if (
      Math.abs(center.lat - motion.center.lat) < 1e-7 &&
      Math.abs(center.lng - motion.center.lng) < 1e-7 &&
      Math.abs(zoom - motion.zoom) < 1e-3
    )
      this.motion = undefined;
  }

  private syncCamera(force = false) {
    if (!this.map || this.destroyed) return;
    let center: LatLng, zoom: number;
    try {
      center = readCoord(this.map.getCenter());
      zoom = this.map.getZoom();
    } catch {
      return;
    }
    if (!finite(center.lat, center.lng, zoom)) return;
    const prev = this.camera;
    if (
      !force &&
      prev.center.lat === center.lat &&
      prev.center.lng === center.lng &&
      prev.zoom === zoom
    )
      return;
    this.camera = { center, zoom, revision: prev.revision + 1 };
    this.notify();
  }

  private currentZoom(): number {
    if (this.live) {
      const zoom = this.map!.getZoom();
      if (Number.isFinite(zoom)) return zoom;
    }
    return this.camera.zoom;
  }

  private cancelMotion() {
    if (!this.motion) return;
    this.motion = undefined;
    this.sdkStop();
  }

  private move(center: LatLng, zoom: number, animate: boolean) {
    this.cancelMotion();
    if (!this.live || !finite(center.lat, center.lng, zoom)) return;
    zoom = clamp(zoom);
    const reduced =
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (animate && !reduced) {
      this.motion = { center, zoom, moved: false };
      this.sdkMorph(center, zoom);
    } else this.sdkJump(center, zoom);
    this.syncCamera();
  }

  /** Center of the unobscured frame, or of the whole viewport when the frame is empty. */
  private frameCenter(): Point {
    return this.frame.width > 0 && this.frame.height > 0
      ? {
          x: this.frame.x + this.frame.width / 2,
          y: this.frame.y + this.frame.height / 2,
        }
      : { x: this.size.width / 2, y: this.size.height / 2 };
  }

  /**
   * `zoom`에서 `point`가 화면 `pixel`에 오게 하는 카메라 중심.
   * 현재 zoom의 projection offset을 `2^(현재-목표)`로 환산해 계산하므로 SDK 타일 크기에
   * 의존하지 않는다.
   */
  private centerFor(point: LatLng, pixel: Point, zoom: number): LatLng {
    const scale = 2 ** (this.currentZoom() - zoom);
    const p = this.project(point);
    return this.unproject({
      x: p.x - (pixel.x - this.size.width / 2) * scale,
      y: p.y - (pixel.y - this.size.height / 2) * scale,
    });
  }

  private mercatorOrigin(): Point {
    const c = worldPixel(this.camera.center, this.camera.zoom);
    return { x: c.x - this.size.width / 2, y: c.y - this.size.height / 2 };
  }

  project = (point: LatLng): Point => {
    if (this.live) {
      try {
        const p = this.sdkProject(point);
        if (p && finite(p.x, p.y)) return p;
      } catch {
        // fall through
      }
    }
    const world = worldPixel(point, this.camera.zoom),
      origin = this.mercatorOrigin();
    return { x: world.x - origin.x, y: world.y - origin.y };
  };

  unproject = (point: Point): LatLng => {
    if (this.live) {
      try {
        const c = this.sdkUnproject(point);
        if (c && finite(c.lat, c.lng)) return c;
      } catch {
        // fall through
      }
    }
    const origin = this.mercatorOrigin();
    return fromWorldPixel(
      { x: point.x + origin.x, y: point.y + origin.y },
      this.camera.zoom,
    );
  };

  setViewport(size: Size, frame: MapFrame) {
    if (
      this.destroyed ||
      (size.width === this.size.width &&
        size.height === this.size.height &&
        Object.keys(frame).every(
          (k) => frame[k as keyof MapFrame] === this.frame[k as keyof MapFrame],
        ))
    )
      return;
    const destinationZoom = this.motion?.zoom;
    this.size = size;
    this.frame = frame;
    this.sdkSetSize(size);
    if (!this.live) return;
    const intent = this.intent;
    if (frame.width <= 0 || frame.height <= 0 || !intent) this.syncCamera(true);
    else if (intent.kind === 'fit')
      this.fit(
        intent.bounds,
        intent.padding,
        intent.limits,
        destinationZoom !== undefined,
      );
    else
      this.center(
        intent.target,
        destinationZoom ?? this.currentZoom(),
        destinationZoom !== undefined,
      );
  }

  center(target: LatLng, zoom?: number, animate = false) {
    if (!this.live) {
      this.intent = { kind: 'center', target, zoom };
      return;
    }
    const z = clamp(zoom ?? this.currentZoom());
    this.intent = { kind: 'center', target, zoom: z };
    this.move(this.centerFor(target, this.frameCenter(), z), z, animate);
  }

  fit(
    bounds: GeoBounds,
    padding = FIT_PADDING,
    limits: [number, number] = OVERVIEW_LIMITS,
    animate = false,
  ) {
    if (!this.live) {
      this.intent = { kind: 'fit', bounds, padding, limits };
      return;
    }
    const sw = this.project(bounds.sw),
      ne = this.project(bounds.ne);
    const scale = Math.min(
      Math.max(1, this.frame.width - padding * 2) /
        Math.max(1e-9, Math.abs(ne.x - sw.x)),
      Math.max(1, this.frame.height - padding * 2) /
        Math.max(1e-9, Math.abs(sw.y - ne.y)),
    );
    const zoom = clamp(this.currentZoom() + Math.log2(scale), ...limits);
    const middle = this.unproject({
      x: (sw.x + ne.x) / 2,
      y: (sw.y + ne.y) / 2,
    });
    this.center(middle, Number.isFinite(zoom) ? zoom : limits[0], animate);
    this.intent = { kind: 'fit', bounds, padding, limits };
  }

  releaseAnchor() {
    this.cancelMotion();
    this.intent = undefined;
  }

  /** 준비 전에는 no-op(필수 계약 2). */
  zoom(delta: number, around?: Point, animate = false) {
    if (!this.live) return;
    const pixel = around ?? {
      x: this.frame.x + this.frame.width / 2,
      y: this.frame.y + this.frame.height / 2,
    };
    const nextZoom = clamp(
      (animate
        ? (this.motion?.zoom ?? this.currentZoom())
        : this.currentZoom()) + delta,
    );
    const point = this.unproject(pixel);
    this.releaseAnchor();
    this.move(this.centerFor(point, pixel, nextZoom), nextZoom, animate);
  }

  /** 화면 pixel 이동량. 준비 전에는 no-op(필수 계약 2). */
  pan(delta: Point) {
    if (!this.live) return;
    this.releaseAnchor();
    const next = this.unproject({
      x: this.size.width / 2 - delta.x,
      y: this.size.height / 2 - delta.y,
    });
    if (!finite(next.lat, next.lng)) return;
    this.sdkSetCenter(next);
    this.syncCamera();
  }

  // ------------------------------------------------- SDK-facing primitives
  // 실제 SDK 카메라 API 선택은 smoke에서 검증한다. 바꿀 때는 여기만 고친다.

  private latLng(point: LatLng) {
    return new this.maps!.LatLng(point.lat, point.lng);
  }

  private sdkProject(point: LatLng): Point | undefined {
    if (!this.map) return undefined;
    const p = this.map.getProjection().fromCoordToOffset(this.latLng(point));
    return { x: p.x, y: p.y };
  }

  private sdkUnproject(point: Point): LatLng | undefined {
    if (!this.map) return undefined;
    return readCoord(
      this.map
        .getProjection()
        .fromOffsetToCoord(new this.maps!.Point(point.x, point.y)),
    );
  }

  private sdkSetSize(size: Size) {
    if (!this.map || size.width <= 0 || size.height <= 0) return;
    this.map.setSize({ width: size.width, height: size.height });
  }

  private sdkJump(center: LatLng, zoom: number) {
    this.map!.setZoom(zoom, false);
    this.map!.setCenter(this.latLng(center));
  }

  private sdkSetCenter(center: LatLng) {
    this.map!.setCenter(this.latLng(center));
  }

  private sdkMorph(center: LatLng, zoom: number) {
    this.map!.morph(this.latLng(center), zoom);
  }

  private sdkStop() {
    try {
      this.map?.stop();
    } catch {
      // stop 미지원 환경은 무시한다.
    }
  }
}
