import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExplorationPage } from './exploration-page';
import { FixtureMapAdapter } from './fixture-adapter';
import { fixtures, fixtureSource } from './fixtures';
import { MapSurface } from './map-surface';
import { createFakeMaps } from './naver/fake-naver';
import type { LoaderStatus, NaverLoader } from './naver/loader';
import { NaverMapAdapter } from './naver/naver-adapter';
import type { MapAdapter, MapStatus } from './types';

const SIZE = { width: 1000, height: 800 };
const FRAME = { x: 0, y: 0, width: 1000, height: 800 };
const AUTH =
  '지도 인증에 실패했습니다. 등록된 주소에서 접속했는지 확인해 주세요.';
const NETWORK =
  '지도를 불러오지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.';
const CONFIG = '지도 설정이 없습니다.';

function fakeLoader(initial: LoaderStatus = 'loading') {
  let status = initial;
  const listeners = new Set<() => void>();
  const loader = {
    getStatus: () => status,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    start: vi.fn(),
    retry: vi.fn(),
    dispose: vi.fn(),
  } satisfies NaverLoader;
  return {
    loader,
    set: (next: LoaderStatus) => {
      status = next;
      listeners.forEach((l) => l());
    },
  };
}

function naverSetup(initial: LoaderStatus = 'loading') {
  const fake = createFakeMaps();
  const l = fakeLoader(initial);
  const adapter = new NaverMapAdapter({
    loader: l.loader,
    overview: fixtures.overview,
    getMaps: () => fake.maps,
  });
  adapter.setViewport(SIZE, FRAME);
  const map = () => {
    const live = fake.live();
    const last = live[live.length - 1];
    if (!last) throw new Error('no live map');
    return last;
  };
  const ready = () =>
    act(() => {
      if (l.loader.getStatus() !== 'ready') l.set('ready');
      fake.maps.Event.trigger(map(), 'init');
    });
  return { fake, l, adapter, map, ready };
}

/** camera snapshot을 그대로 둔 채 status만 바꿀 수 있는 adapter. */
function statusAdapter(kind: MapAdapter['kind'] = 'naver') {
  const base = new FixtureMapAdapter(fixtures.overview);
  base.setViewport(SIZE, FRAME);
  base.center(fixtures.zones[0]!.point, 12.9);
  let status: MapStatus = 'ready';
  const listeners = new Set<() => void>();
  const adapter: MapAdapter = {
    kind,
    getSnapshot: base.getSnapshot,
    subscribe: (l) => {
      listeners.add(l);
      const off = base.subscribe(l);
      return () => {
        listeners.delete(l);
        off();
      };
    },
    getStatus: () => status,
    mount: vi.fn(),
    retry: vi.fn(),
    setViewport: (s, f) => base.setViewport(s, f),
    project: base.project,
    unproject: base.unproject,
    center: (...args) => base.center(...args),
    fit: (...args) => base.fit(...args),
    zoom: (...args) => base.zoom(...args),
    pan: (d) => base.pan(d),
    releaseAnchor: () => base.releaseAnchor(),
    destroy: () => base.destroy(),
    noteUserGesture: vi.fn(),
  };
  return {
    adapter,
    setStatus: (next: MapStatus) =>
      act(() => {
        status = next;
        listeners.forEach((l) => l());
      }),
  };
}

function renderSurface(adapter: MapAdapter, onReload = vi.fn()) {
  const onLabel = vi.fn(),
    onApartment = vi.fn();
  const view = render(
    <MapSurface
      adapter={adapter}
      frame={FRAME}
      data={fixtures}
      onLabel={onLabel}
      onApartment={onApartment}
      onReload={onReload}
    />,
  );
  return { onLabel, onApartment, onReload, ...view };
}

function pointer(
  node: Element,
  type: string,
  x = 100,
  y = 100,
  pointerType = 'touch',
  id = 1,
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    button: 0,
  });
  Object.defineProperties(event, {
    pointerType: { value: pointerType },
    pointerId: { value: id },
  });
  fireEvent(node, event);
}

const region = () => screen.getByRole('region', { name: '검토용 지도' });
const centerOf = () => ({
  lat: Number(region().dataset.centerLat),
  lng: Number(region().dataset.centerLng),
});

afterEach(() => vi.useRealTimers());

