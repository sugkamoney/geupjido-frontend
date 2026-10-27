# NAVER 지도 SDK 연결 설계

> 상태: 초안(builder check·설계 리뷰 반영, 사용자 검토 대기) · 날짜: 2026-10-27 · 브랜치: `feature/integrate-naver-map-sdk`

## 의도

지금 지도 화면은 가상 grid와 가상 좌표로 동작한다. 이번 작업의 목표는 **실제 NAVER 서울
지도 위에 기존 구/권역 라벨, 단지 핀, 선택 권역 면이 뜨고 드래그·줌이 자연스럽게 되는
것**이다(사용자). 백엔드 제품 API가 아직 없으므로 데이터는 계속 검토용이며, 이번 단계는
"실제 지도 바탕 + 실제 위치 감각"을 확보해 이후 API·geometry 연결과 디자인 QA의 기반을
만드는 일이다.

## 목표

- 실제 사용 경로(`pnpm dev`, 운영 빌드)는 NAVER Maps JavaScript API v3 **GL 지도**를 띄운다.
- 기존 라벨·핀·선택 면·hover 카드·충돌 배치를 **React overlay로 그대로 유지**하고, SDK
  projection으로 위치를 계산한다.
- 기존 선택·상세·검색·월드컵 흐름, 핀 선택과 목록 선택의 카메라 차이, 패널에 가린 영역을
  피한 중심 이동(frame), 점진적 카메라 전환과 이동 효과 줄이기를 유지한다.
- 실수 줌 규칙(구→권역 12.5, 단지 핀 14.5, 면 투명도 보간)을 그대로 유지한다.
- 데스크톱과 모바일 웹 모두에서 드래그·휠·핀치 줌이 동작한다.
- 지도 로드 실패 시 지도 영역에 원인별 오류 안내와 재시도를 보여 준다.

## 비목표

- 백엔드 API·OpenAPI·TanStack Query 연결, 실제 geometry·거래가·급지·투표 연결.
- NAVER 기본 아파트 POI·행정동 라벨 숨김(Style Editor·`customStyleId`). 다음 단계로 미뤘다
  ([지도 탐색 결정](../../product/specs/map-exploration/decisions.md) 미결 항목).
- 모바일 실기기 검증. 이번에는 데스크톱 브라우저의 모바일 에뮬레이션과 자동 테스트까지다.
- SDK 마커(`naver.maps.Marker`)로 라벨·핀을 그리는 방식.
- 9월 설계의 cluster·정수 줌 규칙 복원.
- backend 저장소 변경.

## 반목표 (기술적으로 동작해도 실패로 본다)

- 실제 사용 경로에서 SDK가 실패했을 때 가상 grid로 조용히 대체하는 것.
- 검토용 좌표를 실제 경계·지적·시세 자료처럼 보이게 하는 것(고지 문구·코드 주석 제거 등).
- 좌표에 임의 오프셋(예: MD의 180m/310m) 보정을 넣는 것.
- Client ID 값을 문서·커밋·로그·테스트 snapshot에 남기는 것.
- 기존 선택·검색·월드컵 회귀 테스트를 지우거나 약화해 통과시키는 것.

## 제약과 확인된 사실

- Client ID는 사용자가 발급해 workspace의 `.env.local`(`VITE_NAVER_MAP_CLIENT_ID`, git
  ignore 대상)에 넣었다. 등록 origin은 `http://localhost:5173`과 `http://127.0.0.1:4173`이다.
  다른 포트·호스트에서는 인증 실패가 정상이다.
- 공식 [Getting Started](https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html):
  script는 `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=…`이며(`ncpClientId`는
  구 방식), 인증 실패 시 전역 `window.navermap_authFailure`가 호출된다.
