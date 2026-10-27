/**
 * 테스트 전용 가짜 `naver.maps`. adapter가 쓰는 SDK 부분집합만 흉내 낸다.
 * projection은 `mercator.ts`(256px 타일 Web Mercator)를 쓰고, `init`·카메라 이벤트는
 * 테스트가 `Event.trigger`나 `FakeMap` 헬퍼로 직접 발생시킨다.
 *
 * 실제 SDK처럼 `fromCoordToOffset`은 화면이 아니라 pane 기준이다: pane 원점은 생성·zoom
 * 변경 때만 다시 잡히고 center 이동에는 따라오지 않는다(2026-10-27 실제 SDK 확인).
 */
import { fromWorldPixel, worldPixel } from '../mercator';

type Listener = {
  eventName: string;
  listener: (event: unknown) => unknown;
  listenerId: string;
  target: unknown;
};

class FakePoint {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

class FakeLatLng extends FakePoint {
  constructor(lat: number, lng: number) {
    super(lng, lat);
  }
  lat() {
    return this.y;
  }
  lng() {
    return this.x;
  }
}

class FakeLatLngBounds {
  sw: FakeLatLng;
  ne: FakeLatLng;
  constructor(sw: FakeLatLng, ne: FakeLatLng) {
    this.sw = sw;
    this.ne = ne;
  }
  getSW() {
    return this.sw;
  }
  getNE() {
    return this.ne;
  }
}

type CoordLike = { x: number; y: number };
const toLatLng = (c: CoordLike) => ({ lat: c.y, lng: c.x });

export type FakeMapsControl = {
  maps: typeof naver.maps;
  /** 생성된 모든 지도(파괴된 것 포함). */
  instances: FakeMap[];
  /** 파괴되지 않은 지도. */
  live: () => FakeMap[];
  /** 아직 removeListener되지 않은 listener 수. */
  listenerCount: () => number;
  /** true면 `new Map()`이 throw한다. */
  throwOnCreate: boolean;
  /** true면 projection이 NaN을 돌려준다. */
  brokenProjection: boolean;
};

export interface FakeMap {
  readonly element: HTMLElement;
  readonly options: naver.maps.MapOptions;
  destroyed: boolean;
  center: { lat: number; lng: number };
  zoom: number;
  size: { width: number; height: number };
  /** 진행 중인 morph 목표. */
  morphing: { center: { lat: number; lng: number }; zoom: number } | undefined;
  calls: string[];
  /** morph를 progress(0~1)까지 진행시키며 카메라 이벤트를 발생시킨다. */
  stepMorph(progress: number): void;
  finishMorph(): void;
  /** 사용자 드래그처럼 중심을 옮긴다(이벤트 발생). */
  userMove(center: { lat: number; lng: number }): void;
}

export function createFakeMaps(): FakeMapsControl {
  const registry = new Set<Listener>();
  let nextId = 0;
  const control = {} as FakeMapsControl;
  control.instances = [];
  control.throwOnCreate = false;
  control.brokenProjection = false;
  control.live = () => control.instances.filter((m) => !m.destroyed);
  control.listenerCount = () => registry.size;

  const Event = {
    addListener(
      target: unknown,
      eventName: string,
      listener: (event: unknown) => unknown,
    ): Listener {
      const entry = {
        eventName,
        listener,
        listenerId: String(++nextId),
        target,
      };
      registry.add(entry);
      return entry;
    },
    removeListener(listeners: Listener | Listener[]) {
      (Array.isArray(listeners) ? listeners : [listeners]).forEach((l) =>
        registry.delete(l),
      );
    },
    trigger(target: unknown, eventName: string, event?: unknown) {
      [...registry]
        .filter((l) => l.target === target && l.eventName === eventName)
        .forEach((l) => registry.has(l) && l.listener(event));
    },
  };

  class Map implements FakeMap {
    readonly element: HTMLElement;
    readonly options: naver.maps.MapOptions;
    destroyed = false;
    center: { lat: number; lng: number };
    zoom: number;
    size = { width: 0, height: 0 };
    morphing: FakeMap['morphing'];
    calls: string[] = [];
    /** pane 원점(world pixel). 생성·zoom 변경 때만 갱신된다. */
    private paneOrigin: { x: number; y: number } | undefined;
    private morphFrom: { center: { lat: number; lng: number }; zoom: number } =
      { center: { lat: 0, lng: 0 }, zoom: 0 };

    constructor(element: HTMLElement, options: naver.maps.MapOptions = {}) {
      if (control.throwOnCreate) throw new Error('fake create failure');
      this.element = element;
      this.options = options;
      const c = options.center as CoordLike | undefined;
      this.center = c ? toLatLng(c) : { lat: 37.5666103, lng: 126.9783882 };
      this.zoom = options.zoom ?? 16;
      control.instances.push(this);
    }
    private clampZoom(z: number) {
      return Math.max(
        this.options.minZoom ?? 0,
        Math.min(this.options.maxZoom ?? 21, z),
      );
    }
    private emit(name: string) {
      if (name === 'zoom_changed') this.paneOrigin = undefined;
      Event.trigger(this, name);
    }
    getCenter() {
      return new FakeLatLng(this.center.lat, this.center.lng);
    }
    setCenter(c: CoordLike) {
      this.calls.push('setCenter');
      this.center = toLatLng(c);
      this.emit('center_changed');
    }
    getZoom() {
      return this.zoom;
    }
    setZoom(zoom: number, effect?: boolean) {
      this.calls.push(effect ? 'setZoom:effect' : 'setZoom');
      this.zoom = this.clampZoom(zoom);
      this.emit('zoom_changed');
    }
    morph(c: CoordLike, zoom = this.zoom) {
      this.calls.push('morph');
      this.morphFrom = { center: this.center, zoom: this.zoom };
      this.morphing = { center: toLatLng(c), zoom: this.clampZoom(zoom) };
    }
    stepMorph(progress: number) {
      const to = this.morphing;
      if (!to) return;
      const from = this.morphFrom;
      this.center = {
        lat: from.center.lat + (to.center.lat - from.center.lat) * progress,
        lng: from.center.lng + (to.center.lng - from.center.lng) * progress,
      };
      this.zoom = from.zoom + (to.zoom - from.zoom) * progress;
      this.emit('zoom_changed');
      this.emit('center_changed');
      if (progress >= 1) {
        this.morphing = undefined;
        this.emit('idle');
      }
    }
    finishMorph() {
      this.stepMorph(1);
    }
    stop() {
      this.calls.push('stop');
      this.morphing = undefined;
    }
    userMove(center: { lat: number; lng: number }) {
      this.center = center;
      this.emit('center_changed');
    }
    panBy(offset: CoordLike) {
      this.calls.push('panBy');
      const w = worldPixel(this.center, this.zoom);
      this.center = fromWorldPixel(
        { x: w.x + offset.x, y: w.y + offset.y },
        this.zoom,
      );
      this.emit('center_changed');
    }
    fitBounds(bounds: FakeLatLngBounds) {
      this.calls.push('fitBounds');
      const sw = toLatLng(bounds.getSW()),
        ne = toLatLng(bounds.getNE());
      this.center = { lat: (sw.lat + ne.lat) / 2, lng: (sw.lng + ne.lng) / 2 };
      this.emit('center_changed');
    }
    setSize(size: { width: number; height: number }) {
      this.calls.push('setSize');
      this.size = { width: size.width, height: size.height };
    }
    getProjection() {
      const origin = () => {
        if (!this.paneOrigin) {
          const c = worldPixel(this.center, this.zoom);
          this.paneOrigin = {
            x: c.x - this.size.width / 2,
            y: c.y - this.size.height / 2,
          };
        }
        return this.paneOrigin;
      };
      return {
        fromCoordToOffset: (coord: CoordLike) => {
          if (control.brokenProjection) return new FakePoint(NaN, NaN);
          const w = worldPixel(toLatLng(coord), this.zoom),
            o = origin();
          return new FakePoint(w.x - o.x, w.y - o.y);
        },
        fromOffsetToCoord: (offset: CoordLike) => {
          if (control.brokenProjection) return new FakeLatLng(NaN, NaN);
          const o = origin();
          const p = fromWorldPixel(
            { x: offset.x + o.x, y: offset.y + o.y },
            this.zoom,
          );
          return new FakeLatLng(p.lat, p.lng);
        },
      };
    }
    destroy() {
      this.calls.push('destroy');
      this.destroyed = true;
    }
  }

  control.maps = {
    Map,
    LatLng: FakeLatLng,
    LatLngBounds: FakeLatLngBounds,
    Point: FakePoint,
    Event,
  } as unknown as typeof naver.maps;
  return control;
}
