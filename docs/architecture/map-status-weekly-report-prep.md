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

라이브 지도의 상태 카드 슬롯은 기존 QueryClientProvider 안에서 `useQuery(mapStatusQueryOptions())`를 호출한다.
키는 `['map', 'status']`다. 요청은 기존 같은 출처 지도 GET 전송을 사용하며 AbortSignal을 전달한다.
검증 오류와 HTTP 4xx 이하 오류는 즉시 실패하고, 그 밖의 요청 실패는 300ms 후 한 번 재시도한다.
`parseMapStatus`는 필수 필드, 안전한 비음수 정수, 다섯 급지 구간, 시간대가 있는 타임스탬프와 명시적 `null`을 검사한다.
집계 오류는 0으로 대체하지 않고 Query 오류 상태로 전달한다.

### 라이브 지도 연결

`LiveExplorationPage`의 `mapStatusRenderer`에 최종 `MapStatusCard`를 주입하면
AppShell의 데스크톱 지도 영역에 초기 급지 카드가 나타난다. 기본 경로는 renderer를
주입하지 않은 상태다. 모바일 웹의 기존 compact 셸에서는 슬롯과 조회가 함께 제외된다.
기존 카탈로그·권역·핀 알림 및 SDK 오류는 각자의 재시도를 유지한다.

슬롯은 지도 입력 루트와 형제 요소다. 카드 안의 클릭·키보드·휠 이벤트가 지도 입력
핸들러를 통과하지 않는다. 최초 조회는 `loading` 또는 `error`를 전달한다.
정상 응답을 받은 뒤에는 마지막 정상 데이터를 `ready`, `refreshing`,
`refresh-error`와 함께 전달한다. 카드의 재시도는 상태 키 하나를 다시 조회한다.

슬롯은 지도 우측·상단 16px에서 시작해 패널, 검색 입력·결과, 지도 알림과 확대
도구의 실제 사각형을 피한다. 시안의 접힌 크기(256×124)가 들어가는 영역 중
펼친 크기(440×458, 접힌 카드 포함) 이내에서 가장 넓은 영역을 사용한다. 여유가
부족하면 위치와 가용 폭을 바꾸고 내부 스크롤을 사용한다. 접힌 크기도 들어가지
않으면 슬롯을 숨기고 비활성화한다. 이 계산은 통합 전 검증용이며 최소 지원 크기와
대체 UI는 별도 결정 대상이다. 최종 renderer의 트리거와 팝오버는 슬롯의 가용 폭 안에서
우측 정렬하고, 팝오버 내용을 슬롯의 스크롤 영역 안에서 배치해야 한다.

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
- `pnpm check`로 전체 단위 테스트와 빌드를 검사한다. Fixture의 필수 필드와 열거값은 생성 타입을 바탕으로 타입 검사한다. 고정 명세에 빠진 상세의 세 nullable 필드는 backend 응답 DTO에 맞춰 fixture 타입에 명시했다.
- `src/features/weekly-report/fixtures.ts`에서 `weeklyReportListFixtures[state]`를 선택할 수 있다. `COLLECTING`에는 발행본 없이 수집 권역이 있고, `PREPARING`과 `DELAYED`에는 새 마감본의 공개 대기 또는 지연 중에도 기존 발행본 3건이 남아 있다.
- `PUBLISHED` 목록의 첫 행부터 `weeklyReportDetailFixtures.latest`, `.previous`, `.first`를 ID로 따라가며 탐색을 확인할 수 있다. 최신 발행본은 비교 목록에 행이 있고 중간 발행본은 0곳과 빈 비교 목록을 표시하며 첫 발행본은 변경 수가 `null`이다.
- 데이터 모듈은 데스크톱·모바일 웹에서 공통 사용한다. 실제 카드 renderer 및 리포트 화면의 최종 검증은 통합 단계에서 진행한다.
