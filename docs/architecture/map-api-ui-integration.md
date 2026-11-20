# 기존 지도 화면의 실제 API 연결

> 상태: 기존 화면·desktop/mobile GL/API 검증 확인, BE 경계·실기기·시작 지연 관찰 별도 · 버전: 0.6 · 갱신: 2026-11-20

## 현재 경로와 지원 범위

`/`와 `/map-exploration`은 실제 지도 조회 API를 사용하는 기존 탐색 화면이다.
별도의 점검 HTML에만 연결된 상태를 넘어, 구·권역 라벨·단지 핀·검색·권역 상세·목록을
기존 AppShell에 연결했다. `/map-exploration/fixtures`와 `/worldcup`은 명시적인 예시 검토 경로다.
실제 화면에서 API 실패를 fixture로 대체하지 않는다. 상태 카드·랭킹·투표함은 후속이다. 실제 월드컵 시작·권역 비교·진행·타임라인은 [월드컵 구조](worldcup.md)에 따라 연결했다.

데스크톱·모바일 웹을 함께 지원한다. 기존 NAVER GL adapter·SDK portal·입력과
모바일 전체 검색·접힌/펼친 상세·목록 focus를 공유한다. 로컬 수동 확인에서 키가 없으면
`.env.local`에 `VITE_MAP_PROVIDER=fixture`를 명시해 지도 바탕만 검토용으로 사용한다.
이때도 화면 데이터는 실제 API이며 고지에서 지도 바탕을 구별한다. NAVER 실패 시 자동 grid fallback은 없다.

관련: [읽기 계층](map-api-read-layer.md), [계약 조사](map-api-integration-review.md),
[BE 요청서](map-api-backend-request.md), [ADR-008](../history/ADR-008-map-api-first-integration.md),
[실행 계획](../superpowers/plans/2026-11-15-map-api-ui-integration.md).

## 파일과 상태 경계

- `live-page.tsx`: cities bootstrap와 overview, adapter 생명주기, TanStack Query의 viewport 조회.
  첫 로드 실패·서비스 지역 없음은 독립 안내/재시도다. 캐시된 cities가 있을 때 배경 갱신 실패는
  지도를 unmount하지 않고 재시도 안내만 추가해 선택·검색·카메라를 유지한다.
- `api/live-source.ts`: BE 읽기 모델→화면 모델, 실제 검색 그룹, 상세 geometry·단지 목록과 위치 결합.
- `MapSurface`: 양수 크기를 실측하고 SDK ready 이후 화면 네 모서리를 unproject한다.
  카메라·크기 변경 후 200ms debounce로 범위를 알린다. projection 렌더는 이 지연 없이 갱신한다.
- zones는 zoom ≥12.5, complexes는 ≥14.5에서 조회한다. query key는 리소스·bounds를 구별한다.
  Query signal로 취소하고 이전 범위 응답이 늦어도 새 범위 결과를 덮지 않는다.
  이전 범위 배열을 새 범위의 결과로 복사하지 않는다. 선택 geometry·핀은 독립 보존한다.
- viewport loading/빈 권역/오류·재시도를 SDK 로딩/오류와 구별한다. HTTP 4xx는 자동 재시도하지 않고
  다른 조회 실패는 300ms 뒤 최대 한 번 재시도한다. polling은 없고 Query 기본 재진입/창 복귀 재검증을 사용한다.
- `ExplorationPage`: 기존 zoneId/apartmentId 선택 계약 유지. 이미 확인한 선택 단지 객체와
  좌표를 viewport에서 독립 보관한다. 상세 최신 이름·가격·rank가 우선하지만 위치가 없다는 이유로
  이미 알고 있는 실제 선택 위치를 덮어쓰지 않는다. 위치 없이 선택한 뒤 viewport/상세에서
  좌표를 확보해도 현재 선택 상태에 보관한다. 같은 좌표에는 상태를 다시 갱신하지 않으며,
  닫기·구/권역 변경 때 이전 선택 참조를 정리한다.
- `ApartmentList` 자동 스크롤은 선택 ID 변경·선택 행의 뒤늦은 표시·패널 크기 변경 때만
  실행한다. 카메라 이동이나 조회 갱신으로 배열 참조가 달라져도 수동 스크롤 위치를 유지한다.
  모바일에서 시트를 펼쳐 목록 크기가 바뀌면 ResizeObserver가 선택 행을 다시 가운데 맞춘다.

## 현 BE 계약으로 가능한 표시

기본 라벨·상세 급지 표시는 초기 급지다. initial/vote·각 rank/total과 rankingBasis는
`Zone.rating`에 원형으로 보존한다. 민심 전환 스위치와 새로운 단계 계산은 추가하지 않는다.
급지 null은 정보 없음과 중립색이며 1급지 색상이나 다른 기준 값을 재사용하지 않는다.
시·구·광역 지역명과 전체 보기 범위는 실제 cities 응답에서 가져온다.

