# 지도 탐색 구조·구현 계획·검증

> 상태: 검토 UI 구현·검증 완료 · 실제 SDK/API 연동 대기 · 버전: 0.4 · 갱신: 2026-10-14

## 목표와 구현 경계

[제품 SDD](../product/specs/map-exploration/README.md)를 구현한다. React/TS·기존 AppShell·공통 UI·Figma 토큰을 재사용한다. 사용자 승인 범위에 따라 구현·검증·커밋했고 후속 요청으로 push와 PR #4 생성을 진행했다. 코드리뷰 보완은 PR #4에 반영됐고, 2026-10-14 develop 1cf3013에 병합됐다. 검색은 이 기준에서 통합한다.

## 데이터와 어댑터

백엔드 develop은 2026-10-13 및 2026-10-14 읽기 전용 GitHub 조회에서 `dfb7cc4282979232f616113dd25704ee0b38b405`다. recursive tree에는 batch 외부 수집 DTO가 있지만 제품 controller·지도 OpenAPI가 없다. backend 파일은 변경하지 않는다.

`src/features/map-exploration/types.ts`의 UI 타입은 잠정 수기 계약이다. 백엔드 생성 OpenAPI가 아니다. `fixtures.ts`는 명시적 검토용 데이터이며 좌표는 가상 평면의 local point다. WGS84/실제 경계/거래가/투표 집계로 사용하지 않는다. 실제 공급자는 검증된 source CRS와 GeoJSON geometry, 표시 grade/stage, 정렬된 단지 목록을 제공해야 한다. 임의 180m/310m 보정은 하지 않는다.

`MapAdapter`는 camera snapshot·subscribe·project/unproject·frame·center/fit·pan/zoom·destroy를 공급한다. 현재는 `FixtureMapAdapter`다. 실제 SDK adapter는 같은 선택 계약에 연결하되 SDK pixel projection으로 남는 영역 중심을 계산한다. fixture 투영을 실제 좌표에 재사용하지 않는다.

상세 `ExplorationSource.loadZone(id, signal)`은 교체 가능하다. 권역 변경/닫기/unmount마다 AbortController를 취소하고 request identity도 확인해 취소를 무시하는 공급자의 늦은 응답까지 차단한다. ID별 렌더와 중복 제거를 사용한다. 상세 실패는 해당 권역에만 안내·재시도를 제공한다.

## 파일과 단계별 계획

실행 방법은 executing-plans, 기능 검증은 test-driven-development를 적용한다.

### Task 1: 지도 모델과 대체 어댑터

- [x] `model.test.ts`에서 12.49/12.5·14.49/14.5, 면 alpha, 선택 우선 충돌, 세대순 이름, fit/frame·카메라 이동 차이를 실패로 확인한다.
- [x] `types.ts`, `model.ts`, `fixture-adapter.ts`, `fixtures.ts`를 구현한다. 모델은 `visibleLabels`, `visibleApartments`, `layoutOverlays`, `polygonOpacity`, adapter는 `MapAdapter` 계약을 제공한다.
- [x] `pnpm test -- src/features/map-exploration/model.test.ts` 통과 확인.

### Task 2: 상세·선택·지도 입력

- [x] `exploration.test.tsx`에서 핀/목록 이동 차이, 닫기·구 해제, 상세 취소·늦은 응답, 재시도·중복·unmount 검사를 먼저 실패시킨다.
- [x] `exploration-page.tsx`, `map-surface.tsx`, `zone-detail.tsx`, `use-zone-detail.ts`, `map-exploration.css`를 추가한다. source/adapter를 주입하고 기존 shell map/frame/command/detail/search 계약을 연결한다.
- [x] AppShell에 선택적 제어 표시 단위와 모바일 목록 선택 시 시트 접힘 요청을 추가하되 기존 fixture 계약·pointerup 처리는 유지한다.
- [x] 지도 입력은 pointer capture·pan/pinch·double tap·keyboard를 처리하고 overlay 선택은 touch pointerup에서 1회 처리한다. hover timer는 이동/선택/unmount에 정리한다.
- [x] `pnpm test` 통과 확인.

### Task 3: 브라우저·시각 검증과 기록

- [x] `e2e/map-exploration.spec.ts`에 desktop/mobile Chromium/WebKit의 선택·frame·focus·scroll·touch/keyboard·작은 화면 시나리오를 추가하고 실패→성공 확인.
- [x] `pnpm check`, 기존 UI/shell 포함 `pnpm test:e2e --workers=3` 실행, Figma와 캡처 대조.
- [x] SDD 4개·INDEX·통합 현황·이 문서에 기대/실제·미실행 사유 기록하고 한국어 규칙으로 커밋.

