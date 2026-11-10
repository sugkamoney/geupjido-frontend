# NAVER 지도 SDK 연결 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 NAVER GL 지도 위에 기존 React 라벨·핀·선택 면을 띄우고, 드래그·줌과 기존 선택·검색·월드컵 흐름을 유지한다.

**Architecture:** 화면 pixel `Point`와 지도 좌표 `LatLng`를 분리하고, 같은 WGS84 검토용 데이터를 `NaverMapAdapter`(실제)와 `FixtureMapAdapter`(테스트용 Web Mercator grid)가 공유한다. provider는 빌드 시점 `VITE_MAP_PROVIDER`로 고른다. SDK는 지도 이동 입력을 맡고, `useMapInput`은 NAVER 모드에서 선택 억제·anchor 해제를 위한 관찰자로만 동작한다.

**Tech Stack:** React 19 / TypeScript 5.9 / Vite 8 / Vitest + RTL / Playwright, NAVER Maps JavaScript API v3 GL 서브모듈, `@types/navermaps`.

**Spec:** [`docs/superpowers/specs/2026-10-27-naver-map-sdk-design.md`](../specs/2026-10-27-naver-map-sdk-design.md) — 특히 "NAVER adapter 필수 계약" 1~4.

## Global Constraints

- Node `^24.15.0 || >=26.0.0`, pnpm `11.13.0`(`packageManager`). PATH에 pnpm이 없으면 `corepack pnpm …`을 쓴다.
- 새 의존성은 `@types/navermaps` 하나(devDependency, 기존처럼 정확한 버전 고정). 그 외 추가 금지.
- script URL은 `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=…`. `ncpClientId`·`callback=`을 쓰지 않는다.
- Client ID 값은 `.env.local`에만 있다. 값을 코드·문서·커밋·로그·snapshot·캡처에 남기지 않는다. `.env.local`을 읽어 출력하지 않는다.
- 줌 수치는 재조정하지 않는다: 범위 9.5~17, 구/권역 12.5, 단지 핀 14.5, 면 투명도 12.5 미만 0·13.5에서 0.3·14.5에서 0.1, 전체 보기 fit 제한 `[9.5, 12.49]`, 구 선택 `[12.55, 13.5]`, 권역 선택 최소 12.5, 목록 단지 선택 최소 15, fit padding 48.
- 실제 사용 경로에서 grid 대체 금지. 검토용 좌표에 임의 오프셋 금지. 검토용 고지는 계속 보인다.
- 오류 문구(고정):
  - 인증 실패: `지도 인증에 실패했습니다. 등록된 주소에서 접속했는지 확인해 주세요.`
  - 네트워크 오류: `지도를 불러오지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.`
  - 설정 누락: `지도 설정이 없습니다.`
  - 버튼: `다시 시도`
- 커밋 형식: `feature(web): 한글 설명` / `docs: 한글 설명`(이슈 번호 없음 → 대괄호 생략), 빈 줄 뒤 간단한 본문, 이모지 금지, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 기존 회귀 테스트는 기대값을 새 좌표에 맞게 고칠 수 있지만 시나리오를 지우거나 약화하지 않는다.

## Review Focus

1. 실제 드래그·관성 중 overlay가 지도에서 늦거나 튐 → Task 6 수동 smoke에서 실제 마우스로 확인하고, 미흡하면 Task 4의 동기화 방식을 rAF로 바꾼다.
2. React StrictMode 이중 mount에서 지도 객체가 둘 생기거나 listener가 남음 → Task 4 `exploration-naver.test.tsx`의 StrictMode 테스트.
3. 프로그램 이동(morph) 중 frame/resize 변경 시 anchor 재적용이 튀거나 사용자 조작으로 오인됨 → Task 3 `setViewport during programmatic motion keeps anchor` 테스트.
4. 모바일 시트처럼 mount 시점 컨테이너 크기가 0 → Task 3 `zero-size viewport never yields NaN` 테스트.
5. SDK 카메라 이벤트 중 hover 카드가 남음 → Task 4 `SDK camera change clears hover card` 테스트.

---

### Task 1: LatLng 좌표 타입과 WGS84 검토용 데이터

`Point`가 화면 pixel과 지도 좌표를 겸하던 것을 분리하고, 같은 데이터로 grid도 동작하게 한다. 이 task가 끝나면 앱은 여전히 grid지만 좌표는 실제 서울 기준이다.

