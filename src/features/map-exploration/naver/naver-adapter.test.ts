import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapFrame } from '../../../components/app-shell/types';
import type { GeoBounds, LatLng, Size } from '../types';
import { createFakeMaps } from './fake-naver';
import type { LoaderStatus, NaverLoader } from './loader';
import { NaverMapAdapter } from './naver-adapter';

const OVERVIEW: GeoBounds = {
  sw: { lat: 37.43, lng: 126.8 },
  ne: { lat: 37.7, lng: 127.18 },
};
const A: LatLng = { lat: 37.55, lng: 126.98 };
const B: LatLng = { lat: 37.6, lng: 127.05 };
const SIZE: Size = { width: 1000, height: 800 };
const FULL: MapFrame = { x: 0, y: 0, width: 1000, height: 800 };
const TIMEOUT = 1000;

function fakeLoader(initial: LoaderStatus = 'loading') {
  let status = initial;
  const listeners = new Set<() => void>();
  const set = (next: LoaderStatus) => {
    status = next;
    listeners.forEach((l) => l());
  };
  const loader = {
    getStatus: () => status,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    start: vi.fn(),
    retry: vi.fn(() => set('loading')),
    dispose: vi.fn(),
  } satisfies NaverLoader;
  return { loader, set, listeners };
}

function setup({ mount = true } = {}) {
  const fake = createFakeMaps();
  const l = fakeLoader();
  const adapter = new NaverMapAdapter({
    loader: l.loader,
    overview: OVERVIEW,
    getMaps: () => fake.maps,
    initTimeoutMs: TIMEOUT,
  });
  const listener = vi.fn();
  adapter.subscribe(listener);
  const container = document.createElement('div');
  adapter.setViewport(SIZE, FULL);
  if (mount) adapter.mount(container);
  const map = () => {
    const live = fake.live();
    const last = live[live.length - 1];
    if (!last) throw new Error('no live map');
    return last;
  };
  const init = (target = map()) => fake.maps.Event.trigger(target, 'init');
  const ready = () => {
    l.set('ready');
    init();
  };
  return { fake, l, adapter, listener, container, map, init, ready };
}

const near = (a: number, b: number, tol = 1) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

function expectFinite(...values: number[]) {
  values.forEach((v) => expect(Number.isFinite(v)).toBe(true));
}

