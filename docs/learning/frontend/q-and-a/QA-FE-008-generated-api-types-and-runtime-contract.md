# QA-FE-008: OpenAPI로 타입을 생성하면 실제 API 응답도 안전한가?

> 상태: 조사 기록 · 버전: 0.2 · 갱신: 2026-11-20

## 질문

지도 API의 OpenAPI에서 타입을 생성하면 FE fixture 타입을 그대로 대체해도 되는가?

## 답변

생성 타입은 명세를 TypeScript로 옮긴 것이며 네트워크 응답을 실행 중에 검증하지 않는다.
명세에서 null 가능성이 빠졌거나 geometry가 일반 JSON으로 정의됐으면 그 한계도 따라온다.
API 응답을 받는 경계에서 구조·null·좌표를 확인하고, 표시 모델로 변환해야 한다.
필요한 보완 계약은 생성 원본과 구분해서 관리한다.

## 급지도에서의 적용

2026-11-15 조회한 생성 OpenAPI는 voteTier의 null 가능성을 표현하지 않았지만
실제 권역 조회에서는 null이 반환됐다. BE 통합 테스트에도 가격·순위 null 사례가 있다.
polygon은 JsonNode로 정의됐으며 실제 DB는 MultiPolygon이다. FE의 LatLng 단일 배열은
여러 polygon과 내부 hole을 보존하지 못한다.

따라서 고정 OpenAPI와 생성 타입은 계약 변경을 추적하는 기반으로 삼고,
nullable/geometry 검증과 UI 변환을 별도로 설계한다. 없는 가격을 0으로 바꾸거나
권역 중심을 단지 위치로 채워 타입을 맞추면 잘못된 사용자 정보를 만들게 된다.
최초 조사에서는 생성 도구나 제품 코드를 추가하지 않았다. 이후 선행 작업 요청으로
[독립 읽기 계층](../../../architecture/map-api-read-layer.md)을 추가해 런타임 검증을 구현했으며,
이후 기존 화면에도 연결했다. 2026-11-20 보강된 배포 명세 사본과 생성 타입 별칭을 도입했다. `pnpm api:generate`로 재생성하며 런타임 파서는 필수 면적·nullable location·유효 좌표·ring을 계속 검증한다. TypeScript 타입만으로 누락 필드나 NaN 응답을 걸러낼 수 없기 때문이다.

## 관련 자료

- [지도 API 계약 조사](../../../architecture/map-api-integration-review.md)
- `src/features/map-exploration/types.ts`
- BE `MapView`, `MapController.ZoneDetailResponse`, `MapApiIT`