- 공식 [MapOptions](https://navermaps.github.io/maps.js.ncp/docs/naver.maps.html): `gl`은 GL
  서브모듈을 로드해야 적용된다. `draggable`·`pinchZoom`·`scrollWheel`·`keyboardShortcuts`·
  `disableKineticPan`·`padding` 옵션이 있다.
- 2026-10-27 버리는 spike 결과(인수인계 문서에 기록):
  - `maps.js?ncpKeyId=…&submodules=gl` + `gl: true`로 인증 통과·서울 지도 렌더 확인.
  - 초기 zoom 12.5 유지, `setZoom(13.37)` 그대로 반영, 휠 줌 중 연속 소수 zoom 이벤트 발생.
  - `map.getProjection().fromCoordToOffset(latLng)`이 지도 컨테이너 기준 pixel을 반환.
  - **`submodules=gl`과 `callback=`을 함께 쓰면 `maps-gl.js`에서 `naver` 미정의 예외로
    지도가 뜨지 않았다.** script `load` 이후 초기화하는 방식은 동작했다.
  - 드래그 중 이벤트 빈도는 합성 입력이라 판단하지 못했다.
- 프로젝트 Node/pnpm은 `package.json`의 `engines`·`packageManager`(pnpm 11.13.0)를 따른다.
  조정 세션 PATH에는 pnpm이 없었다.
- 자동 E2E·CI는 NAVER 서버에 붙지 않는다(키·등록 origin 없음).

## 결정된 방식

### 사용자가 정한 것

| 항목 | 결정 |
| --- | --- |
| 완료 장면 | 실제 서울 지도 위 기존 라벨·핀, 드래그·줌 동작 |
| 좌표 | 실제 지도 기준 검토용 WGS84 좌표를 새로 작성 |
| 라벨·핀 | 커스터마이징을 위해 React로 직접 그림 |
| 로드 실패 | 오류 안내 + 재시도 |
| 기본 POI 숨김 | 다음 단계 |
| 모바일 | 에뮬레이션·자동 테스트까지 |
| 지도 방식 | 첫 연결부터 GL 지도 |

### Claude가 정한 것 (근거와 함께, 사용자 검토 대상)

1. **월드 좌표 타입 분리.** 화면 pixel `Point {x,y}`와 별개로 지도 좌표 `LatLng
   {lat,lng}`(WGS84)를 도입한다. `MapLabel.point`, `Zone.polygon`, `Apartment.point`,
   `Bounds`(`ExplorationData.overview`, 라벨 bounds)는 `LatLng` 기반으로 바꾼다.
   `MapAdapter.project/unproject`는 `LatLng ↔ 화면 Point`가 된다. 근거: 지금 `Point`가 두
   의미를 겸해 실제 좌표를 넣으면 x/y와 lng/lat 순서 실수가 생기기 쉽다.
2. **데이터는 하나, adapter는 둘.** fixture 데이터를 WGS84 검토용 좌표로 한 번 다시 쓰고,
   `NaverMapAdapter`(실제)와 `FixtureMapAdapter`(테스트용) 모두 같은 데이터를 쓴다.
   `FixtureMapAdapter`는 LatLng를 단순 평면(예: 위도 기준 equirectangular 또는 Web
   Mercator)으로 투영해 grid 위에 그린다. 근거: 데이터가 둘이면 검색·월드컵·E2E가 어긋난다.
3. **provider 선택은 빌드 시점 env.** `VITE_MAP_PROVIDER`(`naver` 기본, `fixture`)로 고른다.
   Playwright `webServer` 빌드는 `fixture`로 실행한다. 실제 사용 경로에는 grid 대체가 없다.
   단위 테스트는 지금처럼 `ExplorationPage`에 adapter를 주입한다.
4. **제스처 책임.** 지도를 실제로 움직이는 드래그·휠·핀치·더블클릭/더블탭 줌·관성은 SDK에
   맡긴다. `use-map-input`의 카메라 변경(pan/pinch/wheel → adapter 호출)은 NAVER provider에서
   쓰지 않는다. 다만 선택 억제를 위한 입력 관찰 책임은 남긴다([필수 계약](#naver-adapter-필수-계약) 4).
   화살표
   키 이동·`+/-` 줌은 SDK `keyboardShortcuts`를 끄고, 지금처럼 지도 region의 keydown →
   `adapter.pan/zoom`으로 유지한다(포커스 범위와 기존 키 동작 유지). 줌 버튼·전체 보기·
   선택에 따른 이동은 계속 adapter 메서드를 거친다.
5. **SDK loader는 단일 Promise.** script는 한 번만 삽입하고, ready 판정은
   [필수 계약](#naver-adapter-필수-계약) 1을 따른다. 결과 상태는 `loading | ready |
   auth-error | network-error | config-error(Client ID 없음)`다.
6. **줌 수치는 NAVER zoom 그대로 쓴다.** [디자인 핸드오프](../../product/design-handoff.md)의
   12.5/14.5 기준은 NAVER 지도 zoom으로 정의됐다. 지금 grid의 `2^(zoom-12.9)` 축척은 그
   기준을 흉내 낸 가상 값일 뿐이다. 따라서 범위 9.5~17, 전체 보기 fit 상한 12.49, 구 선택
   12.55~13.5, 권역 선택 최소 12.5, 목록 단지 선택 최소 15를 재조정하지 않는다. 실제 축척에서
   권역이 grid보다 작게 보이거나 권역 선택 직후 핀이 안 보이는 것은 디자인 기준의 결과로
   받아들인다. 검토용 polygon을 실제보다 크게 그려 보정하지 않는다. 실제 화면 밀도가
   어색하면 smoke 결과로 기록하고 디자인 리뷰 대상으로 넘긴다. FixtureMapAdapter 축척은
   E2E 기대값을 최소한으로 바꾸는 쪽으로 builder가 정한다.
7. **카메라 전환.** 클릭 경로의 `animate: true`는 SDK의 부드러운 이동(`morph`/`panTo` 등
   중 실제 동작이 맞는 것)으로, 이동 효과 줄이기(`prefers-reduced-motion`)와 `animate:
   false`는 즉시 이동으로 처리한다. 300ms를 정확히 맞출 필요는 없다.

## NAVER adapter 필수 계약

아래 네 가지는 builder 재량이 아니라 `NaverMapAdapter`·loader·입력 계층이 반드시 지켜야 하는
계약이다(2026-10-27 설계 리뷰 반영).

1. **script load와 GL 준비를 구분한다.** script `load` 이벤트만으로 ready로 보지 않는다.
   ready는 다음을 모두 만족한 시점이다.
   - `naver.maps`와 GL 서브모듈 코드가 준비됐다. 공식
     [서브모듈 문서](https://navermaps.github.io/maps.js.ncp/docs/tutorial-4-Submodules.html)는
     비동기 서브모듈의 완료 신호로 `naver.maps.onJSContentLoaded`를 안내한다(`callback`과
     함께 쓰면 `callback`만 호출된다). spike에서 `submodules=gl` + `callback=`은 실패했고
     `onJSContentLoaded`는 아직 시험하지 않았다. 구현 첫 단계에서 실제 SDK로
     `onJSContentLoaded`(또는 `maps.js` 뒤 `maps-gl.js`를 순차 로드하는 방식)를 확인하고
     동작한 신호를 문서에 기록한다.
   - `new naver.maps.Map(..., { gl: true })` 생성이 예외 없이 끝나고 지도 `init`이 발생했다.
   - `map.getProjection()`이 사용 가능해 `fromCoordToOffset`이 유한한 값을 돌려준다.

   script `error`, 서브모듈 로드 실패, 지도 생성/초기화 예외, 정해진 시간 안에 ready가 되지
   않음(timeout)은 모두 `network-error` 또는 그에 준하는 오류 상태로 오류 UI에 연결한다.
   `navermap_authFailure`는 script 삽입 전에 등록하고, ready 이후에 호출돼도 `auth-error`로
   전환한다. 재시도는 실패한 script/지도 객체를 정리한 뒤 새로 시작한다.

   **이전 시도 무효화.** 각 로드 시도에 증가하는 시도 식별자를 붙이고, loader·adapter에
   disposed 상태를 둔다. `load`·`onJSContentLoaded`·`init`·`error`·timeout·인증 실패 콜백은
   자기 시도 식별자가 현재 시도와 같고 disposed가 아닐 때만 상태를 바꾼다. 재시도·unmount·
   `destroy()` 때 이전 시도의 timeout 타이머, script/SDK 이벤트 핸들러, 지도 listener를 모두
   정리한다. 인증 실패 콜백은 전역 하나이므로 현재 시도에만 연결되게 한다. StrictMode 이중
   mount의 첫 정리도 같은 규칙을 따른다.
   - 시나리오: 첫 시도 timeout → 재시도 성공(ready) → 첫 시도의 늦은 load/init 도착 ⇒ ready 유지,
     지도 객체 하나만 존재.
   - 시나리오: 로딩 중 unmount → 늦은 load 도착 ⇒ 지도 생성·상태 변경 없음.
2. **준비 전 카메라 명령은 최신 절대 목적 하나만 보관한다.** 로딩 중에도 검색·상세·목록
   선택은 즉시 선택 상태를 바꾼다. adapter는 준비 전에 받은 절대 명령(`center`, `fit` — 전체
   보기 버튼 포함)을 실행하지 않고 **마지막 하나**(대상·zoom·padding·제한값)만 보관한다.
   상대 명령(`zoom(delta)` — 줌 버튼·`+/-` 키, `pan(delta)` — 화살표 키)은 준비 전에는
   **무시한다(no-op)**. 상대 명령은 보이는 지도를 기준으로 한 조작인데 준비 전에는 지도가
   보이지 않고 projection도 없어 누적 의미가 불분명하기 때문이다. 준비 전 줌 버튼을 비활성
   표시할지는 builder가 정하되 동작은 no-op이어야 한다. `releaseAnchor`(닫기·해제)는
   보관한 목적을 지운다. ready가 되면 그 시점의 viewport/frame 기준으로 보관한 목적을
   애니메이션 없이 한 번 적용한다. 보관한 목적이 없으면 초기 전체 보기 fit을 적용한다.
   `project`/`unproject`는 준비 전에 호출돼도 예외 없이 동작하고(overlay는 그리지 않음),
   `getSnapshot`은 안정된 값을 돌려준다.
   - 시나리오: 로딩 중 검색 A → 검색 B → ready ⇒ B 위치로 이동한다.
   - 시나리오: 로딩 중 검색 B → 확대 두 번·화살표 키 → ready ⇒ B의 목표 zoom으로 B에 이동한다
     (상대 명령 무시).
   - 시나리오: 로딩 중 검색 A → 상세 닫기 → ready ⇒ A로 이동하지 않고 전체 보기 fit을 적용한다.
   - 로드 실패 후 재시도로 ready가 되면 그때의 최신 목적을 같은 규칙으로 적용한다.
3. **SDK 사용자 조작은 anchor와 진행 중 이동을 해제한다.** 지금은 사용자 pan/zoom이
   `adapter.pan/zoom`을 거치며 `releaseAnchor`가 일어난다. SDK에 입력을 넘기면 이 연결이
   사라지므로 adapter가 직접 지킨다.
   - 사용자 조작 시작(드래그 시작, 핀치 시작, 휠 줌, 더블클릭/더블탭 줌 등 SDK가 처리하는
     사용자 입력)을 감지하면 anchor·fit 기억·진행 중 이동 목적을 모두 해제하고 진행 중
     애니메이션을 멈춘다.
   - adapter 자신의 프로그램 이동(center/fit/zoom/pan, 보관 목적 적용)이 일으키는
     `center_changed`/`zoom_changed`는 사용자 조작으로 취급하지 않는다. 카메라 변경 이벤트만
     보고 사용자 조작을 추정하지 않는다.
   - 회귀 시나리오: 권역 선택 → 사용자가 지도를 드래그 → 모바일 시트 높이 변경 또는 창
     크기 변경 ⇒ 이전 선택 위치로 되돌아가지 않는다.
4. **선택 억제를 위한 입력 관찰 계층을 유지한다.** 지도 이동은 SDK가 하지만, "드래그/핀치/
   취소였던 입력은 라벨·핀 선택으로 이어지지 않는다"는 `canActivate` 계약은 관찰 계층이
   지킨다. 관찰 계층은 지도 region에서 pointer down/move/up/cancel, 다중 터치, 이동 거리
   (기존 6px), window blur·capture 상실을 관찰만 하고 카메라는 바꾸지 않는다. SDK
   `dragstart`/`pinchstart` 등 신호를 보조로 함께 써도 된다.
   - `MapTarget`의 pointer capture와 `touchend.preventDefault()`는 지금 fixture 입력에 맞춘
     동작이다. NAVER provider에서는 라벨·핀 위에서 시작한 드래그·핀치가 SDK 지도 이동으로
     이어지도록 조정하는 것을 목표로 한다. 선택 억제와 WebKit retarget click 억제는 유지한다.
     SDK 구조상 대상 위에서 시작한 지도 이동이 불가능하면 그 사실과 대안을 ADR에 남긴다.
   - 검증 항목: 핀 위에서 시작한 드래그가 끝나도 선택되지 않음, 핀에서 시작한 핀치가 선택을
     일으키지 않음, 짧은 탭은 한 번만 선택됨, pointercancel 뒤 다음 탭 정상.

## 화면 동작

- **지도 영역**: `AppShell`의 map 슬롯 전체를 NAVER 지도가 채운다. 그 위에 overlay 층(선택
  면 SVG, 라벨, 핀, hover 카드, 고지)이 얹힌다. overlay 층의 빈 영역은 지도 입력을 막지
  않는다(`pointer-events: none`, 대상 버튼만 입력 받음).
- **고지 문구**: "NAVER 지도 미연결" 표현을 지운다. 검토용 데이터·실제 시세 미연결 사실은
  계속 보인다. 예: 데스크톱 "검토용 데이터 · 실제 위치·시세 미검증", 모바일 "검토용 데이터".
  최종 문구는 builder가 정하되 이 의미를 유지한다. 현재 zoom 표시도 유지한다.
- **로딩**: SDK 준비 전에는 지도 영역에 로딩 표시를 하고 라벨·핀은 그리지 않는다. 검색·
  상세·월드컵 등 shell은 그대로 쓸 수 있고, 그 사이 카메라 명령은 필수 계약 2를 따른다.
- **오류**: 지도 영역 중앙에 안내와 `다시 시도` 버튼. 라벨·핀은 그리지 않는다.
  - 인증 실패: "지도 인증에 실패했습니다. 등록된 주소에서 접속했는지 확인해 주세요."
  - 네트워크 오류: "지도를 불러오지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요."
  - 설정 누락: "지도 설정이 없습니다."(개발자용 안내. 키 이름은 써도 값은 쓰지 않는다)
  - 안내는 `role="alert"` 또는 동등한 알림으로 읽히고 재시도 버튼은 키보드로 접근 가능하다.
  - 인증 실패의 재시도는 페이지 재로드가 아니면 회복되지 않을 수 있다. 이때 버튼은 페이지
    새로고침으로 동작해도 된다(builder 판단, 문서화).
- **라벨·핀 위치**: 지도 이동·줌 중에도 overlay가 지도에 붙어 따라와야 한다. 프레임마다
  눈에 띄게 늦거나 튀면 실패다. 동기화는 SDK의 `center_changed`/`zoom_changed`/
  `bounds_changed` 등에서 camera revision을 올리는 방식으로 시작하고, 실제 마우스 드래그로
  확인한다. 부족하면 rAF 동기화나 `naver.maps.OverlayView` 기반 pane 렌더를 검토한다.
- **탭과 드래그 구분**: 필수 계약 4를 따른다.
- **frame(패널에 가린 영역)**: 선택한 권역/단지는 상세 패널·시트에 가리지 않은 영역의
  중심으로 이동한다. `fit`은 그 영역 안에 bounds가 padding 48px로 들어오게 한다. SDK
  `padding` 옵션 또는 projection으로 직접 계산하는 방식 중 builder가 고른다. frame이 0이거나
  좁아도 NaN·예외가 없어야 한다(기존 리뷰 초점 유지).
- **resize**: 컨테이너 크기·frame 변경 시 SDK에 크기 변경을 알리고(필요하면
  `autoResize`/`setSize`), 기존 anchor/fit 재적용 규칙(`setViewport`)을 유지한다.
- **수명주기**: `destroy()`는 SDK listener를 모두 제거하고 지도 객체를 정리한다. React
  StrictMode 이중 mount에서 지도가 두 번 생기거나 listener가 남지 않아야 한다.

## 검토용 좌표

- 구 3개(강남·성동·서초), 권역 4개(압구정·청담·성수·반포), 단지 19개의 구성과 ID·이름·
  grade·세대수는 유지한다. 위치만 실제 서울 지도 기준 대략 위치로 바꾼다.
- 라벨 point는 해당 동네의 대략 중심, 구 bounds는 구의 대략 범위, 권역 polygon은 그 동네를
  둘러싸는 손으로 그린 5~8각형, 단지는 해당 권역 안에 흩어 둔다. 실제 단지 위치와 일치할
  필요는 없다.
- `fixtures.ts` 주석은 "실제 지도 기준 대략 위치의 검토용 WGS84 좌표. 경계·지적·NAVER·
  거래·투표 자료 아님"으로 바꾼다.
- `overview`는 세 구를 모두 포함하는 범위다. 전체 보기에서 세 구 라벨이 모두 보여야 한다.
- 실제 지도에서 라벨이 한강 위나 엉뚱한 구에 떠 있지 않은지 눈으로 확인한다.

## 테스트와 검증

- **단위(Vitest)**: 기존 테스트는 새 좌표 타입·데이터에 맞게 고치되 검사 의도는 유지한다.
  가짜 `naver.maps` 객체로 다음을 검사한다.
  - loader: script load 후 GL 미준비면 ready가 아님, 서브모듈 실패·지도 생성 예외·timeout →
    오류, ready 이후 인증 실패 → `auth-error`, 중복 로드 방지, 재시도 시 정리 후 재시작,
    첫 시도 timeout → 재시도 ready → 첫 시도 늦은 콜백 ⇒ ready 유지, unmount 뒤 늦은 콜백 무시.
  - adapter: 준비 전 명령 보관(A→B→ready ⇒ B, A→해제→ready ⇒ 전체 보기, B→zoom/pan→ready ⇒
    B), 사용자 조작 신호 →
    anchor·이동 목적 해제, 프로그램 이동 이벤트는 해제하지 않음, project/unproject 위임,
    center/fit의 frame 반영, frame 0에서 NaN 없음, destroy 시 listener 정리.
  - 입력 관찰 계층: 드래그·다중 터치·cancel 뒤 `canActivate` false, 짧은 탭 true.
  - 오류·재시도 UI는 RTL로 검사한다.
- **브라우저(Playwright)**: provider가 빌드 시점에 고정되므로 실행 구성을 나눈다.
  - **fixture 구성**: `VITE_MAP_PROVIDER=fixture` 빌드·서버로 기존 데스크톱/모바일
    Chromium/WebKit 시나리오를 유지한다. 좌표 변경에 따른 기대값은 고치되 시나리오를 지우지
    않는다.
  - **NAVER 오류 구성**: `VITE_MAP_PROVIDER=naver`와 **가짜 Client ID**(예: `e2e-fake`)로 별도
    빌드·서버를 띄운다. `oapi.map.naver.com` 요청을 route로 차단해 `network-error`와
    재시도 버튼을 검사하고, 필요하면 route가 `navermap_authFailure`를 호출하는 가짜 script를
    돌려줘 `auth-error`를 검사한다. Client ID가 비어 있으면 SDK 요청 전에 `config-error`가 나므로
    네트워크 오류 검사에 빈 ID를 쓰지 않는다. `config-error`는 단위/RTL에서 검사한다.
  - 두 구성은 Playwright project 또는 별도 config로 나누며 `pnpm test:e2e`가 둘 다 실행한다.
    실제 NAVER 서버에는 붙지 않는다.
  - **빌드 출력 분리**: 두 구성은 포트뿐 아니라 빌드 출력도 분리한다. 구성별 `outDir`(예:
    `dist-e2e/fixture`, `dist-e2e/naver-error`)로 빌드하고 `vite preview --outDir`로 각자 제공해
    병렬 실행에서도 서로의 빌드나 운영용 `dist/`를 덮어쓰지 않게 한다. 새 출력 폴더는
    `.gitignore`·lint/format 제외에 추가한다. outDir 분리가 불가능하면 대안으로 구성별 빌드부터
    테스트 종료까지 순차 실행을 강제한다.
- **수동 smoke(실제 SDK)**: `pnpm dev`로 `http://localhost:5173`에서 확인한다. ready 신호
  확인(필수 계약 1) → 세 구 라벨 → 권역 클릭 → 면·상세 → 목록 단지 선택 → 핀 선택 → 드래그·휠
  줌 중 overlay 추종 → 권역 선택 뒤 드래그하고 창 크기 변경 시 되돌아가지 않음(필수 계약 3) →
  핀 위 드래그 시 미선택(필수 계약 4) → 느린 네트워크 throttle에서 로딩 중 검색 선택 후 ready
  이동(필수 계약 2) → 검색 선택 → 이동 효과 줄이기, 데스크톱 1280×720과 Chrome 모바일 에뮬레이션(예: 390×844)에서
  핀치·드래그. 결과와 미실행 항목은 구조 문서와 PR에 정직하게 기록한다. 캡처에 키가 보이지
  않게 한다.
- 실제 SDK 위의 모바일 핀치는 SDK 기본 기능에 맡기며, 데스크톱에서 두 손가락 입력을 신뢰성
  있게 재현하기 어렵다. 에뮬레이션에서 가능한 만큼(예: CDP 합성 touch) 시도하되 증명하지
  못하면 "실제 SDK 핀치 미검증, 실기기 대기"로 기록하고 완료로 본다(사용자의 모바일 범위
  결정에 따름). fixture E2E의 touch 시나리오는 실제 SDK 검증으로 취급하지 않는다.
- 최종 `pnpm check`와 전체 E2E를 실행한다.

## 문서

- `docs/product/specs/map-exploration/`: requirements(실제 지도 바탕, 로딩·오류·재시도,
  검토용 좌표 고지), acceptance-criteria(위 수동 smoke 시나리오), README 상태·버전 갱신.
- `docs/architecture/map-exploration.md`: provider 선택, loader, `NaverMapAdapter`, 좌표
  타입, 제스처 책임, overlay 동기화, 검증 결과.
- `docs/history/`: 새 ADR — GL 지도 채택, React overlay 유지, SDK 제스처 위임, 빌드 시점
  provider 선택과 실사용 grid 대체 금지. 번호는 기존 중복(ADR-005 두 개)을 피해 다음 번호.
- `docs/product/platform-support.md`: 모바일은 에뮬레이션·자동 검증까지, 실기기 대기.
- `.env.example` 주석에 등록 origin 안내(값 없이)와 `VITE_MAP_PROVIDER` 설명.
- 인수인계 문서는 작업 종료 시 상태를 갱신하거나 구조 문서로 흡수한다. INDEX 유지.

## builder에게 맡기는 것

- `@types/navermaps` 사용 여부와 GL 관련 타입 보강 방식.
- SDK 카메라 API 선택(`morph`/`panTo`/`setCenter`+`setZoom`, `fitBounds` margin vs 직접 계산).
- overlay 동기화 방식의 최종 선택(위 실패 기준을 만족하는 한).
- 오류 상태의 시각 디자인(기존 디자인 토큰·공통 컴포넌트 사용).
- loader의 timeout 값과 재시도 횟수 제한 여부(timeout 자체는 필수).
- 지도 region의 `aria-label` 문구(E2E selector와 함께 바꿔도 된다).
- 사용자 조작 감지에 쓸 SDK 이벤트·DOM 이벤트 조합(필수 계약 3의 구분 기준을 만족하는 한).

## 다음 단계로 남기는 것

- Style Editor 스타일 발행·`customStyleId`로 기본 POI·행정동 라벨 숨김.
- 모바일 실기기(내부망 origin 또는 미리보기 배포 origin 등록).
- 제품 API·검증된 geometry·좌표계 대조 후 실제 데이터 source 연결.
