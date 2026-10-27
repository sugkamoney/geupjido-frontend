# NAVER 지도 SDK 연결 작업 인수인계

> 상태: 구현 중(Task 4 화면 연결 완료) · 갱신: 2026-10-27

## 시작 기준과 요청

사용자는 상위 저장소를 `develop`으로 전환하고 최신 `develop`의 `5830f1e`에서
`feature/integrate-naver-map-sdk` 브랜치와 Orca workspace를 생성하도록 요청했다.
Claude 세션에서 구현 방식 브레인스토밍부터 진행하며 제품 코드는 아직 작성하지 않는다.
PR #6은 병합됐고 GitHub Frontend CI check는 성공했다.

Workspace는 `/Users/user/orca/workspaces/geupjido-frontend/feature-integrate-naver-map-sdk`다.
상위 저장소의 미커밋 문서 5개는 `codex-preserve-main-docs-before-develop-2026-10-27`
stash에 보존했다. 해당 변경을 이 브랜치에 적용하지 않았다. 특히 이전 OpenAPI 생성
정책 변경을 현재 계약으로 자동 채택하지 말고 필요한 경우 별도로 검토한다.

## 현재 구현과 읽을 자료

디자인 시스템·AppShell·지도 탐색/상세·검색·월드컵 UI는 develop에 통합됐다.
지도는 가상 grid와 fixture adapter이며 실제 NAVER SDK·검증된 geometry·제품 API는
미연결이다. 기존 선택·검색·카메라 이동·월드컵 연결과 데스크톱/모바일 동작을 살핀다.

- [지도 구조와 검증](map-exploration.md)
- [검색 구조](search.md), [월드컵 구조](worldcup.md), [앱 화면 틀](app-shell.md)
- [디자인 핸드오프](../product/design-handoff.md), [플랫폼 지원](../product/platform-support.md)
- `src/features/map-exploration/`의 types·fixture-adapter·map-surface·use-map-input
- 지도/검색 SDD와 [기존 API 설계](../superpowers/specs/2026-09-19-map-api-and-runtime-design.md)

9월의 cluster·정수 zoom 기준을 그대로 적용하지 않는다. 최신 핸드오프의 fractional
zoom·구/권역 라벨·단지 핀·선택 면과 기존 코드가 우선 검토 대상이다. 시각 기준은
AGENTS.md의 Figma 작업공간이며 실제 디자인 검토 시 해당 Figma skill을 따른다.

## 브레인스토밍 범위

기존 adapter 교체 범위와 SDK loader/객체 수명주기, 카메라·projection·overlay·패널
가림 영역 처리, 기존 gesture와 SDK gesture의 책임, 오류/재시도와 fixture 검토 경로
유지 방식을 조사한다. 공개 Client ID·등록 origin·GL 스타일 metadata·검증된 좌표
자료의 준비 상태를 값 노출 없이 확인하고, SDK 최신 기능은 공식 문서로 검증한다.
실제 SDK 연결과 API/geometry 준비 대기 범위를 구분해 대안을 제시한다.

데스크톱과 모바일 웹 모두 지원하며 실제 touch·짧은 화면·접근성 검증 범위를
설계한다. 모바일 최소 viewport/OS와 실제 좌표 정확성을 임의로 확정하지 않는다.
키나 비공개 환경 정보는 문서에 넣지 않는다.

2026-10-27 GitHub 읽기 전용 확인에서 backend develop은
`206b0e0980e85ff9f3494c422de8a929178b87bc`다. 단지 선택 적재와 실거래 저장·수동 적재가
추가됐으나 전체 파일 트리에 제품 controller는 없다. 서버/DB/실제 데이터는 검증하지
않았다. backend 변경은 요청 범위가 아니며 수기 UI source를 확정 OpenAPI로 보지 않는다.

## 다음 세션 진행

Claude는 superpowers brainstorming을 사용해 기존 코드와 문서를 먼저 읽고,
핵심 미결 범위를 사용자에게 한 번에 한 질문씩 확인한다. 접근 방식의 대안과 권장안을
논의하고 사용자가 선택·승인한 설계 뒤에 구현 계획으로 넘어간다. 이 인수인계는 구현
승인이 아니다. 의존성 설치·baseline 검사는 설계 이후 구현 준비 시 진행한다.
현재 조정 세션의 Node는 v25.8.0이고 pnpm은 PATH에 없었다. 프로젝트 README의
지원 Node/pnpm 버전을 확인해 기존 도구 관리 설정을 사용한다.