describe('NAVER map surface status', () => {
  it('loading hides labels and pins while search and detail stay usable', async () => {
    const { adapter } = naverSetup();
    const user = userEvent.setup();
    render(<ExplorationPage adapter={adapter} source={fixtureSource} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      '지도를 불러오는 중입니다.',
    );
    expect(
      screen.queryByRole('button', { name: /^(권역|구) / }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^지도 단지 / }),
    ).not.toBeInTheDocument();
    const field = screen.getByRole('combobox', { name: '지역 검색' });
    await user.type(field, '압구정');
    await screen.findByRole('listbox');
    await user.keyboard('{Enter}');
    expect(
      await screen.findByRole('heading', { name: '압구정' }),
    ).toBeVisible();
  });

  it('mounts the SDK into a canvas node inside the map region', () => {
    const { adapter, fake } = naverSetup('ready');
    renderSurface(adapter);
    const element = fake.instances[0]!.element;
    expect(element).toHaveClass('exploration-map-canvas');
    expect(region()).toContainElement(element);
  });

  it('renders the overlay inside the SDK overlay host so target gestures reach the SDK', () => {
    const { adapter, ready } = naverSetup();
    renderSurface(adapter);
    ready();
    const host = adapter.getOverlayHost()!;
    expect(host).toBeDefined();
    expect(host).toContainElement(
      screen.getByRole('button', { name: '구 강남구' }),
    );
    expect(region()).toContainElement(host);
  });

  it.each([
    ['network-error', NETWORK],
    ['auth-error', AUTH],
  ] as const)('status-only change renders error (%s)', (status, text) => {
    const { adapter, setStatus } = statusAdapter();
    renderSurface(adapter);
    const camera = adapter.getSnapshot();
    expect(screen.getByRole('button', { name: '권역 압구정' })).toBeVisible();
    setStatus(status);
    expect(adapter.getSnapshot()).toBe(camera);
    expect(screen.getByRole('alert')).toHaveTextContent(text);
    expect(
      screen.queryByRole('button', { name: '권역 압구정' }),
    ).not.toBeInTheDocument();
  });

  it('network retry calls adapter.retry once', async () => {
    const { adapter, setStatus } = statusAdapter();
    const { onReload } = renderSurface(adapter);
    setStatus('network-error');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: '다시 시도' }));
    expect(adapter.retry).toHaveBeenCalledOnce();
    expect(onReload).not.toHaveBeenCalled();
  });

  it.each([
    ['auth-error', AUTH],
    ['config-error', CONFIG],
  ] as const)('%s retry reloads the page once', async (status, text) => {
    const { adapter, setStatus } = statusAdapter();
    const { onReload } = renderSurface(adapter);
    setStatus(status);
    expect(screen.getByRole('alert')).toHaveTextContent(text);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onReload).toHaveBeenCalledOnce();
    expect(adapter.retry).not.toHaveBeenCalled();
  });

  it('ready renders labels with the review-data notice', () => {
    const { adapter, ready } = naverSetup();
    renderSurface(adapter);
    ready();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '구 강남구' })).toBeVisible();
    expect(
      screen.getByText('검토용 데이터 · 실제 위치·시세 미검증'),
    ).toHaveClass('exploration-notice-desktop');
    expect(screen.getByText('검토용 데이터')).toHaveClass(
      'exploration-notice-mobile',
    );
    expect(screen.queryByText(/NAVER 지도/)).not.toBeInTheDocument();
    expect(region()).toHaveAttribute('data-provider', 'naver');
  });

  it('fixture adapter keeps the fixture notice copy', () => {
    const adapter = new FixtureMapAdapter(fixtures.overview);
    adapter.setViewport(SIZE, FRAME);
    renderSurface(adapter);
    expect(
      screen.getByText('검토용 지도·데이터 · NAVER 지도·실제 시세 미연결'),
    ).toBeInTheDocument();
    expect(screen.getByText('검토용 · 지도·시세 미연결')).toBeInTheDocument();
    expect(region()).toHaveAttribute('data-provider', 'fixture');
  });
});