**Files:**
- Modify: `src/features/map-exploration/types.ts`, `fixtures.ts`, `fixture-adapter.ts`, `model.ts`, `map-surface.tsx`, `exploration-page.tsx`, `use-map-input.ts`(타입만)
- Modify tests: `model.test.ts`, `camera-motion.test.ts`, `map-surface.test.tsx`, `exploration.test.tsx`, `src/features/search/model.test.ts`, 필요한 `e2e/*.spec.ts` 기대값
- Create: `src/features/map-exploration/mercator.ts`, `mercator.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type Point = { x: number; y: number };          // 화면 pixel만
  export type LatLng = { lat: number; lng: number };     // WGS84
  export type GeoBounds = { sw: LatLng; ne: LatLng };
  // MapLabel.point: LatLng, MapLabel.bounds: GeoBounds, Zone.polygon: LatLng[],
  // Apartment.point: LatLng, ExplorationData.overview: GeoBounds
  export type Camera = { center: LatLng; zoom: number; revision: number };
  export type MapStatus = 'loading' | 'ready' | 'auth-error' | 'network-error' | 'config-error';
  export interface MapAdapter {
    /** 입력 모드·고지 문구·grid 배경을 결정하는 capability. 빌드 env가 아니라 실제 adapter를 따른다. */
    readonly kind: 'naver' | 'fixture';
    getSnapshot(): Camera; subscribe(l: () => void): () => void;
    getStatus(): MapStatus;               // fixture: 항상 'ready'
    mount(container: HTMLElement): void;  // fixture: no-op
    retry(): void;                        // fixture: no-op
    setViewport(size: Size, frame: MapFrame): void;
    project(p: LatLng): Point; unproject(p: Point): LatLng;
    center(target: LatLng, zoom?: number, animate?: boolean): void;
    fit(b: GeoBounds, padding?: number, zoomLimits?: [number, number], animate?: boolean): void;
    zoom(delta: number, around?: Point, animate?: boolean): void;
    pan(delta: Point): void;              // 화면 pixel
    releaseAnchor(): void; destroy(): void;
    /** SDK가 처리한 사용자 조작 시작 알림. fixture는 구현하지 않는다. */
    noteUserGesture?(): void;
  }
  ```
  `subscribe` 리스너는 camera와 status 변경 모두에 호출된다. `getSnapshot`·`getStatus`는 값이 바뀔 때만 새 값을 반환한다(useSyncExternalStore 안정성). `FixtureMapAdapter.kind = 'fixture'`.
- Produces (`mercator.ts`): `worldPixel(p: LatLng, zoom: number): Point`, `fromWorldPixel(p: Point, zoom: number): LatLng` — 256px 타일 Web Mercator(`256 * 2^zoom` 세계 크기). grid의 zoom이 NAVER zoom과 같은 축척 의미를 갖게 한다.