단지 배열은 BE 순서를 보존하고 zoneRank가 null이면 `—`로 표시한다. 상위 강조도 실제
rank로 결정한다. 단지 순위 기준은 INITIAL일 때 ㎡당 대표 가격, VOTE일 때 투표 점수다.
지도 초기 급지 표시와 단지 순위 기준은 구분한다. 금액은 대표 거래가(만원→억), 면적은 ㎡다.
표시되지 않는 투표 점수·후보 상태 등 원본 필드는 읽기 계층의 검증 계약에 남아 있다.

요약에는 경계·bbox·면적을 지어내지 않는다. geometry는 상세에서만 받아 SVG path의
모든 polygon/ring을 `fill-rule=evenodd`로 그린다. 섬·hole을 버리지 않는다.
실제 위치 정확성·한강 제외·GIS 위상 검증을 SVG 렌더 성공으로 주장하지 않는다.

## 배포 계약 보완 반영 (2026-11-20)

권역 `areaSquareMeters`를 `Zone.area`에 ㎡ 그대로 전달한다. 라벨 충돌은 선택 우선,
넓은 면적 우선이며 같은 면적에서는 기존의 안정적인 입력 순서를 유지한다.
검토 경로의 상대 면적 가중치는 실측 ㎡가 아니며 실제 데이터와 섞지 않는다.

상세 단지 `location`을 직접 사용한다. 상세 bbox로 핀을 추가 조회하는 보완과
`locationLookupFailed` 상태·위치 재시도 UI를 제거했다. null 좌표 단지도 서버 순서와
전체 목록·선택을 유지한다. 가짜 핀을 만들지 않고 이동과 모바일 시트 접힘을 생략한다.
이미 확보한 선택 좌표는 유지한다. viewport 핀 조회는 줌 ≥14.5의 지도 표시용으로만 남긴다.

선택 권역 객체를 viewport와 독립 보관한다. 상세 지연·실패 중에도 알려진 이름·급지·라벨이
유지된다. 상세 최신 값, 현재 viewport 값, 검색 참조, 선택 snapshot 순으로 사용하고,
닫기·구 전환·다른 권역 선택 시 이전 선택을 정리한다. 단지 검색처럼 권역 객체가 없는 경우는
상세 로딩/오류 안내를 사용한다.

실제 화면의 권역 비교 버튼은 활성화됐으며 월드컵 API 범위는 [월드컵 구조](worldcup.md)를 따른다. 한강 수면 제외는 BE 후속 과제이며
FE에서 geometry를 임의 절단하거나 보정하지 않는다.

## 검색

SearchTarget의 단지는 전체 Zone 없이도 zoneId·위치로 선택할 수 있다. 상세가 로드될 때까지
권역 정보 로딩/오류·재시도를 표시하며 검색 결과에 가짜 권역 중심·면을 추가하지 않는다.
검색은 viewport 배열을 재검색하지 않고 서버의 권역/구·시/단지 그룹을 사용한다.
표시 그룹은 5/3/6 한도와 권역→구→단지 순서, 내부는 서버 순서를 보존한다.
이름에 직접 일치하면 이름을 먼저 강조한다. 직접 일치가 없으면 구+권역 복합 입력을 두 텍스트에 걸쳐 강조한다.

live source만 200ms debounce와 입력 최대 80자를 적용한다. 한글 조합 중에도 조회하며
조합 확정 Enter·방향키·Escape·지우기·입력 revision·focus·모바일 전체 검색 계약은 유지한다.
요청 실패는 결과 없음과 구분하고 재시도를 제공한다.

## 개발 환경과 직접 확인

브라우저는 같은 출처 `/api`를 사용한다. `MAP_API_PROXY_TARGET`은 Vite 개발 서버 전용
환경 변수이며 기본값은 로컬 BE다. 실제 개발 대상은 `.env.local`에만 설정하고 커밋하지 않는다.
브라우저에 노출되는 `VITE_` 접두사를 사용하지 않는다. Vite proxy는 운영 reverse proxy를 대신하지 않는다.

1. `pnpm dev` 후 `/` 또는 `/map-exploration`을 연다.
2. 압구정 검색→권역 선택→대표 거래가·실제 단지 목록·초기 순위를 확인한다.
3. 목록 단지 선택→zoom ≥15 이동과 선택 핀을 확인한다. 모바일은 상세 펼침 후 목록을 선택한다.
4. 지도 이동/축소 후 선택 핀이 남는지, 빈 검색과 실패/재시도가 구분되는지 확인한다.
5. `/map-exploration/fixtures`는 예시 검토 경로이며 실제 API 확인에 사용하지 않는다.

## 검증