describe('NaverMapAdapter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('status', () => {
    it('kind는 naver이고 mount 때 loader.start를 부른다', () => {
      const { adapter, l } = setup();
      expect(adapter.kind).toBe('naver');
      expect(l.loader.start).toHaveBeenCalledTimes(1);
    });

    it('loader ready 전 loading, ready + init 후 ready', () => {
      const { adapter, l, init, fake, listener } = setup();
      expect(adapter.getStatus()).toBe('loading');
      expect(fake.instances).toHaveLength(0);
      l.set('ready');
      expect(fake.instances).toHaveLength(1);
      expect(adapter.getStatus()).toBe('loading');
      listener.mockClear();
      init();
      expect(adapter.getStatus()).toBe('ready');
      expect(listener).toHaveBeenCalled();
    });

    it('지도 생성 옵션', () => {
      const { l, fake, container } = setup();
      l.set('ready');
      const map = fake.instances[0]!;
      expect(map.element).toBe(container);
      expect(map.options).toMatchObject({
        gl: true,
        minZoom: 9.5,
        maxZoom: 17,
        keyboardShortcuts: false,
      });
      expect(map.size).toEqual(SIZE);
    });

    it('같은 container에 mount를 두 번 해도 지도는 하나', () => {
      const { adapter, l, fake, container } = setup();
      adapter.mount(container);
      l.set('ready');
      adapter.mount(container);
      expect(fake.instances).toHaveLength(1);
    });

    it('Map 생성자 throw는 network-error', () => {
      const { adapter, l, fake } = setup();
      fake.throwOnCreate = true;
      l.set('ready');
      expect(adapter.getStatus()).toBe('network-error');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('setSize가 throw해도 loading에 머물지 않고 network-error', () => {
      const { adapter, l, fake } = setup();
      fake.throwOnSetSize = true;
      l.set('ready');
      expect(adapter.getStatus()).toBe('network-error');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('loader auth-error를 전파한다(ready 이후 포함)', () => {
      const { adapter, l } = setup();
      l.set('auth-error');
      expect(adapter.getStatus()).toBe('auth-error');
      const second = setup();
      second.ready();
      expect(second.adapter.getStatus()).toBe('ready');
      second.l.set('auth-error');
      expect(second.adapter.getStatus()).toBe('auth-error');
    });

    it('getStatus/getSnapshot은 변화가 없으면 같은 값을 돌려준다', () => {
      const { adapter, ready } = setup();
      const before = adapter.getSnapshot();
      expect(adapter.getSnapshot()).toBe(before);
      ready();
      const after = adapter.getSnapshot();
      expect(adapter.getSnapshot()).toBe(after);
      expect(adapter.getStatus()).toBe(adapter.getStatus());
    });
  });

  describe('준비 전 명령', () => {
    it('center(A) → center(B) → ready ⇒ B, 애니메이션 없음', () => {
      const { adapter, ready, map } = setup();
      adapter.center(A, 14, true);
      adapter.center(B, 15);
      ready();
      const p = adapter.project(B);
      near(p.x, 500);
      near(p.y, 400);
      expect(adapter.getSnapshot().zoom).toBe(15);
      expect(map().calls).not.toContain('morph');
    });

    it('center(A) → releaseAnchor → ready ⇒ overview fit', () => {
      const { adapter, ready } = setup();
      adapter.center(A, 15);
      adapter.releaseAnchor();
      ready();
      const zoom = adapter.getSnapshot().zoom;
      expect(zoom).toBeGreaterThanOrEqual(9.5);
      expect(zoom).toBeLessThanOrEqual(12.49);
      const sw = adapter.project(OVERVIEW.sw),
        ne = adapter.project(OVERVIEW.ne);
      [sw.x, ne.x].forEach((x) => {
        expect(x).toBeGreaterThanOrEqual(48 - 1);
        expect(x).toBeLessThanOrEqual(1000 - 48 + 1);
      });
      [sw.y, ne.y].forEach((y) => {
        expect(y).toBeGreaterThanOrEqual(48 - 1);
        expect(y).toBeLessThanOrEqual(800 - 48 + 1);
      });
      near((sw.x + ne.x) / 2, 500);
      near((sw.y + ne.y) / 2, 400);
    });

    it('보관 목적이 없으면 ready 때 overview fit', () => {
      const { adapter, ready } = setup();
      ready();
      const sw = adapter.project(OVERVIEW.sw),
        ne = adapter.project(OVERVIEW.ne);
      near((sw.x + ne.x) / 2, 500);
      near((sw.y + ne.y) / 2, 400);
      expect(adapter.getSnapshot().zoom).toBeLessThanOrEqual(12.49);
    });

    it('center(B, 15) → zoom ×2, pan ⇒ B, zoom 15', () => {
      const { adapter, ready } = setup();
      adapter.center(B, 15);
      adapter.zoom(1);
      adapter.zoom(1);
      adapter.pan({ x: 50, y: 0 });
      ready();
      expect(adapter.getSnapshot().zoom).toBe(15);
      const p = adapter.project(B);
      near(p.x, 500);
      near(p.y, 400);
    });

    it('fit(bounds) 보관 후 ready ⇒ 그 bounds fit', () => {
      const { adapter, ready } = setup();
      const bounds: GeoBounds = {
        sw: { lat: 37.54, lng: 126.97 },
        ne: { lat: 37.56, lng: 126.99 },
      };
      adapter.fit(bounds, 48, [12.55, 13.5]);
      ready();
      const zoom = adapter.getSnapshot().zoom;
      expect(zoom).toBeGreaterThanOrEqual(12.55);
      expect(zoom).toBeLessThanOrEqual(13.5);
      const sw = adapter.project(bounds.sw),
        ne = adapter.project(bounds.ne);
      near((sw.x + ne.x) / 2, 500);
      near((sw.y + ne.y) / 2, 400);
    });

    it('준비 전 project/unproject는 throw하지 않고 유한값', () => {
      const { adapter } = setup();
      const p = adapter.project(A);
      const q = adapter.unproject({ x: 10, y: 20 });
      expectFinite(p.x, p.y, q.lat, q.lng);
      const s = adapter.getSnapshot();
      expectFinite(s.center.lat, s.center.lng, s.zoom);
    });

    it('준비 전 getSnapshot은 명령에도 안정적', () => {
      const { adapter } = setup();
      const before = adapter.getSnapshot();
      adapter.center(A, 15);
      adapter.fit(OVERVIEW);
      adapter.zoom(1);
      expect(adapter.getSnapshot()).toBe(before);
    });

    it('재시도로 ready가 되면 최신 목적을 적용한다', () => {
      const { adapter, l, fake, init } = setup();
      l.set('network-error');
      adapter.center(B, 15);
      adapter.retry();
      expect(l.loader.retry).toHaveBeenCalledTimes(1);
      l.set('ready');
      init(fake.live()[0]);
      expect(adapter.getStatus()).toBe('ready');
      const p = adapter.project(B);
      near(p.x, 500);
      near(p.y, 400);
    });
  });

  describe('초기화 timeout', () => {
    it('loader ready then no init becomes network-error', () => {
      const { adapter, l } = setup();
      l.set('ready');
      vi.advanceTimersByTime(TIMEOUT - 1);
      expect(adapter.getStatus()).toBe('loading');
      vi.advanceTimersByTime(1);
      expect(adapter.getStatus()).toBe('network-error');
    });

    it('init 후에도 projection이 NaN이면 timeout에 network-error', () => {
      const { adapter, l, init, fake } = setup();
      fake.brokenProjection = true;
      l.set('ready');
      init();
      expect(adapter.getStatus()).toBe('loading');
      vi.advanceTimersByTime(TIMEOUT);
      expect(adapter.getStatus()).toBe('network-error');
    });

    it('init 뒤 projection이 늦게 유효해지면 다음 이벤트에서 ready', () => {
      const { adapter, l, init, fake, map } = setup();
      fake.brokenProjection = true;
      l.set('ready');
      init();
      fake.brokenProjection = false;
      fake.maps.Event.trigger(map(), 'idle');
      expect(adapter.getStatus()).toBe('ready');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('ready 확정 시 타이머를 정리한다', () => {
      const { ready } = setup();
      ready();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('timeout 뒤 retry → 새 init ⇒ ready, 이전 지도의 늦은 init 무시', () => {
      const { adapter, l, fake, init } = setup();
      l.set('ready');
      const first = fake.instances[0]!;
      vi.advanceTimersByTime(TIMEOUT);
      expect(adapter.getStatus()).toBe('network-error');
      adapter.retry();
      expect(first.destroyed).toBe(true);
      expect(adapter.getStatus()).toBe('loading');
      l.set('ready');
      expect(fake.live()).toHaveLength(1);
      const second = fake.live()[0]!;
      expect(second).not.toBe(first);
      init(second);
      expect(adapter.getStatus()).toBe('ready');
      init(first);
      expect(adapter.getStatus()).toBe('ready');
      expect(fake.live()).toHaveLength(1);
    });

    it('timeout 뒤 같은 지도의 늦은 init은 상태를 바꾸지 않는다', () => {
      const { adapter, l, init } = setup();
      l.set('ready');
      vi.advanceTimersByTime(TIMEOUT);
      init();
      expect(adapter.getStatus()).toBe('network-error');
    });

    it('destroy 뒤 timeout 경과 ⇒ 리스너 미호출, 대기 타이머 0', () => {
      const { adapter, l, listener } = setup();
      l.set('ready');
      adapter.destroy();
      listener.mockClear();
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(TIMEOUT * 2);
      expect(listener).not.toHaveBeenCalled();
    });

    it('retry는 대기 타이머를 정리한다', () => {
      const { adapter, l } = setup();
      l.set('ready');
      adapter.retry();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('사용자 조작', () => {
    it('center(A) 뒤 noteUserGesture → setViewport 변경 ⇒ A로 재중심하지 않음', () => {
      const { adapter, ready, map } = setup();
      ready();
      adapter.center(A, 14);
      adapter.noteUserGesture();
      map().userMove(B);
      adapter.setViewport(SIZE, { x: 400, y: 0, width: 600, height: 800 });
      expect(map().center).toEqual(B);
    });

    it('noteUserGesture before ready keeps pending intent', () => {
      const { adapter, ready } = setup();
      adapter.center(B, 15);
      adapter.noteUserGesture();
      ready();
      const p = adapter.project(B);
      near(p.x, 500);
      near(p.y, 400);
      expect(adapter.getSnapshot().zoom).toBe(15);
    });

    it.each(['dragstart', 'pinchstart'])(
      'SDK %s ⇒ anchor 해제',
      (eventName) => {
        const { adapter, ready, map, fake } = setup();
        ready();
        adapter.center(A, 14);
        fake.maps.Event.trigger(map(), eventName);
        map().userMove(B);
        adapter.setViewport(SIZE, { x: 400, y: 0, width: 600, height: 800 });
        expect(map().center).toEqual(B);
      },
    );

    it('fit 기억도 사용자 조작으로 해제된다', () => {
      const { adapter, ready, map } = setup();
      ready();
      adapter.noteUserGesture();
      map().userMove(B);
      adapter.setViewport(SIZE, { x: 400, y: 0, width: 600, height: 800 });
      expect(map().center).toEqual(B);
    });

    it('사용자 조작은 진행 중 morph를 멈춘다', () => {
      const { adapter, ready, map } = setup();
      ready();
      adapter.center(A, 15, true);
      expect(map().morphing).toBeDefined();
      adapter.noteUserGesture();
      expect(map().calls).toContain('stop');
      expect(map().morphing).toBeUndefined();
    });

    it('center(A, 15, true)가 일으킨 카메라 이벤트는 anchor를 해제하지 않는다', () => {
      const { adapter, ready, map } = setup();
      ready();
      adapter.center(A, 15, true);
      map().stepMorph(0.5);
      map().finishMorph();
      adapter.setViewport(SIZE, { x: 400, y: 0, width: 600, height: 800 });
      const p = adapter.project(A);
      near(p.x, 700);
      near(p.y, 400);
    });

    it('setViewport during programmatic motion keeps anchor', () => {
      const { adapter, ready, map } = setup();
      ready();
      adapter.center(A, 15, true);
      map().stepMorph(0.3);
      adapter.setViewport(SIZE, { x: 400, y: 0, width: 600, height: 800 });
      map().finishMorph();
      expect(adapter.getSnapshot().zoom).toBe(15);
      const p = adapter.project(A);
      near(p.x, 700);
      near(p.y, 400);
    });
  });

  describe('frame', () => {
    it('frame 중심으로 center', () => {
      const { adapter, ready } = setup();
      ready();
      adapter.setViewport(SIZE, { x: 400, y: 0, width: 600, height: 800 });
      adapter.center(A);
      const p = adapter.project(A);
      near(p.x, 700);
      near(p.y, 400);
    });

    it('fit(b, 48) 후 b가 frame 안쪽 48px 이내', () => {
      const { adapter, ready } = setup();
      ready();
      const frame = { x: 400, y: 0, width: 600, height: 800 };
      adapter.setViewport(SIZE, frame);
      const b: GeoBounds = {
        sw: { lat: 37.54, lng: 126.97 },
        ne: { lat: 37.56, lng: 126.99 },
      };
      adapter.fit(b, 48, [9.5, 17]);
      const sw = adapter.project(b.sw),
        ne = adapter.project(b.ne);
      [sw.x, ne.x].forEach((x) => {
        expect(x).toBeGreaterThanOrEqual(frame.x + 48 - 1);
        expect(x).toBeLessThanOrEqual(frame.x + frame.width - 48 + 1);
      });
      [sw.y, ne.y].forEach((y) => {
        expect(y).toBeGreaterThanOrEqual(48 - 1);
        expect(y).toBeLessThanOrEqual(800 - 48 + 1);
      });
    });

    it('fit은 frame 변경 때 재적용된다', () => {
      const { adapter, ready } = setup();
      ready();
      const b: GeoBounds = {
        sw: { lat: 37.54, lng: 126.97 },
        ne: { lat: 37.56, lng: 126.99 },
      };
      adapter.fit(b, 48, [9.5, 17]);
      adapter.setViewport(SIZE, { x: 400, y: 0, width: 600, height: 800 });
      const sw = adapter.project(b.sw),
        ne = adapter.project(b.ne);
      near((sw.x + ne.x) / 2, 700);
    });

    it('setViewport는 SDK에 크기를 알린다', () => {
      const { adapter, ready, map } = setup();
      ready();
      adapter.setViewport({ width: 500, height: 400 }, FULL);
      expect(map().size).toEqual({ width: 500, height: 400 });
    });

    it('zero-size viewport never yields NaN', () => {
      const { adapter, ready } = setup();
      ready();
      const zero = { x: 0, y: 0, width: 0, height: 0 };
      adapter.setViewport({ width: 0, height: 0 }, zero);
      adapter.center(A, 14);
      adapter.fit(OVERVIEW);
      adapter.zoom(1);
      adapter.pan({ x: 10, y: 10 });
      const s = adapter.getSnapshot();
      expectFinite(s.center.lat, s.center.lng, s.zoom);
      const p = adapter.project(A);
      expectFinite(p.x, p.y);
    });
  });

  describe('카메라', () => {
    it('frame이 비어 있으면 around 없는 zoom은 viewport 중심 기준(center 유지)', () => {
      const { adapter, ready } = setup();
      ready();
      adapter.center(A, 13);
      adapter.setViewport(SIZE, { x: 0, y: 0, width: 0, height: 0 });
      adapter.zoom(1);
      const snap = adapter.getSnapshot();
      expect(snap.zoom).toBe(14);
      near(snap.center.lat, A.lat, 1e-4);
      near(snap.center.lng, A.lng, 1e-4);
    });

    it('SDK zoom_changed/center_changed마다 revision 증가, 사이에는 같은 객체', () => {
      const { adapter, ready, map, fake, listener } = setup();
      ready();
      const r0 = adapter.getSnapshot();
      expect(adapter.getSnapshot()).toBe(r0);
      listener.mockClear();
      map().userMove(B);
      const r1 = adapter.getSnapshot();
      expect(r1.revision).toBeGreaterThan(r0.revision);
      expect(r1.center).toEqual(B);
      expect(adapter.getSnapshot()).toBe(r1);
      fake.maps.Event.trigger(map(), 'zoom_changed');
      const r2 = adapter.getSnapshot();
      expect(r2.revision).toBeGreaterThan(r1.revision);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('zoom은 9.5~17로 제한된다', () => {
      const { adapter, ready } = setup();
      ready();
      adapter.center(A, 30);
      expect(adapter.getSnapshot().zoom).toBe(17);
      adapter.zoom(-20);
      expect(adapter.getSnapshot().zoom).toBe(9.5);
    });

    it('zoom(delta, around)는 around 지점을 고정한다', () => {
      const { adapter, ready } = setup();
      ready();
      adapter.center(A, 13);
      const around = { x: 200, y: 300 };
      const before = adapter.unproject(around);
      adapter.zoom(1, around);
      expect(adapter.getSnapshot().zoom).toBe(14);
      const p = adapter.project(before);
      near(p.x, around.x);
      near(p.y, around.y);
    });

    it('pan(delta)는 지도 내용을 delta만큼 옮기고 anchor를 해제한다', () => {
      const { adapter, ready, map } = setup();
      ready();
      adapter.center(A, 13);
      adapter.pan({ x: 50, y: 0 });
      const p = adapter.project(A);
      near(p.x, 550);
      near(p.y, 400);
      const after = map().center;
      adapter.setViewport(SIZE, { x: 400, y: 0, width: 600, height: 800 });
      expect(map().center).toEqual(after);
    });
  });

  describe('animate', () => {
    it('center(A, 15, true)는 morph', () => {
      const { adapter, ready, map } = setup();
      ready();
      map().calls.length = 0;
      adapter.center(A, 15, true);
      expect(map().calls).toContain('morph');
      expect(map().morphing?.zoom).toBe(15);
    });

    it('animate=false는 즉시 setCenter/setZoom', () => {
      const { adapter, ready, map } = setup();
      ready();
      map().calls.length = 0;
      adapter.center(A, 15);
      expect(map().calls).not.toContain('morph');
      expect(map().calls).toContain('setCenter');
      expect(map().calls).toContain('setZoom');
    });

    it('reduced motion이면 즉시 이동', () => {
      const original = window.matchMedia;
      window.matchMedia = ((query: string) => ({
        matches: query.includes('reduce'),
      })) as unknown as typeof window.matchMedia;
      try {
        const { adapter, ready, map } = setup();
        ready();
        map().calls.length = 0;
        adapter.center(A, 15, true);
        expect(map().calls).not.toContain('morph');
        expect(map().calls).toContain('setCenter');
      } finally {
        window.matchMedia = original;
      }
    });
  });

  describe('projection', () => {
    it('SDK offset이 pane 기준이어도 project는 현재 화면 container pixel', () => {
      const { adapter, ready, map } = setup();
      ready();
      adapter.project(A); // pane 원점을 현재 위치로 고정한다.
      map().userMove(B);
      const p = adapter.project(B);
      near(p.x, 500);
      near(p.y, 400);
      const back = adapter.unproject({ x: 500, y: 400 });
      expect(back.lat).toBeCloseTo(B.lat, 6);
      expect(back.lng).toBeCloseTo(B.lng, 6);
    });
  });

  describe('overlay host', () => {
    it('라벨·핀 위 dblclick은 SDK 입력 요소로 전달하지 않는다', () => {
      const { adapter, ready, container } = setup({ mount: false });
      const wrapper = document.createElement('div');
      const input = document.createElement('div');
      wrapper.appendChild(input);
      container.appendChild(wrapper);
      adapter.mount(container);
      ready();
      const host = adapter.getOverlayHost()!;
      const label = document.createElement('button');
      label.className = 'exploration-label';
      const inner = document.createElement('span');
      label.appendChild(inner);
      const other = document.createElement('div');
      host.append(label, other);
      const reach = vi.fn();
      input.addEventListener('dblclick', reach);
      inner.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(reach).not.toHaveBeenCalled();
      other.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(reach).toHaveBeenCalledOnce();
    });

    it('ready 전에는 없고, ready 뒤 SDK 입력 요소 안에 생기며 destroy로 제거된다', () => {
      const { adapter, ready, container } = setup({ mount: false });
      // 실제 SDK의 container > div > div(입력 listener 요소) 구조를 흉내 낸다.
      const wrapper = document.createElement('div');
      const input = document.createElement('div');
      wrapper.appendChild(input);
      container.appendChild(wrapper);
      adapter.mount(container);
      expect(adapter.getOverlayHost()).toBeUndefined();
      ready();
      const host = adapter.getOverlayHost()!;
      expect(host.parentElement).toBe(input);
      expect(input.lastElementChild).toBe(host);
      expect(host.style.pointerEvents).toBe('none');
      adapter.destroy();
      expect(host.isConnected).toBe(false);
      expect(adapter.getOverlayHost()).toBeUndefined();
    });

    it('GL 지도면 mapbox canvas container 안, canvas 위에 둔다', () => {
      const { adapter, ready, container } = setup({ mount: false });
      const wrapper = document.createElement('div');
      const input = document.createElement('div');
      const gl = document.createElement('div');
      gl.className = 'mapboxgl-canvas-container';
      gl.appendChild(document.createElement('canvas'));
      input.appendChild(gl);
      wrapper.appendChild(input);
      container.appendChild(wrapper);
      adapter.mount(container);
      ready();
      const host = adapter.getOverlayHost()!;
      expect(host.parentElement).toBe(gl);
      expect(gl.lastElementChild).toBe(host);
      expect(Number(host.style.zIndex)).toBeGreaterThan(1);
    });

    it('SDK 구조를 찾지 못하면 container에 둔다', () => {
      const { adapter, ready, container } = setup();
      ready();
      expect(adapter.getOverlayHost()!.parentElement).toBe(container);
    });

    it('retry로 지도를 다시 만들면 이전 host를 제거한다', () => {
      const { adapter, ready, l } = setup();
      ready();
      const first = adapter.getOverlayHost()!;
      l.set('network-error');
      adapter.retry();
      expect(first.isConnected).toBe(false);
      expect(adapter.getOverlayHost()).toBeUndefined();
      ready();
      expect(adapter.getOverlayHost()).not.toBe(first);
    });
  });

  describe('destroy', () => {
    it('listener 제거, map.destroy, loader.dispose, 이후 loader 콜백 무시', () => {
      const { adapter, ready, fake, l, listener } = setup();
      ready();
      expect(fake.listenerCount()).toBeGreaterThan(0);
      const map = fake.instances[0]!;
      adapter.destroy();
      expect(fake.listenerCount()).toBe(0);
      expect(map.destroyed).toBe(true);
      expect(l.loader.dispose).toHaveBeenCalledTimes(1);
      listener.mockClear();
      l.set('network-error');
      l.set('ready');
      expect(listener).not.toHaveBeenCalled();
      expect(fake.instances).toHaveLength(1);
    });

    it('로딩 중 destroy 뒤 늦은 ready ⇒ 지도 생성 없음', () => {
      const { adapter, l, fake } = setup();
      adapter.destroy();
      l.set('ready');
      expect(fake.instances).toHaveLength(0);
    });

    it('mount 전 loader ready면 mount 때 지도를 만든다', () => {
      const { adapter, l, fake, container } = setup({ mount: false });
      l.set('ready');
      expect(fake.instances).toHaveLength(0);
      adapter.mount(container);
      expect(fake.instances).toHaveLength(1);
    });
  });
});