- [ ] **Step 0: 설계 문서 커밋과 baseline** — 브레인스토밍 단계의 미커밋 문서(`decisions.md` v0.8, 인수인계·`docs/architecture/INDEX.md`, 설계·계획 문서)를 `docs: NAVER 지도 SDK 연결 설계와 계획 기록`으로 먼저 커밋한다. 이어서 `corepack pnpm install --frozen-lockfile` 후 `pnpm check` 통과, `pnpm test:e2e --workers=3` 결과를 기록한다(실패가 있으면 이 task 전에 보고).
- [ ] **Step 1: 실패 테스트 작성** — `mercator.test.ts`: `fromWorldPixel(worldPixel(p, z), z)`가 `{lat: 37.527, lng: 127.0286}`에서 1e-9 이내로 왕복, zoom +1이면 두 점 사이 pixel 거리 2배. `camera-motion.test.ts`·`map-surface.test.tsx`·`exploration.test.tsx`의 `{x, y}` 지도 좌표를 `LatLng`로 바꾸고, `project` 기대값을 Mercator 기준으로 다시 계산한다(예: frame `{x:400,y:0,width:600,height:800}`에서 `center(t, 15)` 후 `project(t)`는 frame 중앙 `{x:700,y:400}`). `model.test.ts`의 12.49/12.5·14.49/14.5·opacity 기대값은 그대로 둔다.
- [ ] **Step 2: 실패 확인** — `pnpm test -- src/features/map-exploration src/features/search` → 타입/기대값 실패.
- [ ] **Step 3: 구현**
  - `types.ts`를 위 계약으로 바꾼다. `Bounds`는 삭제하고 사용처를 `GeoBounds`로 옮긴다.
  - `FixtureMapAdapter`의 `2 ** (zoom - 12.9)` 축척을 `mercator.ts`로 바꾼다. `getStatus()`는 `'ready'`, `mount`/`retry`는 no-op. 기존 애니메이션(300ms ease-out cubic), reduced motion, anchor/fit 재적용, clamp 9.5~17 동작은 유지한다. 보간은 `lat`/`lng`로 한다.
  - `fixtures.ts`를 아래 값으로 다시 쓴다. ID·이름·grade·area·세대수·단지 수(19)는 유지한다. 주석은 `/** 실제 지도 기준 대략 위치의 검토용 WGS84 좌표. 경계·지적·NAVER·거래·투표 자료 아님. */`.
    | id | point (lat, lng) | bounds sw → ne |
    | --- | --- | --- |
    | gangnam | 37.4959, 127.0664 | (37.460, 127.015) → (37.535, 127.125) |
    | seongdong | 37.5506, 127.0409 | (37.535, 127.010) → (37.572, 127.075) |
    | seocho | 37.4769, 127.0378 | (37.430, 126.980) → (37.520, 127.095) |
    | apgujeong | 37.5270, 127.0286 | 중심 ±(0.005 lat, 0.009 lng) |
    | cheongdam | 37.5230, 127.0490 | 〃 |
    | seongsu | 37.5446, 127.0560 | 〃 |
    | banpo | 37.5045, 126.9960 | 〃 |
    - `overview`: `(37.430, 126.980) → (37.575, 127.125)`.
    - `zone()` helper의 polygon은 중심 기준 5각형 비율을 유지하되 lat 편차 ±0.005, lng 편차 ±0.009 이내로 만든다. 압구정·청담·성수 polygon의 북/남쪽 끝이 한강(대략 37.532~37.540) 위로 나가지 않게 한다: 압구정·청담은 lat 최대 +0.004, 성수는 lat 최소 −0.004.
    - 압구정 단지 18개는 `(37.5250 + floor(i/5)*0.0012, 127.0250 + (i%5)*0.0018)`, 청담 단지는 `(37.5232, 127.0495)`.
  - `model.ts`의 `layoutOverlays`는 `project: (p: LatLng) => Point`를 받는다. 그 외 정책은 그대로 둔다.
  - `exploration-page.tsx`의 `zone?.point ?? { x: 0, y: 0 }` 폴백은 `data.overview` 중심 LatLng로 바꾼다.
  - `map-surface.tsx`의 `data-center-x/y`는 `data-center-lat/lng`로 바꾸고 e2e helper도 맞춘다.
- [ ] **Step 4: 통과 확인** — `pnpm check` 통과, `pnpm test:e2e --workers=3`이 baseline과 같은 시나리오 수로 통과(축척 변화에 따른 `data-zoom` 기대값(15·9.5·17 등)만 근거와 함께 수정).
- [ ] **Step 5: 커밋** — `feature(web): 지도 좌표를 WGS84 검토용 데이터로 전환`

---

### Task 2: NAVER SDK loader

**Files:**
- Create: `src/features/map-exploration/naver/loader.ts`, `loader.test.ts`, `src/vite-env.d.ts`(env 타입), 필요 시 `naver/navermaps-gl.d.ts`(GL 옵션 타입 보강)
- Modify: `package.json`, `pnpm-lock.yaml`(`@types/navermaps`), `tsconfig.app.json`의 `types`에 `navermaps`

**Interfaces:**
- Consumes: `MapStatus`(Task 1).
- Produces (`loader.ts`):
  ```ts
  export type LoaderStatus = 'loading' | 'ready' | 'auth-error' | 'network-error' | 'config-error';
  export interface NaverLoader {
    getStatus(): LoaderStatus;
    subscribe(l: () => void): () => void;
    start(): void;        // 진행 중이면 무시(중복 삽입 없음)
    retry(): void;        // 이전 시도 정리 후 새 시도
    dispose(): void;      // 타이머·script 핸들러·전역 콜백 정리, 이후 모든 콜백 무시
  }
  export function createNaverLoader(options: {
    clientId: string | undefined;
    timeoutMs?: number;            // 기본 15000
    doc?: Document; win?: Window;  // 테스트 주입
  }): NaverLoader;
  ```
  loader의 `ready` = `naver.maps`와 GL 서브모듈 준비 완료(필수 계약 1 첫 항목). 지도 생성·`init`·projection 확인은 Task 3 adapter 몫이다.
  - `env.d.ts`: `VITE_NAVER_MAP_CLIENT_ID?: string`, `VITE_MAP_PROVIDER?: 'naver' | 'fixture'`.

- [ ] **Step 1: 실제 SDK로 GL 준비 신호 확인(버리는 probe, 저장소 밖 scratchpad)** — 등록 origin `http://localhost:5173`에서 동적 `<script>` 삽입으로 두 방식을 비교한다.
  - (a) `maps.js?ncpKeyId=…&submodules=gl` 삽입 + `naver.maps.onJSContentLoaded`
  - (b) `maps.js` load 뒤 `maps-gl.js` 순차 삽입
  
  각 방식에서 `new naver.maps.Map(el, { gl: true })`가 예외 없이 `init`되는지 확인한다. 동작한 방식과 신호를 `docs/architecture/naver-map-sdk-handoff.md` spike 절에 기록한다. 둘 다 실패하면 중단하고 보고한다. probe 파일과 서버는 끝나면 지운다. 키는 출력하지 않는다.