## 리뷰 초점

- 핀 클릭으로 상세가 열릴 때 frame 변경이 카메라를 움직이지 않아야 한다.
- 선택 권역/단지가 zoom 아래에서도 한 번만 렌더되어야 한다.
- 닫거나 빠르게 선택을 바꾼 후 오래된 상세 응답은 표시되지 않아야 한다.
- 모바일 pointercancel/핀치 후 tap이 중복 활성화되지 않아야 한다.
- frame이 0이거나 좁을 때 camera 계산이 NaN이 되지 않아야 한다.

## baseline와 실제 SDK 확인

frozen install과 pnpm check 통과(기존 RTL 15개). 4173 포트가 비어 있음을 확인하고 기존 브라우저 검사를 실행한다.

NAVER 공식 [MapOptions](https://navermaps.github.io/maps.js.ncp/docs/naver.maps.html)는 GL 서브모듈을 로드했을 때 `customStyleId`를 적용한다고 명시한다. 일반 raster map에 해당 옵션만 설정해 POI를 숨겼다고 해석하지 않는다. MD의 행정동 라벨·아파트 POI 개별 숨김은 발행된 Style Editor metadata와 실제 SDK에서 확인해야 한다. 현재 설정 성공이나 fractional zoom 실제 동작을 주장하지 않는다. API·키·공개 style metadata·검증된 CRS가 연결되지 않아 실제 SDK smoke는 미실행이다.


## 구현 결과와 검증

`/`와 `/map-exploration`은 명시적인 지도 검토 경로다. 기존 `/app-shell`, `/design-system`을 유지한다. source/adapter를 주입할 수 있고 AppShell에는 선택적 표시 단위·시트 상태 제어를 추가했다. 코드 작성·수정은 100% AI다. 초기 전체 보기, 선택 면/라벨/핀, 지도의 pointer capture·pan/pinch/double tap·keyboard, 상세/단지 목록 선택과 clearing을 구현했다.

지도/목록의 카메라 동작은 분리한다. 지도 핀은 anchor를 해제해 상세/시트 frame이 변경돼도 카메라가 이동하지 않는다. 권역/목록은 anchor를 남겨 frame이 바뀌면 남는 영역 가운데로 옮긴다. 사용자 pan/zoom은 anchor를 해제한다. frame 0은 안전하게 유지하고 잘못된 수치로 계산하지 않는다.

선택 행 스크롤은 목록이 숨겨진 모바일 시트에서 즉시 적용되지 않는 것을 브라우저에서 재현했다. 목록 ResizeObserver로 다시 보일 때/크기 변경 때 가운데를 맞추고 observer를 정리한다. 별도 markup 중복 없이 선택 상세와 지도 pin을 연결한다. 상세에만 존재하는 선택 단지도 viewport overlay로 유지한다.

상세 변경/닫기/unmount 취소, source가 abort를 무시해도 이전 응답 차단, 닫힌 응답의 재사용 방지, 중복 ID 제거·재시도를 검증했다. fixture viewport 데이터는 동기 정적 공급이며 실제 bounds 요청/debounce/cache 파이프라인 검증은 이 결과에 포함되지 않는다. fixture의 초기 내부 측정 크기 fallback은 layout 준비용이며 운영 좌표를 보정하지 않는다.

| 검사 | 기대 | 실제 결과 |
| --- | --- | --- |
| frozen install·baseline | lockfile 그대로, 기존 검사 통과 | baseline check RTL 15개, 브라우저 40 통과/14 적용 제외 |
| pnpm check | 토큰·TS·lint·format·RTL·build 모두 통과 | 통과, RTL 42개·8파일, production build 성공 |
| 전체 Playwright | UI·shell 기존 회귀와 지도 동작 통과 | 61개 통과·20개 플랫폼 적용 제외·실패 0. 지도는 21개 통과/6개 제외 |
| 지도 RTL | 경계/충돌/카메라·선택·취소·hover·cleanup | model 7, 입력 5, 선택/상세 10, 클릭 모션 5: 27개 통과 |
| 모바일 Chromium 터치 스트림 | pan/pinch/double tap과 sheet/list scrolling 분리 | CDP 실제 touch stream 통과, tap 줌 1회·camera 불변 목록 scroll |
| 모바일 WebKit | tap·keyboard·선택·시트·focus·작은 화면 | repository Playwright 통과, 물리 swipe 대체로 주장하지 않음 |
| 실제 SDK/API smoke | credentials/계약/geometry로 통합 확인 | 미실행: 제품 API·검증된 CRS·SDK key/style 환경 미연결 |

초기 실패와 수정: 목록이 숨겨진 상태의 scroll, 2px tap 흔들림으로 선택 취소, touch double tap 뒤 호환 dblclick의 중복 zoom, 초기 camera와 전체 fit의 불일치를 각각 실패→성공으로 확인했다. 테스트의 이름 충돌 가정(핀 몸통은 이름 바로 아래이므로 동일 위치의 첫 이름은 유지)과 NODE_ENV=test 실행을 바로잡았다. RTL role query의 미지원 exact 옵션·React useRef 초기값을 보완했다. 기존 home 회귀가 모바일 h1 숨김을 발견해 제목과 검토 고지를 함께 유지했다. 테스트를 삭제하거나 retries/timeout을 늘리지 않았다. 최종 검증 중 pnpm check와 Playwright의 build를 병렬 실행해 dist가 교체된 실행은 WebKit shell 3건이 JS 404로 실패했다. trace에서 삭제된 이전 JS asset 요청을 확인해 제품 결함과 구분했고, 같은 dist를 사용하는 검증은 순차 실행했다.

20개 제외는 기존 shell/UI의 플랫폼별 14개, 지도 PC hover를 모바일에서 2개, CDP touch stream을 desktop/WebKit에서 2개, mouse capture 검사를 모바일에서 2개다. WebKit tap·keyboard 검사와 물리적 swipe 검증을 구분한다.

## 시각 대조와 모바일 제한

Figma `594:20791/20846/20951/21033/21099` 및 상세 `594:21005`를 읽고 screenshot을 확인했다. sparse한 줌13 화면은 자식 권역 라벨 `594:20912`와 원본 `187:273`, 핀 `490:2113`, 목록 `460:931`의 고해상도 context로 보완했다. 1920 desktop과 iPhone WebKit 렌더를 대조했으며 원본 집 배경·선택 흰 테두리·26×16 칩·86×53 라벨·28×28 핀 몸통/16 아이콘·22 이름 알약·65 목록행과 공통 상세 카드 자산을 사용한다. 최종 브라우저 측정은 원본 자산 로드 모두 성공, 라벨 53·핀 몸통 28·아이콘 16·desktop 목록행 65 CSS px다. 원본 SVG 자연 크기와 slot metadata는 public/assets/README.md에 남겼다.

지도 바탕은 명시적인 가상 grid, geometry/좌표/grade는 예시다. 화면 전체 pixel 일치·실제 NAVER 지도 일치·실제 급지/시세 일치를 주장하지 않는다. 미연결 단계/비교 버튼 상태는 의도적인 고지다. 모바일 Figma 화면은 없고 HTML/MD는 참고용이다. 320×568, 800×600 및 기존 shell의 320/짧은 높이 검사를 포함하며 최소 지원값으로 확정하지 않는다. 상세가 펼쳐진 작은 화면에서 남는 지도 영역이 작아지는 기존 배치는 다음 디자인 리뷰 대상이다.

실기기 iOS/Android gesture·가상 키보드/주소창·VoiceOver, 실제 최신 Chrome/Edge/Safari, 대규모 데이터 성능, 운영 배포·이 브랜치 원격 CI는 미실행이다. 실제 기기·데이터·배포 또는 후속 PR 환경이 필요하다. 내장 Browser metadata bootstrap은 이전 작업 및 독립 리뷰에서도 실패해 repository Playwright로 검증했다.

## 독립 리뷰와 경계 판단

requesting-code-review 스킬에 따라 독립 읽기 전용 리뷰를 수행했다. Important 2건을 실패 테스트로 재현해 같은 보완 패스에서 수정했다.

- 마커에서 시작한 mouse drag를 지도 밖에서 놓으면 pointer가 남는 문제: 마커에서도 pointer capture를 설정해 밖의 종료 이벤트를 수신한다. 실제 Chromium mouse stream 실패→성공.
- 낮은 zoom에서 닫으면 선택 덕분에 유지된 origin overlay가 제거되어 focus가 BODY로 빠지는 문제: 닫힌 렌더의 layout effect에서 origin 생존·표시를 확인해 지도 메뉴로 복귀한다. 권역/핀 RTL 실패→성공, 기존 shell 회귀 유지.

미수정 Critical/Important/Minor 결함은 없다. 리뷰가 판단을 유보한 사항은 다음과 같이 범위를 결정했다.

| 판단 대상 | 이번 처리와 이유 | 잘못 판단했을 때의 비용/다음 검토 |
| --- | --- | --- |
| 실제 SDK 투영·fractional zoom·POI 설정·SDK 정리 | 운영 adapter 미연결로 미검증 | SDK 통합 때 실제 projection/GL metadata와 smoke 확인 필요 |
| 실제 CRS·한강 제외 geometry·시세·grade/stage·정렬 | 평면 fixture로 검증하고 실제 정확성은 대기 | 실제 공급자 계약·원본 지점 대조·기획 정책 검토 필요 |
| 검색·월드컵 대진/투표/집계 | 사용자 지정 후속 범위 | 해당 기능 SDD·운영 연결 추가 필요 |
| 실기기·대규모 성능·최소 viewport | 작은 화면/engine 검증까지 수행 | 실기기·성능 측정과 지원 정책 확정 추가 필요 |
| Figma pixel·SVG 원본 | 부모가 context/원본 다운로드·메타데이터/렌더로 확인, fixture 전체 pixel 일치 제외 | 운영 지도와 실제 데이터 연결 후 전체 화면 시각 QA 필요 |
| 최종 회귀/문서 상태 | 부모가 최종 명령 결과 확인 및 문서 갱신 | 검증되지 않은 완료 주장 없이 실제 결과를 아래/표에 기록 |

결정 배경은 [ADR-005](../history/ADR-005-map-fixture-boundary.md)를 따른다. 계획의 inline 실행과 사용자 승인된 커밋 범위를 유지했다. 별도의 계획 승인 대기로 중단하지 않았으며 정상 동작 테스트 완료 후 로컬 한국어 커밋으로 마무리한다. 후속 사용자 요청으로 feature를 push하고 [PR #4](https://github.com/sugkamoney/geupjido-frontend/pull/4)를 develop 대상으로 생성했다. 원격 CI는 [checks](https://github.com/sugkamoney/geupjido-frontend/pull/4/checks)에서 최신 head 상태를 확인한다. merge는 수행하지 않았고 이 workspace의 개발 서버를 종료했다. 후속은 [상위 workspace 인수인계](map-exploration-handoff.md)를 따른다.

## 클릭 카메라 전환

사용자의 후속 요청으로 클릭 경로의 center/fit/zoom은 선택적 `animate` 옵션을 전달한다. FixtureMapAdapter는 300ms ease-out cubic으로 현재 center/zoom에서 목표를 보간한다. 이 시간은 현재 구현값이며 실제 SDK 연동 후 체감을 다시 검토한다. 초기 fit/측정과 wheel/pan/pinch/키보드 입력은 즉시 처리한다. NAVER 실제 SDK 효과 연결은 별도 대기다.

RAF와 같은 window.performance clock을 사용한다. 새 명령은 이전 RAF를 취소하고 generation을 변경해 이미 큐에 담긴 stale callback도 무시한다. 연속 zoom 버튼은 이전 목표 zoom에 누적하고 직접 gesture·지도 pin 선택·닫기·destroy는 취소한다. 패널/시트가 바뀌면 원래 목표 zoom을 보존해 새 frame으로 retarget한다. reduced-motion 설정은 명령 시작 시 확인해 즉시 적용한다.

모션 단위 검사 5개는 중간값·완료, frame retarget, 연속 zoom/직접 입력 취소, reduced-motion/release/destroy를 확인한다. 브라우저는 desktop/mobile Chromium·WebKit에서 실제 구 클릭의 중간 zoom과 reduced-motion 전환을 확인한다. 기존 선택·focus·sheet·gesture 회귀도 유지한다. 기존 위치 검사는 중간 프레임이 아닌 최종 목적지를 기다려 확인한다. 지도 브라우저 검사는 21개 통과·6개 플랫폼 적용 제외를 확인했다. 추가 독립 리뷰에서 직접 wheel/pinch가 클릭의 목표 zoom을 참조하던 Important 1건을 재현해 현재 표시 zoom에서 중단·delta 적용하도록 실패→성공으로 수정했다. 애니메이션 clock은 RAF와 같은 window clock으로 일관되게 읽고 테스트 clock도 동일하게 제어한다.

## 검색 연결

검색 선택도 selectLabel/selectApartment의 기존 zoneId/apartmentId를 사용한다. 구 fit padding/zoom 제한, 권역 max(현재,12.5), 단지 max(현재,15), motion interruption과 frame retarget을 유지한다. 검색 권역/단지가 viewport 데이터에 없으면 선택 대상을 overlay data에 보완한다. 상세 source 값을 viewport/search 후보보다 우선하고 상세 단지 목록도 ID별 최신 값으로 병합한다. 선택 해제 시 추가된 overlay도 제거한다. [검색 구조·검증](search.md)을 따른다.

## PR #4 전체 코드리뷰 보완

2026-10-14 사용자 요청으로 requesting-code-review 스킬의 독립 읽기 전용 리뷰를 수행했다. 범위는 develop `d3971c5`부터 PR head `63c0c74`까지다. Critical 0건·Important 5건·Minor 0건을 보고받았고, 아래 5건을 실패로 재현한 뒤 수정했다.

| 문제 | 수정과 기대 결과 | 실제 검증 |
| --- | --- | --- |
| drag 중 마커가 제거되면 pointer가 남음 | document capture에서 map 밖 pointerup/cancel/lostcapture와 blur 종료, unmount listener 정리 | 외부 종료 3개 단위 검사 및 desktop 실제 mouse 회귀 통과 |
| 667×375 펼친 시트 목록 높이가 0 | 높이 500 이하 모바일에서 펼친 시트를 하단 탐색 위까지 늘리고 summary/list를 별도 scroll, 목록 최소 65px | 모바일 Chromium/WebKit에서 목록 마지막 18번째 행·고정 제목 접근 통과 |
| 320×568 접힌 선택 행이 summary 아래에서 잘림 | `ShellDetail.collapsedSelection`을 scroll 밖 고정 영역에 렌더, 접혀 숨겨진 목록 focus를 선택 버튼으로 복귀 | 모바일 Chromium/WebKit에서 선택 행 전체 노출·Enter 선택 후 focus·재선택 확대 통과 |
| source의 최신 권역·단지 표시값 무시 | 상세 값을 viewport 요약보다 우선하고 지도에도 ID별 최신 항목 병합. 다른 권역/소속의 응답은 error/retry 처리 | 최신 grade/value/stage·단지 이름 반영 및 다른 권역 응답 거부 단위 검사 통과 |
| 긴 선택 이름의 충돌 영역이 150px로 잘림 | 선택 이름의 전체 추정 폭 예약, 일반 이름만 150px 제한 | 이웃 이름 겹침을 재현한 단위 검사 통과 |

수정 후 같은 독립 리뷰어가 코드·회귀 검사·문서를 다시 읽고 Important 5건 해결 및 신규 Critical/Important 없음으로 확인했다. 재검토는 테스트를 다시 실행하지 않았으며 위 실행 결과는 부모가 직접 검증했다.

좁은 모바일 회귀를 검증하면서 WebKit에서 pointerup 선택 직후 바뀐 배치의 시트 손잡이로 compatibility click이 전달되는 문제도 확인했다. MapTarget의 touchend 기본 동작을 막고 선택은 기존 pointerup 경로로 유지한다. 합성 click에 의존하지 않으며 키보드 click은 유지한다.

최종 `pnpm check`: 토큰·타입·lint·format·단위 48개/8파일·production build 통과. 이어 순차 실행한 `pnpm test:e2e --workers=3`: 기존 UI/shell 회귀를 포함해 desktop Chromium·mobile Chromium/WebKit 66개 통과, 24개 플랫폼 적용 제외. 추가 테스트는 단위 6개, 브라우저 5개 통과/4개 제외다. 제외 24개는 기존 20개와 마커 제거 mouse 회귀의 모바일 2개, 작은 모바일 배치 회귀의 desktop 2개다.

실제 SDK/API·CRS·geometry·급지/단계/시세 계산·검색/월드컵·실기기 gesture/VoiceOver·운영 대규모 성능과 전체 Figma pixel 승인은 이번 fixture 리뷰에서 판단할 수 없다. 운영 source/adapter 연결 및 정책 합의 시 별도 검증한다. 이번 수정은 지원 최소 viewport 정책을 확정하지 않는다.


## 변경 이력

| 버전 | 날짜 | 변경 |
| --- | --- | --- |
| 0.4 | 2026-10-14 | 지도 PR #4 develop 통합 후 검색 소스와 최신 상세 우선순위 조합 |
| 0.3 | 2026-10-14 | 지도 PR #4 리뷰 5건 보완 (48/66/24 검증) 및 viewport 독립 검색 연결 (분기별 기록 통합) |
| 0.2 | 2026-10-14 | 클릭 카메라 300ms 전환·중단/retarget·이동 효과 줄이기와 회귀 검증 추가 |
| 0.1 | 2026-10-14 | 최신 MD/Figma에 따른 지도 adapter·선택/상세 구현, 실패→성공 검증과 독립 리뷰·연동 경계 기록 |