이번 환경 준비에서 제품 코드·테스트·의존성은 변경하지 않았으며 테스트는 미실행이다.
후속 제품/구조 결정은 적절한 SDD·architecture·ADR에 기록하고 INDEX를 유지한다.

## 브레인스토밍 중간 결정 (2026-10-27, 설계 승인 전)

- 완료 장면: 실제 NAVER 서울 지도 위에 기존 라벨·핀이 뜨고 드래그·줌이 동작한다.
- Client ID·개발 origin 등록은 사용자와 함께 준비한다. 값은 `.env.local`에만 둔다.
- 좌표는 실제 지도 기준의 검토용 WGS84 좌표를 새로 만든다. 실제 경계·지적 자료가 아님을 유지한다.
- 라벨·핀은 커스터마이징을 위해 React overlay로 직접 그린다(SDK 마커 미사용).
- 지도 로드 실패 시 grid 대체 없이 오류 안내·재시도를 보여 준다. grid adapter는 테스트 주입용으로만 남긴다(Claude 판단).
- 드래그·휠·핀치는 SDK 제스처에 맡기는 안을 권장안으로 둔다(Claude 판단, 설계 문서에서 확정).
- NAVER 기본 POI·행정동 라벨 숨김은 다음 단계로 미룬다. [지도 탐색 결정](../product/specs/map-exploration/decisions.md)의 미결 결정에 기록했다.
- 모바일은 데스크톱 브라우저 에뮬레이션·자동 테스트까지만 확인하고 실기기는 다음 단계로 미룬다(사용자 결정).
- 실수 줌 규칙(12.5/14.5, 면 투명도)을 유지하기 위해 첫 연결부터 GL 지도(`gl: true`, GL 서브모듈)로 띄운다(사용자 결정). customStyleId는 미적용.
- 다음: Client ID 발급·origin 등록 → 버리는 spike로 GL 실수 줌·projection·드래그 중 이벤트 확인 → 설계 문서 작성·승인 → 구현 계획.

## GL spike 결과 (2026-10-27, 버리는 코드, 저장소 밖에서 실행)

`http://localhost:5173` 등록 origin에서 `maps.js?ncpKeyId=…&submodules=gl`과 `gl: true`로 확인했다.

- 인증 통과(`navermap_authFailure` 미호출), 서울 GL 지도 렌더 확인.
- 초기 zoom 12.5 유지, `setZoom(13.37)` 그대로 반영, 휠 줌 중 `zoom_changed`가 13.46→13.65처럼 연속 소수값으로 발생. 실수 줌 규칙 유지 가능.
- `getProjection().fromCoordToOffset(LatLng)`가 지도 컨테이너 기준 pixel을 반환(중심 좌표 → 컨테이너 중앙).
- `submodules=gl`과 `callback=` 비동기 로드를 함께 쓰면 `maps-gl.js`에서 `naver` 미정의 예외가 났다. loader는 callback 대신 script `load` 이후 초기화하거나 GL 준비 신호를 별도로 확인해야 한다.
- 자동화 드래그는 합성 이동이라 드래그 중 이벤트 빈도는 판단하지 않았다. overlay 동기화 빈도는 구현 시 실제 입력으로 확인한다.
- GL 준비 신호 probe(2026-10-27, headless Chromium + swiftshader, 동적 `<script>` 삽입, 등록 origin): (a) `maps.js?ncpKeyId=…&submodules=gl` + `naver.maps.onJSContentLoaded`와 (b) `maps.js` load 뒤 `maps-gl.js` 순차 삽입 모두 `new naver.maps.Map(el, { gl: true })`가 예외 없이 `init`됐고 `getProjection().fromCoordToOffset`이 유한한 값을 반환, `navermap_authFailure` 미호출. loader는 실패(script `error`)를 감지할 수 있는 (b)를 채택했다. GL 준비 신호는 `maps-gl.js` script `load`다. (a)는 서브모듈 실패 신호가 없어 timeout에만 의존한다.

## overlay 제스처 실제 SDK smoke (Task 4 Step 4b, 2026-10-27)

`pnpm dev`(`http://localhost:5173`, 등록 origin)에서 Playwright headless Chromium으로 실제 입력
(`page.mouse` down/move/up, 모바일 에뮬레이션은 CDP `Input.dispatchTouchEvent`)을 보내고 지도
region의 `data-zoom`/`data-center-*`로 카메라 변화를 확인했다. 버리는 스크립트이며 저장소에 두지 않았다.