- [ ] **Step 2: 의존성** — `corepack pnpm add -D -E @types/navermaps@<현재 최신>`; `tsconfig.app.json` `types`에 `"navermaps"`를 추가한다. 타입에 `gl` 옵션이 없으면 `navermaps-gl.d.ts`로 `MapOptions`에 `gl?: boolean`을 보강한다.
- [ ] **Step 3: 실패 테스트 작성** (`loader.test.ts`, 가짜 `doc`/`win`와 fake timers)
  - `clientId` 빈 값 → `start()` 직후 `config-error`, script 미삽입.
  - script `load`만 발생하고 GL 신호가 없으면 `loading` 유지 → GL 신호 후 `ready`.
  - script `error` → `network-error`. GL 서브모듈 script `error`(방식 b) → `network-error`.
  - `timeoutMs` 경과 → `network-error`.
  - `win.navermap_authFailure()` 호출 → `auth-error`(ready 이후에도).
  - `start()` 두 번 → script 1개.
  - `retry()` → 이전 script 제거, 새 script 1개, 상태 `loading`.
  - `first attempt timeout then retry ready ignores late first callbacks`: 첫 시도 timeout → `retry()` → 두 번째 ready → 첫 시도 script의 `load`/GL 신호를 늦게 발생 ⇒ `ready` 유지, 리스너 추가 호출 없음.
  - `dispose during loading ignores late load`: `dispose()` 뒤 `load`/GL 신호 ⇒ 상태 불변, 리스너 미호출, `win.navermap_authFailure` 해제.
- [ ] **Step 4: 실패 확인** — `pnpm test -- src/features/map-exploration/naver/loader.test.ts` → FAIL(모듈 없음).
- [ ] **Step 5: 구현** — 시도 번호(`attempt`)를 올리며 각 핸들러는 `attempt === current && !disposed`일 때만 상태를 바꾼다. 전역 `navermap_authFailure`는 현재 시도에 연결된 함수로 교체하고 `dispose` 때 원래 값으로 복원한다. GL 신호는 Step 1에서 확인한 방식으로 구현한다.
- [ ] **Step 6: 통과 확인** — 위 테스트 PASS, `pnpm typecheck && pnpm lint` 통과.
- [ ] **Step 7: 커밋** — `feature(web): NAVER 지도 SDK loader 추가`

---

### Task 3: NaverMapAdapter

**Files:**
- Create: `src/features/map-exploration/naver/naver-adapter.ts`, `naver-adapter.test.ts`, `naver/fake-naver.ts`(테스트 전용 가짜 `naver.maps`)

**Interfaces:**
- Consumes: `MapAdapter`, `LatLng`, `GeoBounds`, `MapStatus`(Task 1), `NaverLoader`(Task 2).
- Produces:
  ```ts
  export class NaverMapAdapter implements MapAdapter {
    constructor(options: { loader: NaverLoader; overview: GeoBounds; getMaps?: () => typeof naver.maps; initTimeoutMs?: number /* 기본 10000 */ });
    readonly kind = 'naver';
    /** 관찰 계층(Task 4)과 SDK dragstart/pinchstart가 호출. anchor·fit·보관/진행 중 목적 해제. */
    noteUserGesture(): void;
  }
  ```
  - `getStatus()` = loader가 `ready`이고 지도 `init` 후 projection이 유한값을 내면 `ready`, loader 오류면 그 오류, 지도 생성/초기화 예외는 `network-error`, 그 외 `loading`.
  - **초기화 timeout**: loader ready 후 지도 생성 시점부터 `initTimeoutMs` 안에 `init`과 유효한 projection이 확인되지 않으면 `network-error`. 타이머는 ready 확정·`retry()`·`destroy()` 때 정리하고, 이전 지도 시도의 늦은 `init`은 무시한다(loader와 같은 시도 번호 규칙).
  - `mount(container)`: 같은 container에 두 번 호출해도 지도는 하나다. loader가 ready가 되면 `new maps.Map(container, { gl: true, center, zoom, minZoom: 9.5, maxZoom: 17, keyboardShortcuts: false, scaleControl/logo 등 기본 })`. 키보드는 우리 region이 처리한다.
  - `retry()`: 지도 객체·listener 정리 후 `loader.retry()`.
  - `setViewport(size, frame)`: 지도가 있으면 SDK에 크기 변경을 알리고(`setSize` 또는 `autoResize`), 기존 fixture와 같은 anchor/fit 재적용 규칙을 따른다.
