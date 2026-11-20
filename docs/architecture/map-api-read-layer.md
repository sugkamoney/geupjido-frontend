# 지도 API 읽기 계층

> 상태: 공통 계층 구현·검증 완료, 기존 화면 연결 완료 · 버전: 0.3 · 갱신: 2026-11-15

## 현재 구현 범위

사용자의 ‘BE에 전달할 내용을 정리하고 지금 가능한 작업을 진행’ 요청에 따라
지도·검색·상세의 독립 읽기 계층을 추가했다. [계약 조사](map-api-integration-review.md)의
미결 제품 정책을 확정하지 않고, [BE 보완 요청서](map-api-backend-request.md)는 미발송 초안으로 남긴다.

최초 읽기 계층 구현 뒤 사용자 요청으로 기존 화면에도 연결했다. 현재 `/`와
`/map-exploration`은 실제 API를 사용한다. 신규 의존성·package.json·lockfile 변경은 없다.
화면·선택·viewport·임시 동작은 [기존 화면 연결 구조](map-api-ui-integration.md)를 따른다.

## 파일 경계와 사용 계약

| 파일 | 역할 |
| --- | --- |
| `src/features/map-exploration/api/contracts.ts` | 현재 BE 응답을 검증한 뒤 사용하는 읽기 타입. 생성 OpenAPI 타입으로 간주하지 않음 |
| `src/features/map-exploration/api/validation.ts` | unknown → 읽기 모델, null·숫자·필수 필드·날짜·좌표·ring 검증과 경계 bbox 계산 |
| `src/features/map-exploration/api/client.ts` | 같은 출처 5종 GET, 입력 검증·HTTP 오류·취소 전파 |
| 같은 폴더의 `*.test.ts`, `test-data.ts` | 검증/HTTP 경계 테스트와 완전한 합성 응답. 실제 서버 데이터를 테스트 fixture로 저장하지 않음 |

`createMapApi()`는 다음 메서드를 제공한다. 모든 호출은 AbortSignal을 요구한다.

```ts
api.cities(signal);
api.zones({ west, south, east, north }, signal);
api.complexes({ west, south, east, north }, signal);
api.zone(zoneId, signal);
api.search(query, signal);
```

경로는 `/api/v1/map` 아래이며 GET만 전송한다. 클라이언트는 캐시·재시도·debounce·선택 상태를
소유하지 않는다. 다음 화면 연결 단계에서 TanStack Query와 기존 선택 상태가 이를 담당한다.
검색 응답의 서버 순서와 상세 단지 순위·배열 순서를 보존하며 FE 정렬 정책을 여기서 적용하지 않는다.

## 응답 검증과 오류

- initial/vote 급지·rank·total·rankingBasis를 분리해 보존한다. null과 0은 다르다.
  만원 가격·㎡ 면적·날짜도 변환 없이 보존하고 표현은 UI에 맡긴다.
- counts는 안전한 비음수 정수, 순위는 양수 또는 null로 검증한다. 좌표는 유한한
  WGS84 경도·위도이고 bounds는 BE와 같은 일반 사각형 조건을 검사한다.
- GeoJSON은 현재 BE의 2차원 Polygon/MultiPolygon을 받는다. 모든 면·외곽·내부 ring과
  좌표 순서 `[longitude, latitude]`를 보존한다. ring은 최소 4개 위치와 시작/끝 일치를 확인한다.
  GIS 위상 유효성·면끼리의 교차·hole 포함 관계·실제 좌표 정확성을 이 검사로 보장하지 않는다.
- `geometryBounds`는 각 polygon 외곽의 합집합을 계산한다. 이것을 실제 면적이나
  개별 단지 위치로 사용하지 않는다.
- `MapContractError`는 잘못된 입력/응답과 필드 경로를 알려준다. 응답 원문 값은 오류에 포함하지 않는다.
  `MapApiError`는 HTTP status와 선택적 서버 code를 제공한다. 내부 오류 문구나 proxy HTML을
  사용자 문구로 재사용하지 않으며 화면 계층에서 공개 안내를 선택해야 한다.
