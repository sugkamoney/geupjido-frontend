# 지도 API 읽기 계층 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** BE 전달용 계약 보완 요청서를 작성하고, 기존 지도·검색·상세 API의 검증된 읽기 계층을 준비한다.

**Architecture:** 기존 UI와 fixture 주입 경계는 유지하고 독립 API 모듈을 추가한다.
응답은 unknown에서 검증된 읽기 모델로 변환하며 null과 GeoJSON ring을 보존한다.
단지 좌표·면적 보완과 제품 정책 결정 뒤 실제 화면에 연결한다.

**Tech Stack:** 기존 TypeScript, fetch, Vitest. 신규 의존성 없음.

**Spec:** `docs/architecture/map-api-integration-review.md`, `docs/architecture/map-api-backend-request.md`

## Global Constraints

- 사용자 지시에 따라 이 workspace에서 가능한 작업을 진행한다. 상위 checkout·BE 수정, push·PR·merge 없음.
- 첫 범위는 지도·검색·권역 상세. status·월드컵은 후속이다.
- 단지 좌표·권역 면적을 가짜 값으로 채우지 않는다. UI 정책은 아직 변경하지 않는다.
- 모델은 생성 OpenAPI 타입이 아닌 런타임 검증 결과다. 신규 도구 설치나 계약 추측을 하지 않는다.
- 데스크톱·모바일 웹이 공유할 읽기 계층이며 브라우저 배치는 변경하지 않는다.
- 이번 사용자 요청은 가능한 선행 작업 실행을 포함한다. 계획 후 이 세션에서 직접 실행하고 별도 승인 요청을 반복하지 않는다.
- 최초 구현은 미커밋 변경으로 검토했고, 후속 사용자 요청에 따라 모델·검증, HTTP 클라이언트, 문서를 나눠 로컬 커밋으로 남긴다.

## Review Focus

- null 가격·급지·순위를 0으로 바꾸거나 빠뜨리는 오류: Task 1 검증.
- MultiPolygon의 섬·hole 소실, 경도/위도 뒤집힘: Task 1 검증.
- 실패 응답을 빈 배열로 처리하거나 HTML을 API 오류 메시지로 노출: Task 2 검증.
- AbortSignal 누락 또는 취소를 일반 성공으로 바꿈: Task 2 검증.
- 범위/검색어 입력이 잘못됐을 때 불필요한 요청, ID 경로 인코딩 오류: Task 2 검증.

## Task 1: 읽기 모델과 응답 검증

**Files:** `src/features/map-exploration/api/contracts.ts`, `validation.ts`, `validation.test.ts`

**Interfaces:** unknown 응답을 `parseCities`, `parseZones`, `parseComplexPins`, `parseZoneDetail`,
`parseSearch`로 검증한다. `geometryBounds(geometry): MapBounds`는 모든 면의 외곽을 포함한다.
`MapContractError`로 잘못된 데이터와 HTTP 오류를 구별한다. 상세 단지는 현재 BE 계약만 포함한다.

- [x] DTO 전체 필드가 있는 테스트 fixture를 작성한다. null 보존, VOTE·INITIAL, 순위 없는 단지,
  두 polygon과 hole, 잘못된 ring·좌표·필수 필드·enum을 검사한다.
- [x] `pnpm test src/features/map-exploration/api/validation.test.ts`에서 미구현 실패를 확인한다.
- [x] 검증과 읽기 타입을 구현한다. 숫자·카운트·위경도·ring 닫힘을 검사하고 필드 오류 경로를 제공한다.
- [x] 위 테스트와 `pnpm test`를 실행해 통과를 확인한다.

## Task 2: 5종 GET 클라이언트

**Files:** `src/features/map-exploration/api/client.ts`, `client.test.ts`

**Interfaces:** `createMapApi()`가 `cities(signal)`, `zones(bounds,signal)`,
`complexes(bounds,signal)`, `zone(id,signal)`, `search(query,signal)`를 제공한다.
상대 경로 `/api/v1/map` GET만 사용하고 모든 성공 응답은 Task 1 parser를 거친다.
`MapApiError`에 HTTP status와 선택적 서버 code를 제공한다. 자동 재시도·캐시·UI 변경 없음.

- [x] 실제 fetch 경계만 대체해 경로·쿼리·signal, 응답 검증, 400/404/5xx,
  비JSON 오류, 잘못된 성공 JSON, 네트워크 실패·취소, 유효하지 않은 입력 테스트를 작성한다.
- [x] `pnpm test src/features/map-exploration/api/client.test.ts`에서 미구현 실패를 확인한다.
- [x] GET 클라이언트를 구현한다. 원문 오류 body를 출력하지 않고 abort는 그대로 전파한다.
- [x] 위 테스트와 전체 `pnpm check`를 실행한다. 문서는 관련 파일만 format한다.
- [x] 실제 API 검증과 mock 테스트를 구분해 architecture와 계획에 결과를 기록하고 diff를 리뷰한다.

## 진행 기록

- 범위 결정: 완전한 UI 연동에 앞서 기존 계약으로 확정 가능한 읽기 경계만 구현한다.
  라벨 우선순위·위치 없는 행·검색 정렬 등의 제품 결정을 대신하지 않는다.
- 완료: frozen 설치와 baseline 185개, validation 16개 RED→GREEN 및 전체 201개, client 10개 RED→GREEN.
- 최종 `pnpm check`: 22파일·211개 테스트·production build 통과. manifest·lockfile 변경 없음.
- 실제 GET smoke: 새 읽기 계층으로 cities/zones/complexes/search 및 상세 3권역 검증.
- 별도 읽기 전용 리뷰: Critical/Important 없음. 문서 진행 상태를 결과에 맞게 갱신했다.
- 화면 연결·브라우저/E2E는 미실행이며 다음 단계다. [구현·검증 기록](../../architecture/map-api-read-layer.md)을 따른다.