- `fake-naver.ts`: `Map`(getCenter/setCenter/getZoom/setZoom/morph/panBy/fitBounds/getProjection/setSize/destroy), `LatLng`, `LatLngBounds`, `Point`, `Event.addListener/removeListener/trigger`를 제공한다. projection은 Task 1 `mercator.ts`를 쓰고, 테스트에서 `init`·카메라 이벤트를 수동 발생시킬 수 있다.

- [ ] **Step 1: 실패 테스트 작성** (`naver-adapter.test.ts`)
  - 상태: loader ready 전 `loading` → ready + `init` → `ready`; `Map` 생성자 throw → `network-error`; loader `auth-error` 전파.
  - 준비 전 명령(필수 계약 2):
    - `center(A)` → `center(B)` → ready ⇒ 지도 중심 B, 애니메이션 없음.
    - `center(A)` → `releaseAnchor()` → ready ⇒ `overview` fit(`[9.5, 12.49]`, padding 48).
    - `center(B, 15)` → `zoom(1)` ×2, `pan({x:50,y:0})` → ready ⇒ B, zoom 15.
    - `fit(bounds)` 보관 후 ready ⇒ 그 bounds fit.
    - 준비 전 `project`/`unproject`가 throw하지 않고 유한값을 낸다.
  - 초기화 timeout:
    - `loader ready then no init becomes network-error`: loader ready → `init` 미발생 → `initTimeoutMs` 경과 ⇒ `network-error`.
    - `init` 후에도 projection이 NaN을 내는 동안 timeout ⇒ `network-error`.
    - timeout 뒤 `retry()` → 새 지도 `init` ⇒ `ready`; 이전 지도의 늦은 `init` ⇒ 상태 불변, 지도 1개.
    - `destroy()` 뒤 timeout 경과 ⇒ 리스너 미호출(fake timers로 대기 타이머 0 확인).
  - 사용자 조작(필수 계약 3):
    - `center(A)` 뒤 `noteUserGesture()` → `setViewport` 변경 ⇒ A로 재중심하지 않음.
    - fake에서 `dragstart`·`pinchstart` trigger ⇒ 같은 결과.
    - `center(A, 15, true)`가 일으킨 `center_changed`/`zoom_changed`는 anchor를 해제하지 않는다.
    - `setViewport during programmatic motion keeps anchor`: 이동 중 frame 변경 ⇒ 목표 A 유지.
  - frame:
    - frame `{x:400,y:0,width:600,height:800}`에서 `center(A)` 후 `project(A)` ≈ `{x:700,y:400}`(±1px).
    - `fit(b, 48)` 후 b의 sw/ne 투영이 frame 안쪽 48px 이내.
    - `zero-size viewport never yields NaN`: size·frame 0에서 center/fit/zoom 후 snapshot 값이 모두 유한.
  - 카메라: SDK `zoom_changed`/`center_changed`마다 snapshot revision 증가, `getSnapshot()`은 이벤트 사이에 같은 객체를 반환(useSyncExternalStore 안정성).
  - animate: `center(A, 15, true)`는 `morph` 계열 호출, reduced motion 또는 `animate=false`는 즉시 `setCenter`/`setZoom`.
  - `destroy()` ⇒ 모든 `addListener` 핸들 `removeListener`, `map.destroy()` 호출, `loader.dispose()`, 이후 loader 콜백 무시.
- [ ] **Step 2: 실패 확인** — `pnpm test -- src/features/map-exploration/naver/naver-adapter.test.ts` → FAIL.
- [ ] **Step 3: 구현** — 보관 목적은 `{ kind: 'center', target, zoom } | { kind: 'fit', bounds, padding, limits } | undefined` 하나로 둔다. 프로그램 이동 중 발생한 SDK 이벤트는 내부 `programmatic` 깊이/세대 표시로 사용자 조작과 구분한다. frame 중심 이동은 projection으로 목표 zoom에서의 offset을 계산하거나 SDK `padding`을 쓴다(spec 위임). 실제 SDK 카메라 API 선택(`morph`/`panTo`/`fitBounds` margin)은 Task 6 smoke로 검증한다.
- [ ] **Step 4: 통과 확인** — 위 테스트 PASS, `pnpm typecheck && pnpm lint`.
- [ ] **Step 5: 커밋** — `feature(web): NAVER 지도 adapter 구현`

---

### Task 4: 화면 연결 — provider 선택, 상태 UI, 입력 관찰

