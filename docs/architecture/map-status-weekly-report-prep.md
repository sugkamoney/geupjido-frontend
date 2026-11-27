# 지도 상태 조회와 공개 주간 리포트 fixture

## 지도 상태 조회

`GET /api/v1/map/status`는 현재 서비스 권역 분포와 최근 3시간 발행 집계의 스냅샷을 반환한다.

| 필드 | 의미 |
| --- | --- |
| `zoneCount`, `initialTierZoneCount`, `missingInitialTierZoneCount` | 전체 서비스 권역 수와 초기 급지 유무에 따른 권역 수 |
| `voteBasedZoneCount`, `collectingZoneCount` | 민심 급지 전환 권역 수와 수집 중 권역 수 |
| `initialGradeCounts` | 초기 급지 1~5급지 구간별 권역 수. 빈 구간도 0으로 포함 |
| `validVoteCount`, `participantCount` | 최근 발행 집계에서 확정한 유효표·참여자 수. 첫 발행 전 둘 다 0 |
| `lastCompletedAt`, `nextScheduledAt` | 마지막 집계 완료 시각과 예약 시각. 첫 발행 전 완료 시각은 `null`, 예약이 꺼졌거나 다음 예약이 없으면 예약 시각은 `null` |

집계 수치는 선택 즉시 증가하는 실시간 수치와 구분한다. 예약 시각이 있으면 서버 값을 그대로 사용한다. 서비스 기본 예약은 한국 시간 기준 3시간 간격이다. 초기 급지 수는 서비스 DB의 편집 급지 기준이다.
[백엔드 지도 탭 계약](https://github.com/sugkamoney/geupjido-backend/blob/main/docs/architecture/map-tab-api.md)

지도 화면의 통합 지점은 기존 QueryClientProvider 안에서 `useQuery(mapStatusQueryOptions())`를 호출한다.
키는 `['map', 'status']`다. 요청은 기존 같은 출처 지도 GET 전송을 사용하며 AbortSignal을 전달한다.
검증 오류와 HTTP 4xx 이하 오류는 즉시 실패하고, 그 밖의 요청 실패는 300ms 후 한 번 재시도한다.
`parseMapStatus`는 필수 필드, 안전한 비음수 정수, 다섯 급지 구간, 시간대가 있는 타임스탬프와 명시적 `null`을 검사한다.
집계 오류는 0으로 대체하지 않고 Query 오류 상태로 전달한다.

## 독립 상태 카드 UI

[`MapStatusCard`](../../src/features/map-status/map-status-card.tsx)는
`basis`, `data`, `phase`, `onRetry`를 받는다. 지도 화면에서 검증된 최근 응답과
쿼리 상태를 함께 전달하며, 갱신과 갱신 실패 중에도 최근 응답을 계속 전달한다.
카드는 동일한 응답으로 접힘과 펼침을 렌더링한다. 예약 경과 시의 타이머는
민심 카드의 표시만 바꾸며, 완료 시각과 다음 예약은 서버 응답을 사용한다.

카드는 부모의 가용 폭으로 줄어들고 팝오버 본문은 높이가 부족할 때 내부 스크롤된다.
부모에서 가용 높이를 제한할 경우 `--map-status-available-height`를 지정할 수 있다.
지도 SDK가 이벤트를 처리하는 캔버스 밖의 오버레이에 카드를 배치한다. 지도 배치와 렌더러 주입은 통합에서 담당한다. 초기 급지 카드를 데스크톱 웹에
연결하는 범위이며, 민심은 fixture로 검증하고 모바일 웹의 카드 노출은 보류한다.

## 공개 주간 리포트

`GET /api/v1/reports`는 목록 상태와 공개된 발행본을 최신순으로 반환한다.
`expectedReleaseAt`은 대기·지연 중인 기간의 예정 시각이며, 이번 마감본이 발행된 경우 다음 주 공개 예정 시각이다.
발행 전 `collectingZones`에는 마지막 3시간 집계의 수집 중 권역이 최대 5개 담긴다.
발행본이 있으면 목록의 이 배열은 비고, 선택한 발행본의 상세에서 해당 주의 스냅샷을 읽는다.

`GET /api/v1/reports/{reportId}`에서 기간은 한국 시간 일요일 18시부터 다음 일요일 18시 직전까지다.
`periodEnd`, `cutoffCompletedAt`, `publishedAt`은 각각 마감, 마감 계산 완료, 실제 공개 시각이다.
주간 참여자·유효표는 해당 기간의 유효한 선택에서 계산한다. 직전과 비교해 1~5급지 구간을 넘은 권역만
`changedGradeZoneCount`에 포함된다. 상승은 숫자가 작아지는 방향이고 변화량은 절댓값이다.
수집 중 권역은 유효표 50표, 참여자 10명, 권역 간 유효표 20표의 세 조건을 사용한다.
첫 발행본의 변경 수는 `null`이고 비교 목록은 빈 배열이다. 비교 가능한 주에 변화가 없으면 변경 수는 0이다.
이전·다음 탐색은 서버가 보낸 ID를 사용한다. 이동 대상이 없으면 `null`이다.
이 계약은 레일의 공개 리포트에 적용되며 월드컵의 개인 내 선택 리포트는 별도 흐름이다.
[백엔드 공개 주간 리포트 계약](https://github.com/sugkamoney/geupjido-backend/blob/main/docs/architecture/report-tab-api.md)

## 로컬 검증과 연결

- `pnpm test src/features/map-status/query.test.ts`로 GET 경로, 취소 신호 전달, 정상 스냅샷, 첫 발행 전, 예약 없음, HTTP 실패 및 잘못된 응답을 검사한다.
- `pnpm test src/features/map-status/map-status-card.test.tsx`로 급지 정렬, 시간 표시, 상태 전이와 키보드·바깥 클릭 동작을 검사한다.
- `pnpm check`로 전체 단위 테스트와 빌드를 검사한다. Fixture의 필수 필드와 열거값은 생성 타입을 바탕으로 타입 검사한다. 고정 명세에 빠진 상세의 세 nullable 필드는 backend 응답 DTO에 맞춰 fixture 타입에 명시했다.
- `src/features/weekly-report/fixtures.ts`에서 `weeklyReportListFixtures[state]`를 선택할 수 있다. `COLLECTING`에는 발행본 없이 수집 권역이 있고, `PREPARING`과 `DELAYED`에는 새 마감본의 공개 대기 또는 지연 중에도 기존 발행본 3건이 남아 있다.
- `PUBLISHED` 목록의 첫 행부터 `weeklyReportDetailFixtures.latest`, `.previous`, `.first`를 ID로 따라가며 탐색을 확인할 수 있다. 최신 발행본은 비교 목록에 행이 있고 중간 발행본은 0곳과 빈 비교 목록을 표시하며 첫 발행본은 변경 수가 `null`이다.
- 데이터 모듈은 데스크톱·모바일 웹에서 공통 사용한다. 상태 카드의 지도 연결과 실제 레이아웃 확인, 리포트 화면과 AppShell 연결은 통합에서 진행한다.