- fetch의 네트워크 실패는 원래 오류로 전파한다. 요청 전·응답 수신 후·body 해석 후 abort를
  확인해 취소를 무시한 transport의 늦은 결과도 반환하지 않는다. 요청 세대 간 상태 덮어쓰기 방지는
  후속 hook/consumer 책임이며 이 stateless 클라이언트만으로 A→B→A UI 경합을 해결했다고 보지 않는다.
- BE 개선 필드를 추측해 요구하거나 응답에 없는 면적·단지 좌표를 만들어 넣지 않는다.
  현재 타입과 validator는 현 계약만 표현한다. BE 보완 뒤 생성 명세·검증 경계를 함께 갱신한다.

## 검증 기록

| 검사 | 기대 | 실제 |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 기존 잠금 버전 설치 | 성공, manifest·lockfile 변경 없음 |
| baseline `pnpm test` | 기존 회귀 통과 | 20파일·185개 통과 |
| validation TDD | 미구현 실패 후 null·geometry·잘못된 값 검증 | 16개 실패 확인 → 16개 통과, 이어 전체 201개 통과 |
| client TDD | 미구현 실패 후 GET·오류·취소·입력 검사 | 10개 실패 확인 → 10개 통과 |
| `pnpm check` | 토큰·타입·lint·format·전체 단위·빌드 통과 | 22파일·211개 통과, production build 성공 |
| 실제 API 읽기 smoke | 새 클라이언트/validator가 실제 응답 처리 | cities 62·zones 282·pins 5,610, 압구정 검색 0/1/6 결과, 3권역 상세 17/115/9개 단지 처리 성공 |
| 별도 읽기 전용 리뷰 | 현재 BE 계약과 코드·테스트 대조 | Critical/Important 없음. 문서 상태 표시는 최종 결과에 맞게 갱신 |
| 브라우저/E2E·실기기 | 실제 화면 결합 검증 | 미실행: 화면·라우트·스타일 변경 없이 독립 읽기 계층만 추가. 후속 연결 때 데스크톱/모바일 검증 필요 |

실제 API smoke는 새 TS 모듈을 임시 폴더에 JS로 변환한 뒤 같은 코드를 실행했다.
테스트 실행용 URL 변환만 임시 fetch 경계에 적용했으며 BE 주소를 제품 코드에 넣지 않았다.
실제 화면의 Vite proxy·CORS·SDK·브라우저 동작을 검증한 것으로 간주하지 않는다.
위 개수는 조회 시점 값이며 제품 상수·자동 테스트 기대값으로 사용하지 않는다.

## 직접 테스트하는 순서

### 1. 이 workspace에서 준비

```sh
cd /Users/user/orca/workspaces/geupjido-frontend/feature-integrate-map-api
pnpm install --frozen-lockfile
```

프로젝트 기준은 Node `^24.15.0 || >=26.0.0`, pnpm `11.13.0`이다.
아래 자동 테스트는 BE 서버와 지도 Client ID 없이 실행할 수 있다.

### 2. 새 기능 테스트 실행

```sh
pnpm test src/features/map-exploration/api
```

기대 결과는 읽기 계층과 실제 source를 포함해 3개 파일·30개 테스트 통과다. null 보존, 여러 면과 내부 빈 영역,
입력·응답 검증, 요청 경로, 400/404/서버 오류, 네트워크 실패·취소를 검사한다.
HTTP 응답은 테스트에서 대체하므로 실제 서버 접속 결과는 아니다.

### 3. 전체 품질 검사

```sh
pnpm check
```

현재 UI 연결까지 포함한 기대 결과는 테스트 25개 파일·223개 통과와 빌드 성공이다.
토큰·TypeScript·lint·format 검사도 포함한다. 브라우저 E2E를 실행할 경우
같은 빌드 결과를 바꾸지 않도록 이 명령이 끝난 뒤 실행한다.