**Files:**
- Create: `src/features/map-exploration/map-provider.ts`, `map-status.tsx`, `exploration-naver.test.tsx`
- Modify: `exploration-page.tsx`, `map-surface.tsx`, `use-map-input.ts`, `map-target.tsx`, `map-exploration.css`, `map-surface.test.tsx`, `.env.example`

**Interfaces:**
- Consumes: Task 1~3 전부.
- Produces:
  - `map-provider.ts`: `createDefaultMapAdapter(data: ExplorationData): MapAdapter` — `import.meta.env.VITE_MAP_PROVIDER === 'fixture'`이면 `FixtureMapAdapter(data.overview)`, 아니면 `NaverMapAdapter({ loader: createNaverLoader({ clientId: import.meta.env.VITE_NAVER_MAP_CLIENT_ID }), overview: data.overview })`. env는 **기본 adapter 생성에만** 쓴다. 입력 모드·고지·배경은 화면이 `adapter.kind`로 정한다(`'naver'` → `observe`, `'fixture'` → `drive`). 그래서 기본 env가 naver여도 `FixtureMapAdapter`를 주입한 기존 단위 테스트는 지금처럼 pinch·double tap을 `drive`로 검사한다. 별도 테스트용 inputMode prop은 두지 않는다.
  - `MapSurface`는 camera와 status를 **각각** `useSyncExternalStore(adapter.subscribe, adapter.getSnapshot)`, `useSyncExternalStore(adapter.subscribe, adapter.getStatus)`로 구독한다. camera 객체가 그대로여도 status 변경만으로 재렌더된다.
  - `useMapInput(adapter, root, onInteraction, mode: 'drive' | 'observe')`: `drive`는 현재 동작 그대로. `observe`는 카메라를 바꾸지 않고(`adapter.pan/zoom` 호출 없음, wheel/dblclick에서 줌 안 함) pointer 이동 ≥ 6px·두 번째 포인터·cancel·blur·capture 상실을 `moved`로 기록한다. moved가 되는 순간과 `wheel`·`dblclick` 때 `adapter.noteUserGesture?.()`(Task 1 계약)를 호출한다. 키보드(화살표·`+/-`)는 두 모드 모두 adapter로 보낸다.
  - `MapTarget`의 `capture?: boolean`(기본 true). NAVER 모드는 `false`로 넘겨 pointer capture를 하지 않는다. 선택은 pointerup 6px·`canActivate`, WebKit retarget click 억제(`touchend.preventDefault`)는 유지한다.
  - `MapStatusView({ status, onRetry, onReload })`: `loading`은 `지도를 불러오는 중입니다.`(`role="status"`), 오류 3종은 고정 문구 + `다시 시도` 버튼(`role="alert"`). `network-error` → `onRetry`(=`adapter.retry()`), `auth-error`·`config-error` → `onReload`(기본 `window.location.reload()`).

- [ ] **Step 1: 실패 테스트 작성** (`exploration-naver.test.tsx`, Task 3 fake + 가짜 loader 주입)
  - loading 중 라벨·핀 없음, `지도를 불러오는 중입니다.` 표시. 검색 입력·상세는 사용 가능.
  - `status-only change renders error`: camera snapshot은 같은 객체로 둔 채 status만 `network-error`/`auth-error`로 바꾸고 리스너 호출 ⇒ 해당 alert 표시.
  - 기존 `map-surface.test.tsx`·`exploration.test.tsx`(FixtureMapAdapter 주입)는 수정 없이 `drive` 동작(pinch·double tap 줌)으로 통과한다.
  - 오류 3종 문구와 `다시 시도`. network에서 클릭 ⇒ `adapter.retry` 1회. auth/config에서 클릭 ⇒ `onReload` 1회.
  - ready 뒤 라벨 렌더, 고지 문구 `검토용 데이터 · 실제 위치·시세 미검증`(데스크톱 span)·`검토용 데이터`(모바일 span), "NAVER 지도" 문구 없음. fixture 모드 문구는 현재 그대로 유지.
  - `observe` 모드: 라벨에서 pointerdown → 102px 이동 → pointerup ⇒ 선택 안 됨, `adapter.center`·`pan` 미호출, `noteUserGesture` 1회. 두 손가락(라벨에서 시작) ⇒ 선택 안 됨. 짧은 탭 ⇒ 선택 1회. pointercancel 뒤 다음 탭 ⇒ 선택 1회.
  - `SDK camera change clears hover card`: 마우스 hover로 tooltip 표시 → fake `center_changed` ⇒ tooltip 없음.
  - StrictMode로 `ExplorationPage` 렌더 → 정리 → 재mount ⇒ fake `Map` 인스턴스 1개, 정리 후 남은 listener 0.
  - 로딩 중 검색 A → 검색 B → loader ready ⇒ 지도 중심 B. 로딩 중 검색 A → 상세 닫기 → ready ⇒ overview fit.