**렌더 모드 주의.** SwiftShader(`--use-gl=swiftshader`)에서는 SDK가 GL을 쓰지 않고 raster 지도로
대체한다(canvas 없음, img 타일, zoom 정수 반올림: 12.5→13, `setZoom(13.37)`→13). 실제 GPU
(`--use-angle=metal --enable-gpu`, Apple M4 Pro)에서는 `.mapboxgl-canvas` GL 지도가 뜨고 실수 zoom이
유지된다. loader 방식(순차 `maps-gl.js` / `submodules=gl`)과 무관하게 같았다. GL 검증은 실제 GPU로 한다.

**SDK 입력 요소(CDP `DOMDebugger.getEventListeners`).**
- 공통: SDK container > div > div에 mouse·touch·`mousewheel` listener. window/document에 drag 중
  capture listener.
- GL: 그 안의 `.mapboxgl-canvas-container`(z-index 10)에 mousedown·touchstart·wheel·dblclick 등.
  canvas가 container 전체를 덮는다.

**결과.**

| 구조 | 라벨에서 마우스 드래그 | 라벨 위 휠 | 짧은 클릭 | 터치 드래그(라벨) | 짧은 탭 | 핀치(라벨) |
| --- | --- | --- | --- | --- | --- | --- |
| 형제 배치(canvas 옆 overlay, 출발 구조, raster) | 지도 안 움직임 | 줌 안 됨 | 선택됨 | 지도 안 움직임 | 미확인 | 미확인 |
| portal(SDK 입력 요소 안 host), GL | 이동, 선택 없음 | 줌 | 선택됨 | 이동, 선택 없음 | 선택됨(zoom 12.55) | 10.10→11.60 줌, 선택 없음 |
| portal, raster 대체 | 이동, 선택 없음 | 줌 | 선택됨 | 이동, 선택 없음 | 선택됨 | 10→12 줌, 선택 없음 |

빈 지도 드래그·휠은 모든 구조에서 동작했다. 선택 "1회"는 RTL(`exploration-naver.test.tsx`)이 검사하고 smoke는 선택 상태만 봤다. 드래그 120×40px 뒤 라벨도 정확히 120×40px 이동했다
(overlay 동기화). GL에서 host를 canvas container 밖에 두면 canvas(z-index 10)가 라벨을 덮어
클릭이 canvas로 갔다.

**채택 구조.** `NaverMapAdapter`가 ready 때 overlay host(`div[data-overlay-host]`, absolute inset 0,
z-index 2, `pointer-events: none`)를 만든다. GL이면 `.mapboxgl-canvas-container`, raster면
container > div > div, 둘 다 없으면 container의 마지막 자식으로 둔다. `MapSurface`는 overlay(면·
라벨·핀·hover)를 `createPortal`로 host에 그린다. 라벨·핀 버튼만 `pointer-events: auto`다. 이
DOM 위치는 공개 API가 아니므로 SDK 갱신 때 이 smoke를 다시 한다. 고지·상태 UI는 portal 밖
지도 region에 남는다. NAVER 로고·저작권 표기(SDK z-index 100)는 overlay 위에 보인다.

**projection 수정.** raster 대체에서 `fromCoordToOffset`은 pane 기준이라 drag·`setCenter` 뒤 같은
좌표의 값이 그대로였다(zoom 변경 때만 원점 갱신). GL에서는 container 기준이었다. 두 경우 모두
맞도록 adapter는 "좌표 offset − 현재 center offset + 화면 중앙"으로 project/unproject한다.
위 GL spike 기록의 "fromCoordToOffset이 컨테이너 기준"은 GL에서만 맞다.

**입력 관찰(`observe`).** 지도 region이 pointer down/move/up/cancel·두 번째 pointer·blur·capture
상실을 관찰만 하고(capture 안 함), 6px 이상 이동·두 번째 pointer·취소 순간과 휠·더블클릭에서
`adapter.noteUserGesture()`를 부른다. 라벨·핀은 SDK 입력 요소 안에 있으므로 그 위의 휠·더블클릭도
조작으로 알린다. `noteUserGesture`는 ready 전에는 no-op이라 로딩 중 드래그가 보관 목적을 지우지 않는다.
