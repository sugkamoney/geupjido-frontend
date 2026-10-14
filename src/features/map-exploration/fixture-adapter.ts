import type { MapFrame } from '../../components/app-shell/types';
import type { Bounds, Camera, MapAdapter, Point, Size } from './types';

const clamp = (value: number, min = 9.5, max = 17) =>
  Math.max(min, Math.min(max, value));
export class FixtureMapAdapter implements MapAdapter {
  private camera: Camera = { center: { x: 0, y: 0 }, zoom: 12, revision: 0 };
  private size: Size = { width: 0, height: 0 };
  private frame: MapFrame = { x: 0, y: 0, width: 0, height: 0 };
  private listeners = new Set<() => void>();
  private destroyed = false;
  private anchor: Point | undefined;
  private animationFrame: number | undefined;
  private motionGeneration = 0;
  private destination: { center: Point; zoom: number } | undefined;
  private fitted:
    { bounds: Bounds; padding: number; limits: [number, number] } | undefined;
  constructor(overview?: Bounds) {
    if (overview)
      this.fitted = { bounds: overview, padding: 48, limits: [9.5, 12.49] };
  }
  getSnapshot = () => this.camera;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(center: Point, zoom = this.camera.zoom) {
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
  private move(center: Point, zoom: number, animate: boolean) {
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
      this.update(
        {
          x: from.center.x + (center.x - from.center.x) * eased,
          y: from.center.y + (center.y - from.center.y) * eased,
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
  private scale() {
    return 2 ** (this.camera.zoom - 12.9);
  }
  project = (point: Point): Point => ({
    x: (point.x - this.camera.center.x) * this.scale() + this.size.width / 2,
    y: (point.y - this.camera.center.y) * this.scale() + this.size.height / 2,
  });
  unproject = (point: Point): Point => ({
    x: (point.x - this.size.width / 2) / this.scale() + this.camera.center.x,
    y: (point.y - this.size.height / 2) / this.scale() + this.camera.center.y,
  });
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
  center(point: Point, zoom = this.camera.zoom, animate = false) {
    this.anchor = point;
    this.fitted = undefined;
    const scale = 2 ** (clamp(zoom) - 12.9);
    const target =
      this.frame.width > 0 && this.frame.height > 0
        ? {
            x: this.frame.x + this.frame.width / 2,
            y: this.frame.y + this.frame.height / 2,
          }
        : { x: this.size.width / 2, y: this.size.height / 2 };
    this.move(
      {
        x: point.x - (target.x - this.size.width / 2) / scale,
        y: point.y - (target.y - this.size.height / 2) / scale,
      },
      zoom,
      animate,
    );
  }
  fit(
    bounds: Bounds,
    padding = 48,
    limits: [number, number] = [9.5, 12.49],
    animate = false,
  ) {
    const scale = Math.min(
      Math.max(1, this.frame.width - padding * 2) /
        Math.max(1, bounds.max.x - bounds.min.x),
      Math.max(1, this.frame.height - padding * 2) /
        Math.max(1, bounds.max.y - bounds.min.y),
    );
    this.center(
      {
        x: (bounds.min.x + bounds.max.x) / 2,
        y: (bounds.min.y + bounds.max.y) / 2,
      },
      clamp(12.9 + Math.log2(scale), ...limits),
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
    const zoom = nextZoom,
      scale = 2 ** (zoom - 12.9);
    this.move(
      {
        x: point.x - (pixel.x - this.size.width / 2) / scale,
        y: point.y - (pixel.y - this.size.height / 2) / scale,
      },
      zoom,
      animate,
    );
  }
  pan(delta: Point) {
    this.releaseAnchor();
    this.update({
      x: this.camera.center.x - delta.x / this.scale(),
      y: this.camera.center.y - delta.y / this.scale(),
    });
  }
  destroy() {
    this.destroyed = true;
    this.listeners.clear();
    this.releaseAnchor();
  }
}