- [ ] **Step 2: 실패 확인** — `pnpm test -- src/features/map-exploration` → 새 테스트 FAIL, 기존 PASS.
- [ ] **Step 3: 구현**
  - `ExplorationPage` 기본 adapter를 `createDefaultMapAdapter(data)`로 바꾼다(주입 우선은 유지).
  - `MapSurface`: root 안에 SDK용 `div.exploration-map-canvas`(absolute inset 0)를 두고 layout effect에서 `adapter.mount(node)`. 출발 구조는 canvas와 overlay 형제 배치(overlay 컨테이너 `pointer-events: none`, `MapTarget`·hover 카드·고지·상태 UI만 `pointer-events: auto`)이며, 대상에서 시작한 제스처 전달은 아래 Step 4b 결과로 확정한다. `status !== 'ready'`면 overlay(면·라벨·핀·hover)를 그리지 않고 `MapStatusView`를 그린다. `useMapInput` mode·고지 문구·grid 배경은 `adapter.kind`로 고른다. `kind === 'naver'`이면 grid 배경 CSS를 끈다.
  - `.env.example`에 등록 origin 안내(`http://localhost:5173`, `http://127.0.0.1:4173`, 값 없음)와 `VITE_MAP_PROVIDER=naver|fixture` 설명을 추가한다.
- [ ] **Step 4: 통과 확인** — `pnpm check` 통과.
- [ ] **Step 4b: overlay에서 시작한 제스처의 실제 SDK smoke(이 task 완료 조건)** — 가짜 SDK RTL로는 증명할 수 없으므로 여기서 실제로 확인한다. `pnpm dev`(5173)에서 라벨·핀 위에서 마우스 드래그, 휠, 모바일 에뮬레이션 touch 드래그를 시작해 SDK 지도가 움직이는지, 끝났을 때 선택되지 않는지, 짧은 탭은 1회 선택되는지 본다. SDK가 입력을 받는 요소(canvas/컨테이너 내부 pane)를 DevTools로 확인한다. 형제 배치에서 전달되지 않으면 다음 순서로 바꾼다.
  1. React portal로 overlay를 SDK 컨테이너 내부(예: `naver.maps.OverlayView`의 pane 또는 SDK 컨테이너 안 전용 div)에 렌더해 이벤트가 SDK 입력 요소의 조상 경로로 전달되게 한다. 이 경우 project 좌표 기준(컨테이너 pixel)과 pane 변환이 맞는지 함께 확인한다.
  2. 그래도 안 되면 "대상 위에서 시작한 지도 이동 미지원"을 ADR-007 초안에 사유·대안과 함께 남기고(설계 허용 범위), 선택 억제만 보장한다.

  결과(채택 구조, 확인한 입력 요소, 데스크톱/에뮬레이션별 결과)를 `docs/architecture/naver-map-sdk-handoff.md`에 기록한다. 구조를 바꿨으면 Step 1 테스트를 다시 돌려 통과를 확인한다.
- [ ] **Step 5: 커밋** — `feature(web): 지도 화면을 NAVER adapter와 상태 안내에 연결`

---

### Task 5: E2E 구성 분리와 NAVER 오류 시나리오

**Files:**
- Modify: `playwright.config.ts`, `.gitignore`, `.prettierignore`, `eslint.config.js`
- Create: `e2e/naver-error.spec.ts`

**Interfaces:**
- Consumes: Task 4 화면(`role="alert"`, 문구, `다시 시도`).
- Produces: `pnpm test:e2e` 하나로 두 구성이 실행된다.
  - fixture: 포트 `PLAYWRIGHT_PORT ?? 4173`, `dist-e2e/fixture`.
  - naver-error: 포트 `+1`(4174), `dist-e2e/naver-error`.

- [ ] **Step 1: 설정** — `webServer`를 두 항목 배열로 바꾼다. `tsc -b` 경합을 피하려고 E2E 빌드는 `vite build`를 직접 호출한다(타입 검사는 `pnpm check` 담당).
  - fixture: `cross-env NODE_ENV=production VITE_MAP_PROVIDER=fixture vite build --outDir dist-e2e/fixture && vite preview --outDir dist-e2e/fixture --host 127.0.0.1 --port 4173 --strictPort`
  - naver-error: `cross-env NODE_ENV=production VITE_MAP_PROVIDER=naver VITE_NAVER_MAP_CLIENT_ID=e2e-fake vite build --outDir dist-e2e/naver-error && vite preview --outDir dist-e2e/naver-error --host 127.0.0.1 --port 4174 --strictPort`
  
  process env가 `.env.local`보다 우선하므로 실제 ID가 섞이지 않는다. 기존 세 project는 fixture baseURL과 `testIgnore: /naver-error/`, 새 `naver-error-chromium`·`naver-error-webkit`(iPhone 13) project는 4174 baseURL과 `testMatch: /naver-error/`. `dist-e2e/`를 `.gitignore`·`.prettierignore`·eslint `ignores`에 추가한다.
