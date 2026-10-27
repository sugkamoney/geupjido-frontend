/**
 * NAVER Maps GL SDK loader.
 *
 * 준비 신호: `maps.js`를 삽입해 load되면 이어서 GL 서브모듈 `maps-gl.js`를
 * 순차 삽입하고, 그 load를 GL 준비로 본다(`submodules=gl`/`callback=`은 쓰지 않는다).
 * 지도 생성·init 확인은 adapter 몫이다.
 */
export type LoaderStatus =
  'loading' | 'ready' | 'auth-error' | 'network-error' | 'config-error';

export interface NaverLoader {
  getStatus(): LoaderStatus;
  subscribe(l: () => void): () => void;
  /** 진행 중이거나 끝났다면 무시한다(중복 삽입 없음). */
  start(): void;
  /** 이전 시도를 정리하고 새로 시작한다. */
  retry(): void;
  /** 타이머·핸들러·전역 콜백을 정리하고 이후 모든 콜백을 무시한다. */
  dispose(): void;
}

const MAPS_URL = 'https://oapi.map.naver.com/openapi/v3/maps.js';
const GL_URL = 'https://oapi.map.naver.com/openapi/v3/maps-gl.js';
const DEFAULT_TIMEOUT_MS = 15000;

type AuthWindow = Window & { navermap_authFailure?: () => void };

export function createNaverLoader(options: {
  clientId: string | undefined;
  timeoutMs?: number;
  doc?: Document;
  win?: Window;
}): NaverLoader {
  const { clientId, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const doc = options.doc ?? document;
  const win = (options.win ?? window) as AuthWindow;

  let status: LoaderStatus = 'loading';
  let attempt = 0;
  let started = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cleanups: Array<() => void> = [];
  let authInstalled = false;
  let originalAuth: (() => void) | undefined;
  const listeners = new Set<() => void>();

  function setStatus(next: LoaderStatus) {
    if (status === next) return;
    status = next;
    listeners.forEach((l) => l());
  }

  function teardownAttempt() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    cleanups.forEach((c) => c());
    cleanups = [];
  }

  function restoreAuth() {
    if (!authInstalled) return;
    if (originalAuth) win.navermap_authFailure = originalAuth;
    else delete win.navermap_authFailure;
    authInstalled = false;
    originalAuth = undefined;
  }

  function insert(src: string, onLoad: () => void, onError: () => void) {
    const script = doc.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    cleanups.push(() => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      script.remove();
    });
    doc.head.appendChild(script);
  }

  // 빈 응답이나 실행 실패한 script는 load만 발생하므로 전역을 직접 확인한다.
  function hasMaps() {
    return !!(win as Window & { naver?: { maps?: unknown } }).naver?.maps;
  }

  function begin() {
    const current = ++attempt;
    started = true;
    const active = () => !disposed && current === attempt;
    const fail = (next: LoaderStatus) => {
      if (!active()) return;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      setStatus(next);
    };

    if (!clientId) {
      setStatus('config-error');
      return;
    }
    setStatus('loading');

    if (!authInstalled) {
      originalAuth = win.navermap_authFailure;
      authInstalled = true;
    }
    win.navermap_authFailure = () => fail('auth-error');

    timer = setTimeout(() => fail('network-error'), timeoutMs);

    insert(
      `${MAPS_URL}?ncpKeyId=${encodeURIComponent(clientId)}`,
      () => {
        if (!active()) return;
        if (!hasMaps()) return fail('network-error');
        insert(
          GL_URL,
          () => {
            if (!active()) return;
            if (!hasMaps()) return fail('network-error');
            if (timer !== undefined) clearTimeout(timer);
            timer = undefined;
            // 이미 auth-error로 끝난 시도는 ready로 되돌리지 않는다.
            if (status === 'loading') setStatus('ready');
          },
          () => fail('network-error'),
        );
      },
      () => fail('network-error'),
    );
  }

  return {
    getStatus: () => status,
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    start() {
      if (disposed || started) return;
      begin();
    },
    retry() {
      if (disposed) return;
      teardownAttempt();
      begin();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      attempt++;
      teardownAttempt();
      restoreAuth();
      listeners.clear();
    },
  };
}