### 4. 실제 API 응답 확인(선택)

Vite `/api` 프록시 대상 BE가 실행 중일 때만
아래를 진행한다. 기본 대상은 `http://localhost:8080`이며 `.env.local`의 `MAP_API_PROXY_TARGET`으로 개발 API를 선택할 수 있다. BE가 없으면 위 자동 테스트까지만 확인할 수 있다.
별도 개발 서버 주소를 사용할 경우 프록시 대상 설정이 필요하며 이번 커밋은 이를 변경하지 않는다.

```sh
pnpm dev
```

터미널에 출력된 주소(기본 `http://localhost:5173`)를 브라우저로 열고 개발자 도구의
Console에서 다음을 실행한다. 지도 인증 여부와 별개로 읽기 모듈을 직접 불러온다.

```js
const { createMapApi } = await import('/src/features/map-exploration/api/client.ts');
const api = createMapApi();
const controller = new AbortController();
const signal = controller.signal;
const bounds = { west: 124, south: 33, east: 132, north: 39 };

const cities = await api.cities(signal);
const zones = await api.zones(bounds, signal);
const pins = await api.complexes(bounds, signal);
const search = await api.search('압구정', signal);
const detail = zones.length ? await api.zone(zones[0].id, signal) : null;

console.table({
  cities: cities.length,
  zones: zones.length,
  pins: pins.length,
  searchZones: search.zones.length,
  detailComplexes: detail?.complexes.length ?? 0,
});
console.log({ search, detail });
```

Network 탭에서 `/api/v1/map/…` GET이 200인지 확인한다. 개수는 로컬 BE 데이터에 따라
다르므로 이전 배포 검증의 62/282/5,610과 일치할 필요는 없다. 상세 polygon은 여러 면과
ring 배열을 유지하고 가격·급지·순위가 없으면 null이 남아 있어야 한다.

없는 권역 오류는 다음으로 확인한다. BE 연결이 정상이라면
`MapApiError`, `404`, `ZONE_NOT_FOUND`를 출력한다.

```js
try {
  await api.zone('__missing_zone__', signal);
} catch (error) {
  console.log(error.name, error.status, error.code);
}
```

502/연결 거부라면 BE 실행과 프록시 대상을 먼저 확인한다. `MapContractError`는
입력 또는 응답이 기대 계약과 다르다는 뜻이므로 표시된 필드 경로를 확인한다.
이 콘솔 절차는 개발 서버 전용이며 `pnpm preview`에서는 소스 모듈을 import할 수 없다.

### 5. 화면에서 확인되는 범위

기본 앱의 지도·검색·상세는 실제 API를 사용하며 검색·지도 이동·상세 선택에 따라 GET이 발생한다.
예시 화면은 `/map-exploration/fixtures`다. 기존 NAVER 지도 키와 등록 origin은 별도로 필요하며
명시적 fixture 지도 모드에서는 바탕만 grid이고 데이터는 실제 API다.

## 다음 연결 단계

viewport Query·검색/상세 source 연결과 임시 동작은 후속 사용자 요청으로 구현했다.
BE location/면적 보완 응답 후 추가 위치 조회·라벨 우선순위를 재검토한다.
데스크톱·모바일 웹은 같은 읽기 계층을 사용한다. 기존 모바일 시트·IME·focus·제스처 보존과
실기기 한계는 후속 UI 검증 범위이며 이번 단위 테스트로 대체하지 않는다.

## 변경 이력

| 버전 | 날짜 | 변경 |
| --- | --- | --- |
| 0.3 | 2026-11-15 | 기존 화면 실제 API 연결과 후속 구조 문서 반영 |
| 0.2 | 2026-11-15 | 사용자가 재현할 자동 테스트·선택적 로컬 BE 콘솔 검증·화면 미연결 범위 안내 |
| 0.1 | 2026-11-15 | 5종 GET·현 계약 응답 검증·geometry bounds와 mock/실제 API 검증 결과 기록 |
