# 공개 주간 리포트 조회

`src/features/weekly-report/`의 공개 주간 리포트 읽기 계층은 데스크톱과 모바일 웹에서 공통 사용한다. 리포트 탭의 개인 선택, 이동, 로딩·오류 표시 등 화면 동작은 후속 통합에서 정한다.

- `contracts.ts`는 고정 OpenAPI 생성 타입의 필수 필드를 보강하고 상세의 `changedGradeZoneCount`, `previousReportId`, `nextReportId`에 명시적 `null`을 허용한다. `fixtures.ts`도 같은 타입을 사용한다.
- `validation.ts`는 응답 필드와 중첩 배열, 시각, 비교 유무, 상세 응답의 ID 일치를 검증한다. 응답 계약 위반은 필드 경로를 담은 `WeeklyReportContractError`로 반환한다. 서버 목록 순서와 이전·다음 ID는 그대로 전달한다.
- `client.ts`는 동일 출처 `GET /api/v1/reports` 및 `GET /api/v1/reports/{reportId}`에 `AbortSignal`과 `cache: 'no-store'`를 전달한다. ID는 양의 안전 정수다. HTTP 오류는 상태와 응답 코드를 담은 `WeeklyReportApiError`로 전달한다. `isWeeklyReportNotFound`는 HTTP 404와 `REPORT_NOT_FOUND`가 함께 있을 때 참이다.
- `query.ts`의 `weeklyReportListOptions`·`useWeeklyReportList`와 `weeklyReportDetailOptions`·`useWeeklyReportDetail`은 목록과 ID별 상세를 별도 키로 보관한다. 유효한 ID가 선택되면 상세 구독을 활성화한다. 마지막 관찰자가 상세에서 이탈하면 TanStack Query가 진행 중 요청을 취소한다. 네트워크·5xx 실패에는 300ms 뒤 한 번 재시도한다. 상세의 `nextReportId`는 다음 발행 후 바뀔 수 있으므로 일반 쿼리 재검증을 유지한다.

## 발행 상태와 시각

| 목록 상태 | 의미 |
| --- | --- |
| `COLLECTING` | 조건을 충족한 첫 발행본을 준비할 때까지 수집 중 |
| `PREPARING` | 현재 마감본 공개 준비 중 또는 21시 공개 대기 |
| `DELAYED` | 예정 시각이 지났으며 현재 마감본 공개 대기 중 |
| `PUBLISHED` | 현재 마감본 공개 완료 |

`PREPARING`과 `DELAYED`에서도 이전 발행본이 남아 있으면 조회할 수 있다. 전체 공개본이 없을 때 목록의 `collectingZones`는 마지막 3시간 집계에서 수집 중인 권역을 최대 5개 반환한다. 발행본이 생기면 목록의 배열은 비고 상세에는 해당 주의 스냅샷이 들어온다. `expectedReleaseAt`은 준비·지연 중인 기간의 공개 예정 시각 또는 다음 공개 예정 시각이다.

한국 시간 일요일 18시의 `periodEnd`는 표 집계 마감이며, 마감 정각부터의 표는 다음 기간에 포함된다. `cutoffCompletedAt`은 마감 계산 완료 시각이다. `publishedAt`은 21시 이후 실제 공개 시각이며 지연 시 21시보다 늦다. 시간과 상태는 서버 값으로 읽는다.

첫 발행본은 직전 비교가 없으므로 `changedGradeZoneCount`와 `previousReportId`가 `null`이고 상승·하락·구별 비교 목록이 빈 배열이다. 비교 가능한 주에 바뀐 급지 구간이 없으면 변경 수는 0이다. 구간 내 소수값이 달라졌다면 변경 수가 0이어도 상승·하락 행이 있을 수 있다.

## 근거와 검증

- [지도 상태·리포트 준비 문서](map-status-weekly-report-prep.md), [고정 OpenAPI](api/openapi-2026-11-20.json), [백엔드 계약](https://github.com/sugkamoney/geupjido-backend/blob/2cf4066edc6dda5a6398350d0a5589742bad4e55/docs/architecture/report-tab-api.md)
- 2026-11-27 개발 환경에서 `GET /v3/api-docs`의 리포트 경로 2개와 `WeeklyReport*` 스키마 7개가 고정본과 일치했다. 두 명세는 200 응답을 기술하며 상세의 명시적 null과 404는 백엔드 DTO·계약서로 확인했다.
- 개발 `GET /api/v1/reports`는 200과 `Cache-Control: no-store`, `COLLECTING`, 발행본 0건, 수집 권역 5건을 반환했다. 미발행 ID `9007199254740991`는 404와 `REPORT_NOT_FOUND`를 반환했다. 이 오류 응답에는 `Cache-Control`이 없었다.
- 개발 환경에 공개본이 없어 상세 200은 기존 발행 픽스처를 모의 HTTP 응답으로 연결해 검증했다. `pnpm test src/features/weekly-report/api.test.ts`는 목록 4개 상태, 상세 탐색·캐시 격리·취소, 오류와 응답 검증을 검사한다. 개발 검증은 GET만 사용했다.
