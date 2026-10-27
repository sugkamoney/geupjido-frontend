import type { MapFrame } from '../../components/app-shell/types';
import { fromWorldPixel, worldPixel } from './mercator';
import type {
  Camera,
  GeoBounds,
  LatLng,
  MapAdapter,
  MapStatus,
  Point,
  Size,
} from './types';

const clamp = (value: number, min = 9.5, max = 17) =>
  Math.max(min, Math.min(max, value));
const SEOUL: LatLng = { lat: 37.5, lng: 127.0 };
export class FixtureMapAdapter implements MapAdapter {
  readonly kind = 'fixture' as const;
  private camera: Camera = { center: SEOUL, zoom: 12, revision: 0 };
  private size: Size = { width: 0, height: 0 };
  private frame: MapFrame = { x: 0, y: 0, width: 0, height: 0 };
  private listeners = new Set<() => void>();
  private destroyed = false;
  private anchor: LatLng | undefined;
  private animationFrame: number | undefined;
  private motionGeneration = 0;
  private destination: { center: LatLng; zoom: number } | undefined;
  private fitted:
    | { bounds: GeoBounds; padding: number; limits: [number, number] }
    | undefined;
  constructor(overview?: GeoBounds) {
    if (overview)
      this.fitted = { bounds: overview, padding: 48, limits: [9.5, 12.49] };
  }
  getSnapshot = () => this.camera;
  getStatus = (): MapStatus => 'ready';
  mount() {}
  retry() {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(center: LatLng, zoom = this.camera.zoom) {
    if (this.destroyed) return;
    this.camera = {
      center,
      zoom: clamp(zoom),
      revision: this.camera.revision + 1,
    };
    this.listeners.forEach((x) => x());
  }
  private cancelMotion() {
    this.motionGeneration++;
    if (this.animationFrame !== undefined)
      cancelAnimationFrame(this.animationFrame);
    this.animationFrame = undefined;
    this.destination = undefined;
  }
  private move(center: LatLng, zoom: number, animate: boolean) {
    this.cancelMotion();
    if (this.destroyed) return;
    zoom = clamp(zoom);
    if (
      !animate ||
      typeof requestAnimationFrame === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      this.update(center, zoom);
      return;
    }
    const from = this.camera;
    const started = window.performance.now();
    const generation = this.motionGeneration;
    this.destination = { center, zoom };
    const step = () => {
      const now = window.performance.now();
      if (this.destroyed || generation !== this.motionGeneration) return;
      const progress = Math.max(0, Math.min(1, (now - started) / 300));
      const eased = 1 - (1 - progress) ** 3;
      if (progress >= 1) this.update(center, zoom);
      else
        this.update(
          {
            lat: from.center.lat + (center.lat - from.center.lat) * eased,
            lng: from.center.lng + (center.lng - from.center.lng) * eased,
          },
          from.zoom + (zoom - from.zoom) * eased,
        );
      if (progress < 1) this.animationFrame = requestAnimationFrame(step);
      else {
        this.animationFrame = undefined;
        this.destination = undefined;
      }
    };
    this.animationFrame = requestAnimationFrame(step);
  }
  private origin(zoom = this.camera.zoom): Point {
    const center = worldPixel(this.camera.center, zoom);
    return {
      x: center.x - this.size.width / 2,
      y: center.y - this.size.height / 2,
    };
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
  /** Camera center that puts `point` at `pixel` for the given zoom. */
  private centerFor(point: LatLng, pixel: Point, zoom: number): LatLng {
    const world = worldPixel(point, zoom);
    return fromWorldPixel(
      {
        x: world.x - (pixel.x - this.size.width / 2),
        y: world.y - (pixel.y - this.size.height / 2),
      },
      zoom,
    );
  }
  project = (point: LatLng): Point => {
    const world = worldPixel(point, this.camera.zoom),
      origin = this.origin();
    return { x: world.x - origin.x, y: world.y - origin.y };
  };
  unproject = (point: Point): LatLng => {
    const origin = this.origin();
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
    const destinationZoom = this.destination?.zoom;
    this.size = size;
    this.frame = frame;
    if (frame.width <= 0 || frame.height <= 0) {
      this.update(this.camera.center);
      return;
    }
    if (this.fitted)
      this.fit(
        this.fitted.bounds,
        this.fitted.padding,
        this.fitted.limits,
        destinationZoom !== undefined,
      );
    else if (this.anchor)
      this.center(
        this.anchor,
        destinationZoom ?? this.camera.zoom,
        destinationZoom !== undefined,
      );
    else this.update(this.camera.center);
  }
  center(target: LatLng, zoom = this.camera.zoom, animate = false) {
    this.anchor = target;
    this.fitted = undefined;
    this.move(
      this.centerFor(target, this.frameCenter(), clamp(zoom)),
      zoom,
      animate,
    );
  }
  fit(
    bounds: GeoBounds,
    padding = 48,
    limits: [number, number] = [9.5, 12.49],
    animate = false,
  ) {
    const sw = worldPixel(bounds.sw, 0),
      ne = worldPixel(bounds.ne, 0);
    const scale = Math.min(
      Math.max(1, this.frame.width - padding * 2) /
        Math.max(1e-9, Math.abs(ne.x - sw.x)),
      Math.max(1, this.frame.height - padding * 2) /
        Math.max(1e-9, Math.abs(sw.y - ne.y)),
    );
    this.center(
      fromWorldPixel({ x: (sw.x + ne.x) / 2, y: (sw.y + ne.y) / 2 }, 0),
      clamp(Math.log2(scale), ...limits),
      animate,
    );
    this.fitted = { bounds, padding, limits };
  }
  releaseAnchor() {
    this.cancelMotion();
    this.anchor = undefined;
    this.fitted = undefined;
  }
  zoom(delta: number, around?: Point, animate = false) {
    const pixel = around ?? {
      x: this.frame.x + this.frame.width / 2,
      y: this.frame.y + this.frame.height / 2,
    };
    const nextZoom = clamp(
      (animate
        ? (this.destination?.zoom ?? this.camera.zoom)
        : this.camera.zoom) + delta,
    );
    const point = this.unproject(pixel);
    this.releaseAnchor();
    this.move(this.centerFor(point, pixel, nextZoom), nextZoom, animate);
  }
  pan(delta: Point) {
    this.releaseAnchor();
    const zoom = this.camera.zoom,
      center = worldPixel(this.camera.center, zoom);
    this.update(
      fromWorldPixel({ x: center.x - delta.x, y: center.y - delta.y }, zoom),
    );
  }
  destroy() {
    this.destroyed = true;
    this.listeners.clear();
    this.releaseAnchor();
  }
}
