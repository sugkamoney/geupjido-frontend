# ADR-007: NAVER GL 지도 위에 React overlay를 얹고 제스처는 SDK에 맡긴다

> 상태: 확정 · 날짜: 2026-10-27 · 영역: 프론트엔드·제품

## 맥락

지도 화면은 가상 grid와 가상 좌표로 검증했다. 이번 작업의 목표는 실제 NAVER 서울 지도 위에 기존 구/권역 라벨, 단지 핀, 선택 면이 뜨고 드래그·줌이 자연스럽게 동작하는 것이다. 백엔드 제품 API와 검증된 geometry는 아직 없어 데이터는 검토용으로 유지한다. 실수 줌 규칙(12.5/14.5, 면 투명도 보간)을 지켜야 하고 데스크톱·모바일 웹을 모두 지원한다. 실제 키는 `.env.local`에만 둔다.

## 선택지

1. raster 지도와 정수 zoom: 설정이 단순하나 실수 줌 규칙을 유지할 수 없다.
2. GL 지도와 SDK 마커(`naver.maps.Marker`)로 라벨·핀 표시: 위치 동기화는 SDK가 맡지만 라벨 충돌 배치·hover 카드·선택 스타일 등 기존 디자인을 커스터마이징하기 어렵다.
3. GL 지도와 React overlay, 제스처는 SDK에 위임하고 선택 억제용 입력 관찰만 유지: 기존 화면·테스트를 살리고 실수 zoom을 얻는다. overlay를 SDK 입력 요소 안에 넣는 DOM 의존이 생긴다.
4. 지도 이동까지 기존 `use-map-input`이 처리: 두 구현이 지도를 동시에 움직여 관성·핀치가 어긋난다.
5. provider를 런타임에 고르거나 실패 시 grid로 대체: 실사용에서 가상 지도를 실제처럼 보이게 할 위험이 있다.

## 결정

3을 선택한다.

- 첫 연결부터 GL 지도(`gl: true`)를 쓴다. loader는 `maps.js` load 뒤 `maps-gl.js`를 순차 삽입하고 `naver.maps` 존재와 지도 생성·projection 유한 값까지 확인해서 ready로 본다. `callback=`은 쓰지 않는다. 인증 실패는 전역 `navermap_authFailure`로 받는다.
- 라벨·핀·선택 면·hover 카드는 React overlay로 직접 그리고 SDK projection으로 위치를 계산한다. overlay host는 SDK 내부 `.mapboxgl-canvas-container`(raster 대체 때는 그에 준하는 입력 요소) 안에 portal로 둔다. 형제 배치는 SDK가 라벨 위 드래그·휠·터치를 받지 못해 폐기했다. 라벨·핀 버튼만 포인터를 받는다.
- 드래그·관성·휠·핀치·두 번 탭 확대는 SDK가 한다. 지도 region은 pointer 이동 거리(6px), 다중 포인터, cancel, blur를 관찰만 해 드래그·핀치 뒤 선택을 막는다. 사용자 조작 신호는 anchor와 진행 중 이동 목적을 해제한다. 키보드 화살표·`+/-`는 기존처럼 지도 region에서 처리한다.
- provider는 빌드 시점 env(`VITE_MAP_PROVIDER`, 기본 NAVER, `fixture`)로 고른다. 화면은 `adapter.kind`로 입력 모드·고지·배경을 정한다. 실사용 경로에서 실패 시 grid로 대체하지 않고 원인별 안내와 `다시 시도`를 보인다. `FixtureMapAdapter`는 테스트·검토 구성에만 쓴다.
- 지도 좌표는 WGS84 `LatLng`로 분리하고 검토용 좌표를 하나의 데이터로 쓴다. 실제 줌 기준·수치는 조정하지 않고 검토용 면을 실제보다 크게 그려 보정하지 않는다.
- 기본 POI·행정동 라벨 숨김은 이번 범위에서 제외한다.

## 이유와 trade-off

- 실수 zoom 12.5/14.5 규칙과 투명도 보간을 유지하면서 기존 선택·검색·월드컵 흐름과 테스트를 재사용한다.
- overlay를 SDK 내부 DOM에 넣는 방식은 공개 API가 아니므로 SDK 갱신 때 깨질 수 있다. 실제 입력 smoke로 형제 배치가 제스처를 전달하지 못함을 확인했고 portal 구조에서는 마우스 드래그·휠이 지도로 전달됐다(실제 GPU smoke 포함). 터치 드래그·핀치는 Task 4의 headless Chromium(SwiftShader, raster 대체)·CDP 합성 touch probe 결과이며 실제 GPU나 실기기에서는 검증하지 않았다. SDK 갱신 때 이 smoke를 다시 한다.
- SwiftShader 같은 GPU 없는 환경에서는 SDK가 raster·정수 zoom으로 대체해 실수 zoom 검증이 안 된다. raster에서 `fromCoordToOffset`의 기준점이 달라 현재 center offset을 빼는 보정을 adapter에 두었다.
- 빌드 시점 provider 선택은 한 번들에 두 지도를 섞지 않아 안전하지만 E2E를 fixture 구성과 NAVER 오류 구성(가짜 ID, 요청 차단)으로 나눠 각자 `dist-e2e/*`에 빌드해야 한다. 실제 NAVER 서버에는 자동 테스트가 붙지 않는다.
- 선택 핀 이름 라벨은 클릭을 받지 않고, hover 카드가 고지·NAVER 로고에 가려질 수 있으며, DOM 읽기 순서가 바뀌었다. 디자인·접근성 리뷰 항목이다.

## 재검토 조건

- NAVER 기본 아파트 POI·행정동 라벨 숨김(Style Editor 스타일 발행, `customStyleId`)을 시작할 때.
- 모바일 실기기에서 터치 드래그·핀치·두 번 탭 확대와 키보드·주소창이 기대와 다를 때.
- SDK 갱신으로 `.mapboxgl-canvas-container`가 바뀌거나 공식 overlay API(`OverlayView` 등)가 필요해질 때.
- 실제 제품 API·검증된 geometry를 연결해 좌표 정확성과 성능(대규모 overlay)을 확인할 때.
- 실제 화면 밀도(권역이 작게 보임)를 디자인 리뷰에서 조정할 때.

현재 제품 동작은 [지도 탐색 요구사항](../product/specs/map-exploration/requirements.md), 구조와 검증은 [지도 탐색 구조](../architecture/map-exploration.md), 조사 기록은 [NAVER 지도 SDK 인수인계](../architecture/naver-map-sdk-handoff.md)를 따른다.