describe('NAVER observe input', () => {
  function readySurface() {
    const s = naverSetup('ready');
    s.adapter.center(fixtures.zones[0]!.point, 12.9);
    const view = renderSurface(s.adapter);
    s.ready();
    const center = vi.spyOn(s.adapter, 'center');
    const pan = vi.spyOn(s.adapter, 'pan');
    const zoom = vi.spyOn(s.adapter, 'zoom');
    const note = vi.spyOn(s.adapter, 'noteUserGesture');
    const label = screen.getByRole('button', { name: '권역 압구정' });
    return { ...s, ...view, center, pan, zoom, note, label };
  }

  it('drag from a label does not select or move the camera and notes one gesture', () => {
    const { label, onLabel, center, pan, zoom, note, adapter } = readySurface();
    const before = adapter.getSnapshot();
    pointer(label, 'pointerdown', 100, 100);
    pointer(label, 'pointermove', 140, 100);
    pointer(label, 'pointermove', 202, 100);
    pointer(label, 'pointerup', 202, 100);
    fireEvent.click(label, { detail: 1 });
    expect(onLabel).not.toHaveBeenCalled();
    expect(center).not.toHaveBeenCalled();
    expect(pan).not.toHaveBeenCalled();
    expect(zoom).not.toHaveBeenCalled();
    expect(note).toHaveBeenCalledOnce();
    expect(adapter.getSnapshot()).toBe(before);
  });

  it('two fingers starting on a label do not select', () => {
    const { label, onLabel, zoom, note } = readySurface();
    pointer(label, 'pointerdown', 100, 100, 'touch', 1);
    pointer(label, 'pointerdown', 200, 100, 'touch', 2);
    pointer(label, 'pointermove', 300, 100, 'touch', 2);
    pointer(label, 'pointerup', 100, 100, 'touch', 1);
    pointer(label, 'pointerup', 300, 100, 'touch', 2);
    expect(onLabel).not.toHaveBeenCalled();
    expect(zoom).not.toHaveBeenCalled();
    expect(note).toHaveBeenCalledOnce();
  });

  it('short tap selects once and does not capture the pointer', () => {
    const { label, onLabel, note } = readySurface();
    const capture = vi.fn();
    label.setPointerCapture = capture;
    region().setPointerCapture = capture;
    pointer(label, 'pointerdown');
    pointer(label, 'pointermove', 102, 102);
    pointer(label, 'pointerup', 102, 102);
    fireEvent.click(label, { detail: 1 });
    expect(onLabel).toHaveBeenCalledOnce();
    expect(capture).not.toHaveBeenCalled();
    expect(note).not.toHaveBeenCalled();
  });

  it('pointercancel then next tap selects once', () => {
    const { label, onLabel } = readySurface();
    pointer(label, 'pointerdown');
    pointer(label, 'pointercancel');
    pointer(label, 'pointerdown');
    pointer(label, 'pointerup');
    expect(onLabel).toHaveBeenCalledOnce();
  });

  it('wheel and dblclick note a gesture without zooming, including on targets', () => {
    const { zoom, note, adapter, label } = readySurface();
    const before = adapter.getSnapshot();
    fireEvent.wheel(region(), { deltaY: -100, clientX: 10, clientY: 10 });
    fireEvent.doubleClick(region(), { clientX: 10, clientY: 10 });
    // 대상은 SDK 입력 요소 안에 있어 SDK가 그 위의 휠·더블클릭도 줌한다.
    fireEvent.wheel(label, { deltaY: -100, clientX: 10, clientY: 10 });
    fireEvent.doubleClick(label, { clientX: 10, clientY: 10 });
    expect(zoom).not.toHaveBeenCalled();
    expect(note).toHaveBeenCalledTimes(4);
    expect(adapter.getSnapshot()).toBe(before);
  });

  it('keyboard still drives the adapter', () => {
    const { zoom, pan } = readySurface();
    fireEvent.keyDown(region(), { key: 'ArrowLeft' });
    fireEvent.keyDown(region(), { key: '+' });
    expect(pan).toHaveBeenCalledOnce();
    expect(zoom).toHaveBeenCalledOnce();
  });

  it('SDK camera change clears hover card', () => {
    vi.useFakeTimers();
    const { label, map } = readySurface();
    pointer(label, 'pointerover', 0, 0, 'mouse');
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole('tooltip')).toHaveTextContent('압구정');
    act(() => map().userMove({ lat: 37.53, lng: 127.03 }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('NAVER page lifecycle', () => {
  it('StrictMode creates one map and leaves no listener after cleanup', async () => {
    const { adapter, fake, ready } = naverSetup('ready');
    const view = render(
      <StrictMode>
        <ExplorationPage adapter={adapter} source={fixtureSource} />
      </StrictMode>,
    );
    ready();
    expect(fake.instances).toHaveLength(1);
    expect(adapter.getStatus()).toBe('ready');
    view.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(fake.live()).toHaveLength(0);
    expect(fake.listenerCount()).toBe(0);
  });

  it('search A → search B during loading → ready centers on B', async () => {
    const { adapter, ready } = naverSetup();
    const user = userEvent.setup();
    render(<ExplorationPage adapter={adapter} source={fixtureSource} />);
    const field = screen.getByRole('combobox', { name: '지역 검색' });
    await user.type(field, '압구정');
    await screen.findByRole('listbox');
    await user.keyboard('{Enter}');
    await user.clear(field);
    await user.type(field, '청담');
    await screen.findByRole('listbox');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: '청담' })).toBeVisible();
    ready();
    const b = fixtures.zones.find((z) => z.name === '청담')!.point;
    expect(centerOf().lat).toBeCloseTo(b.lat, 5);
    expect(centerOf().lng).toBeCloseTo(b.lng, 5);
  });

  it('search A → close detail during loading → ready fits the overview', async () => {
    const reference = naverSetup('ready');
    reference.adapter.mount(document.createElement('div'));
    reference.ready();
    const expected = reference.adapter.getSnapshot();

    const { adapter, ready } = naverSetup();
    const user = userEvent.setup();
    render(<ExplorationPage adapter={adapter} source={fixtureSource} />);
    const field = screen.getByRole('combobox', { name: '지역 검색' });
    await user.type(field, '압구정');
    await screen.findByRole('listbox');
    await user.keyboard('{Enter}');
    await user.click(
      await screen.findByRole('button', { name: '권역 상세 닫기' }),
    );
    ready();
    expect(Number(region().dataset.zoom)).toBeCloseTo(expected.zoom, 5);
    expect(centerOf().lat).toBeCloseTo(expected.center.lat, 5);
    expect(centerOf().lng).toBeCloseTo(expected.center.lng, 5);
  });
});