- [ ] **Step 2: 실패 테스트 작성** (`naver-error.spec.ts`)
  - `network-error`: `page.route('**/oapi.map.naver.com/**', r => r.abort())` → `/` 진입 ⇒ alert에 네트워크 문구, `다시 시도` 보임, 라벨 없음. route를 가짜 성공(빈 script)으로 바꾸고 `다시 시도` ⇒ 새 script 요청 1회 발생(요청 수 기록).
  - `auth-error`: route가 `window.navermap_authFailure && window.navermap_authFailure()`만 담은 script를 반환 ⇒ 인증 문구.
  - 검색 입력은 오류 상태에서도 열린다.
- [ ] **Step 3: 확인** — `pnpm test:e2e --workers=3` ⇒ 기존 fixture 시나리오 + naver-error 시나리오 모두 PASS, `dist/`는 변경되지 않음(`git status`에 `dist-e2e` 미표시).
- [ ] **Step 4: 커밋** — `feature(web): 지도 E2E를 fixture와 NAVER 오류 구성으로 분리`

---

### Task 6: 실제 SDK smoke, 문서, 최종 검증

**Files:**
- Modify: `docs/product/specs/map-exploration/{README,requirements,acceptance-criteria,decisions}.md`, `docs/architecture/map-exploration.md`, `docs/architecture/naver-map-sdk-handoff.md`, `docs/architecture/INDEX.md`, `docs/architecture/frontend-implementation-status.md`, `docs/product/platform-support.md`, `docs/history/INDEX.md`
- Create: `docs/history/ADR-007-naver-gl-map-and-react-overlay.md`

- [ ] **Step 1: 실제 SDK smoke** — `pnpm dev`(포트 5173). 데스크톱 1280×720과 Chrome 모바일 에뮬레이션 390×844에서 다음을 확인한다.
  1. 상태가 ready로 바뀌는지(Task 2 신호)
  2. 세 구 라벨이 실제 구 위에 있는지
  3. 권역 클릭 → 면·상세 → 목록 단지 선택(zoom 15) → 지도 핀 선택(카메라 유지)
  4. 실제 마우스 드래그·관성·휠 줌 중 overlay 추종(Review Focus 1)
  5. 권역 선택 → 드래그 → 창 크기 변경 시 되돌아가지 않음
  6. 핀 위 드래그 시 미선택, Task 4 Step 4b에서 채택한 구조가 최종 빌드에서도 유지되는지
  7. DevTools Slow 3G에서 로딩 중 검색 선택 → ready 후 해당 위치
  8. 검색 선택
  9. reduced motion 즉시 이동
  10. 에뮬레이션 핀치(CDP 합성 touch로 시도)
  
  결과를 항목별 기대/실제로 기록한다. 실패 항목은 해당 Task로 돌아가 고친다. 핀치를 증명하지 못하면 "실제 SDK 핀치 미검증, 실기기 대기"로 기록한다. 캡처에 키가 없게 하고, 실제 화면 밀도가 어색한 점은 디자인 리뷰 항목으로 적는다.
- [ ] **Step 2: 문서**
  - SDD 4종: 실제 지도 바탕, 로딩·오류·재시도 문구, 검토용 좌표 고지, smoke 인수 시나리오. 버전·날짜·`## 변경 이력`.
  - architecture: provider 선택, loader 신호, adapter 필수 계약, 입력 관찰 모드, E2E 구성, 검증 결과·미실행 사유.
  - ADR-007: GL 채택, React overlay, SDK 제스처 위임+관찰 계층, 빌드 시점 provider·실사용 grid 금지. 선택지·trade-off·재검토 조건(POI 숨김, 실기기, 실제 API).
  - platform-support: 모바일은 에뮬레이션·자동 검증까지.
  - 인수인계 문서는 완료 상태로 갱신. INDEX 갱신.
- [ ] **Step 3: 최종 검증** — `pnpm check`, `pnpm test:e2e --workers=3` 통과. 출력의 테스트 수를 구조 문서에 기록한다.
- [ ] **Step 4: 커밋** — `docs: NAVER 지도 연결 구조와 검증 결과 기록`. push·PR은 사용자 요청이 있을 때만 한다.
