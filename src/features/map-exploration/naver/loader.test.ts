import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNaverLoader } from './loader';

type Handler = () => void;

class FakeScript {
  src = '';
  removed = false;
  private handlers: Record<string, Handler[]> = {};
  addEventListener(type: string, h: Handler) {
    (this.handlers[type] ??= []).push(h);
  }
  removeEventListener(type: string, h: Handler) {
    this.handlers[type] = (this.handlers[type] ?? []).filter((x) => x !== h);
  }
  remove() {
    this.removed = true;
  }
  fire(type: 'load' | 'error') {
    [...(this.handlers[type] ?? [])].forEach((h) => h());
  }
}

function setup(clientId: string | undefined = 'test-id', timeoutMs?: number) {
  const scripts: FakeScript[] = [];
  const doc = {
    createElement: () => new FakeScript(),
    head: {
      appendChild: (s: FakeScript) => {
        scripts.push(s);
        return s;
      },
    },
  } as unknown as Document;
  const win = {} as Window & { navermap_authFailure?: () => void };
  const loader = createNaverLoader({ clientId, timeoutMs, doc, win });
  const listener = vi.fn();
  loader.subscribe(listener);
  const live = () => scripts.filter((s) => !s.removed);
  return { loader, scripts, live, win, listener };
}

/** maps.js와 GL 서브모듈(maps-gl.js) load를 차례로 발생시킨다. */
function loadAll(scripts: FakeScript[], from = 0) {
  scripts[from]!.fire('load');
  scripts[from + 1]!.fire('load');
}

describe('createNaverLoader', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('Client ID가 비어 있으면 script 없이 config-error', () => {
    const { loader, scripts } = setup('');
    expect(loader.getStatus()).toBe('loading');
    loader.start();
    expect(loader.getStatus()).toBe('config-error');
    expect(scripts).toHaveLength(0);
  });

  it('maps.js load만으로는 ready가 아니고 GL load 후 ready', () => {
    const { loader, scripts, listener } = setup();
    loader.start();
    expect(scripts[0]!.src).toContain('/openapi/v3/maps.js?ncpKeyId=test-id');
    expect(scripts[0]!.src).not.toContain('callback=');
    scripts[0]!.fire('load');
    expect(loader.getStatus()).toBe('loading');
    expect(scripts).toHaveLength(2);
    expect(scripts[1]!.src).toContain('/openapi/v3/maps-gl.js');
    scripts[1]!.fire('load');
    expect(loader.getStatus()).toBe('ready');
    expect(listener).toHaveBeenCalled();
  });

  it('maps.js error는 network-error', () => {
    const { loader, scripts } = setup();
    loader.start();
    scripts[0]!.fire('error');
    expect(loader.getStatus()).toBe('network-error');
  });

  it('GL 서브모듈 script error는 network-error', () => {
    const { loader, scripts } = setup();
    loader.start();
    scripts[0]!.fire('load');
    scripts[1]!.fire('error');
    expect(loader.getStatus()).toBe('network-error');
  });

  it('timeout 경과 시 network-error', () => {
    const { loader } = setup('test-id', 1000);
    loader.start();
    vi.advanceTimersByTime(999);
    expect(loader.getStatus()).toBe('loading');
    vi.advanceTimersByTime(1);
    expect(loader.getStatus()).toBe('network-error');
  });

  it('기본 timeout은 15초', () => {
    const { loader } = setup();
    loader.start();
    vi.advanceTimersByTime(14999);
    expect(loader.getStatus()).toBe('loading');
    vi.advanceTimersByTime(1);
    expect(loader.getStatus()).toBe('network-error');
  });

  it('ready 이후 timeout은 상태를 바꾸지 않는다', () => {
    const { loader, scripts } = setup('test-id', 1000);
    loader.start();
    loadAll(scripts);
    vi.advanceTimersByTime(5000);
    expect(loader.getStatus()).toBe('ready');
  });

  it('navermap_authFailure는 loading 중에도, ready 이후에도 auth-error', () => {
    const a = setup();
    a.loader.start();
    a.win.navermap_authFailure!();
    expect(a.loader.getStatus()).toBe('auth-error');

    const b = setup();
    b.loader.start();
    loadAll(b.scripts);
    expect(b.loader.getStatus()).toBe('ready');
    b.win.navermap_authFailure!();
    expect(b.loader.getStatus()).toBe('auth-error');
  });

  it('navermap_authFailure는 script 삽입 전에 등록된다', () => {
    const { loader, win } = setup();
    loader.start();
    expect(typeof win.navermap_authFailure).toBe('function');
  });

  it('start()를 두 번 불러도 script는 하나', () => {
    const { loader, scripts } = setup();
    loader.start();
    loader.start();
    expect(scripts).toHaveLength(1);
  });

  it('retry()는 이전 script를 제거하고 새 script 하나로 loading', () => {
    const { loader, scripts, live } = setup();
    loader.start();
    scripts[0]!.fire('error');
    expect(loader.getStatus()).toBe('network-error');
    loader.retry();
    expect(scripts[0]!.removed).toBe(true);
    expect(live()).toHaveLength(1);
    expect(loader.getStatus()).toBe('loading');
  });

  it('first attempt timeout then retry ready ignores late first callbacks', () => {
    const { loader, scripts, listener } = setup('test-id', 1000);
    loader.start();
    vi.advanceTimersByTime(1000);
    expect(loader.getStatus()).toBe('network-error');
    loader.retry();
    loadAll(scripts, 1);
    expect(loader.getStatus()).toBe('ready');
    const first = scripts[0]!;
    const calls = listener.mock.calls.length;
    first.fire('load');
    first.fire('error');
    expect(scripts).toHaveLength(3);
    expect(loader.getStatus()).toBe('ready');
    expect(listener.mock.calls.length).toBe(calls);
  });

  it('dispose during loading ignores late load', () => {
    const { loader, scripts, win, listener } = setup('test-id', 1000);
    const original = vi.fn();
    win.navermap_authFailure = original;
    loader.start();
    scripts[0]!.fire('load');
    const calls = listener.mock.calls.length;
    loader.dispose();
    scripts[0]!.fire('load');
    scripts[1]!.fire('load');
    vi.advanceTimersByTime(5000);
    expect(loader.getStatus()).toBe('loading');
    expect(listener.mock.calls.length).toBe(calls);
    expect(win.navermap_authFailure).toBe(original);
  });

  it('dispose는 원래 navermap_authFailure가 없으면 해제한다', () => {
    const { loader, win } = setup();
    loader.start();
    loader.dispose();
    expect(win.navermap_authFailure).toBeUndefined();
  });

  it('subscribe 해제 후에는 리스너가 호출되지 않는다', () => {
    const { loader, scripts } = setup();
    const l = vi.fn();
    const off = loader.subscribe(l);
    off();
    loader.start();
    scripts[0]!.fire('error');
    expect(l).not.toHaveBeenCalled();
  });
});