| 검사 | 실제 결과·한계 |
| --- | --- |
| baseline `pnpm test` | 211개 통과 |
| live source/UI/route TDD | 미구현 실패 확인 후 통과. source 4개, live UI 3개, route 5개로 기존 211개에 12개 추가 |
| 최종 `pnpm check` | 26파일·225개 테스트, 토큰·타입·lint·format·production build 통과 |
| 전체 `pnpm test:e2e --workers=3` | 128개 통과·34개 플랫폼 적용 제외·실패 0. desktop Chromium, mobile Chromium/WebKit 및 NAVER 오류 구성 |
| 실제 개발 API + 기존 화면 | desktop Chromium, Pixel 7 Chromium, iPhone 13 WebKit에서 구 표시→압구정 검색→상세 9개 단지→목록 선택→zoom≥15·선택 핀, 빈 검색 확인. 콘솔 오류·가로 넘침 없음 |
| 2026-11-16 P2 회귀 검증 | 위치 없는 행 선택→viewport 좌표 수신→범위 제거 뒤 선택 핀·목록 위치 정보 유지, 닫기 후 선택 해제 확인. 배열 갱신 시 수동 스크롤 유지와 선택 변경·행 도착·ResizeObserver 재정렬을 단위 테스트로 확인 |
| 독립 읽기 전용 리뷰 | Important 3건을 재현→수정: 배경 cities 오류에서 지도 유지, viewport 핀 제거 뒤 선택 위치 유지, 급지 null 카드의 1급지 gradient 제거. 각 회귀 실패→성공 확인 |
| 실제 NAVER GL + API | 사용자 키 설정 및 콘솔 확인 뒤 `/v3/auth` 200, 실제 GPU 기반 headless Chromium에서 GL canvas 1개 확인. 강남구 클릭 zoom12.55, 압구정 실제 상세→단지 선택 zoom≥15·선택 핀, 마우스 드래그의 중심 변경 확인. 후속 모바일 GL 검증은 [경계·모바일 검증 기록](map-boundary-mobile-validation.md)을 따름 |
| 물리 기기 | 미검증. 모바일 에뮬레이션·브라우저 엔진 결과를 실기기 soft keyboard/VoiceOver/실제 제스처 검증으로 대체하지 않음 |

새 E2E는 mock API를 사용해 실제 route의 검색·상세·목록 선택·80자 입력 제한·빈 검색·
초기 실패 재시도·급지 없는 카드의 실제 gradient를 확인한다. 기존 예시 E2E는 명시적 예시
경로로 이동했으며 테스트 시나리오를 삭제하거나 재시도/timeout을 늘려 통과시키지 않았다.
실제 API 수동 smoke에서는 숨은 모바일 목록을 role로 기다리기 전에 시트를 펼쳐야 하는
검사 순서를 바로잡았다. 제품 목록 접근 실패로 판단하지 않는다.
2026-11-16 P2 브라우저 회귀 검사는 합성 API 응답과 fixture 지도 바탕으로 실행했다.
데스크톱은 확대 버튼, 모바일 Chromium/WebKit은 지도 키보드 `+` 입력 후 조회 갱신과
목록 scrollTop 유지를 확인한다. 이 검사는 모션 감소 설정으로 카메라 애니메이션과 겹치는
입력을 배제하며, 실제 SDK 제스처 검증은 위 별도 기록을 따른다.
서버 GET·mock·실제 SDK·실기기는 서로 구분하며 데이터 개수는 조회 시점 값이다.
로컬 데이터나 환경 주소를 테스트 fixture에 복사하지 않는다.

### 실제 지도 확인에서 남은 경계 검토

압구정의 실제 API 좌표 200개와 SVG 점 200개를 독립 NAVER GL projection으로 대조해
최대 차이 0 CSS px를 확인했다. 한강 표본도 API·SVG 모두에 포함됐고 BE 경계 생성에
수면 차감이 없었다. FE 그림 오류가 아니라 표시 geometry 보완이 필요한 것으로 확인했다.
수용 기준의 한강 제외는 미충족이며, FE에서 임의로 잘라내지 않는다.

실제 모바일 GL 검증에서도 주요 흐름은 통과했다. Chrome은 trusted touch 드래그·핀치·
두 번 탭·목록 스크롤, WebKit은 탭·시트·키보드 목록 스크롤을 확인했다.
추가 실행 중 초기 API 대기/SDK 시간 초과가 한 차례 관찰돼 원인 미확정·재발 관찰로 기록했다.
재확인은 두 엔진 모두 통과했으며 timeout/재시도 설정을 늘리지 않았다.
물리 기기와 WebKit 물리 스와이프·핀치를 확인한 것으로 주장하지 않는다.

근거와 한계: [경계·모바일 검증](map-boundary-mobile-validation.md),
[BE 한강 수면 제외 추가 요청 초안](map-boundary-backend-followup.md).

## 변경 이력

| 버전 | 날짜 | 변경 |
| --- | --- | --- |
| 0.6 | 2026-11-20 | 실제 월드컵 진입·권역 비교 활성화와 현재 기술 문서 연결 |
| 0.4 | 2026-11-16 | 선택 후 확보한 좌표 보존, 지도 갱신 중 수동 목록 스크롤 유지와 회귀 테스트 추가 |
| 0.3 | 2026-11-15 | API/SVG 경계 일치·BE 수면 차감 누락과 실제 모바일 GL 검증 기록 연결 |
| 0.2 | 2026-11-15 | 인증 200과 desktop 실제 NAVER GL/API 결합 확인, 압구정 한강 포함 경계 관찰 기록 |
| 0.1 | 2026-11-15 | 기존 화면 실제 API 연결·viewport Query·geometry·임시 위치/라벨 정책 기록 |
