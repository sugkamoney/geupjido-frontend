# 지도·검색·권역 상세 BE 연동 조사 인수인계

> 상태: 조사·설계 시작, 제품 코드 구현 전 · 버전: 0.1 · 갱신: 2026-11-15

## 사용자 요청과 작업 환경

사용자는 최신 develop을 기준으로 BE API 연동을 살펴보고, 작업마다 브랜치와
Orca workspace를 생성해 내용을 전달하는 방식을 지정했다.

- 기준: develop `2fe3b438735aa36c22cfd44eb85bf661a8d97548`
- 브랜치: `feature/integrate-map-api`, 향후 PR 대상 develop
- Workspace: `/Users/user/orca/workspaces/geupjido-frontend/feature-integrate-map-api`
- 상위 checkout의 develop 최신화와 기존 점검 문서 보존 완료
- 현재 단계는 계약 대조·설계 검토다. 제품 코드 작성이나 전면 디자인 개편을 바로 시작하지 않는다.

## 먼저 읽을 자료

AGENTS.md와 지도·검색 SDD, `docs/architecture/map-exploration.md`, `search.md`,
`frontend-foundation.md`, `naver-map-sdk-handoff.md`를 읽는다.
상위 checkout의 `docs/architecture/2026-11-15-implementation-review.md`는 조사 참고 자료다.

BE 저장소는 `sugkamoney/geupjido-backend`다. 이번 조사에서 읽은 develop 기준은
`a3e7a28e8a68a9ee1a7f7f60b5dc41c7122b356c`이며 읽기 전용 사본은
`/private/tmp/geupjido-be-review-20261115`에 있다. 후속 조사 시 원격 변경 여부도 확인한다.

BE의 다음 파일을 읽되 변경하지 않는다.

- `docs/architecture/map-tab-api.md`
- `docs/architecture/dev-api-frontend-handoff.md` (환경 값·배포 정보는 문서에 복사하지 않음)
- `docs/history/2026-11-14-map-worldcup-backend-qa.md`
- `src/main/java/com/geupjido/map/api/MapController.java`
- `src/main/java/com/geupjido/map/model/MapView.java`
- `src/main/java/com/geupjido/map/service/MapQueryService.java`
- 관련 조회 repository·통합 테스트

## 이번에 검토할 범위

지도 실제 데이터, 검색, 권역 상세 연동을 첫 범위로 제안한다. 전체 제품 API를
한꺼번에 연결하는 안과 비교하고, 사용자에게 범위와 설계를 구체적으로 제시한다.
새 상태 카드·랭킹·투표함 디자인 반영과 월드컵 API 연동은 후속 순서다.
초기/민심 급지 분리를 위한 모델 준비와 이번 화면에서 실제 노출할 기준을 구분한다.

| BE 경로 (`/api/v1/map`) | FE 연결 지점 |
|---|---|
| `/cities` | 구·시 라벨, 중심, bounds, 전체 보기 범위 |
| `/zones?west=&south=&east=&north=` | 현재 지도 범위의 권역 라벨 |
| `/complexes?west=&south=&east=&north=` | 현재 지도 범위의 단지 핀 |
| `/zones/{zoneId}` | 선택 권역 GeoJSON·요약·전체 단지 목록 |
| `/search?q=` | 기존 비동기 SearchSource의 서버 검색 구현 |
| `/status` | 현재는 후속 상태 UI의 계약을 확인하고 이번 구현 포함 여부를 구분 |

## 확인된 구조 차이와 조사 항목

1. 현재 `ExplorationPage`는 전체 fixture catalog를 받고 `ExplorationSource`는
   loadZone만 제공한다. viewport 비동기 조회·bounds 산출·요청 빈도·취소·오래된 응답
   차단·로딩/빈 값/실패/재시도·선택 유지 구조가 필요하다. 기존 TanStack Query provider가 있다.
2. FE `MapLabel`은 grade/value/detail/area/bounds를 필수로 요구한다. BE 권역 목록에는
   bounds·면적이 없으므로 임의 좌표/값으로 메우지 않는다. 화면 맞춤과 라벨 충돌 정책을 검토한다.
3. FE `Zone`은 polygon 배열을 항상 갖지만 BE 목록에는 경계가 없고 상세에서만
   GeoJSON을 반환한다. 실제 geometry 유형(Polygon/MultiPolygon·hole), 좌표 순서,
   렌더링·카메라 맞춤을 확인한다. SRID 지정만으로 좌표 정확성을 보장하지 않는다.
4. 상세의 Complex에는 좌표·zoneId가 없고 단지 핀/검색 응답에는 좌표가 있다.
   전체 목록의 화면 밖 단지를 선택해 이동할 때 좌표를 어떻게 확보할지 조사한다.
   좌표가 없는 단지에 권역 중심을 넣어 실제 단지 위치인 것처럼 표시하지 않는다.
5. 서버 검색 결과의 단지는 권역 전체 객체가 아니다. 기존 SearchTarget이 요구하는
   zone 참조를 실제 ID로 조회할 수 있게 하고 viewport catalog로 전체 검색을 대체하지 않는다.
6. BE initialTier/voteTier와 null·INITIAL/VOTE·순위/대상 수를 보존한다.
   기존 FE의 단일 grade/value와 연결할 기준을 설계에서 명확히 한다.
7. 초기 급지는 추정 편집값도 포함한다. `배치표 1.1 원본`으로 표시하지 않는다.
   순위는 전환 전 ㎡당 대표 가격, 전환 후 투표 점수다. `대표 거래가` 문구와
   null 가격·순위 없는 단지 처리, 금액·면적 단위를 확인한다.
8. Vite 프록시는 현재 localhost:8080 고정이다. 같은 origin `/api` 원칙과 실제
   개발 환경을 대조하고 민감한 주소·키를 코드/문서에 넣지 않는다.
9. 생성 OpenAPI 스키마 확보·고정 사본·타입 생성 정책을 확인한다. 수기 FE 계약이나
   기존 9월 cluster/ETag/정수 zoom 설계를 현재 BE 구현으로 간주하지 않는다.
10. NAVER GL adapter·기존 gesture·검색 IME/키보드·모바일 시트 동작을 유지한다.
    실제 데이터와 fixture 검토/테스트 경로는 명시적으로 구분한다.

## 진행 및 검증 기준

먼저 계약 매핑·막히는 지점·대안·권장 범위를 문서화하고 사용자와 설계를 검토한다.
조사 중 제품 코드·의존성 변경·서버 투표 요청은 수행하지 않는다.
설계 확정 뒤 SDD·architecture·계획을 갱신하고 이 workspace에서 구현한다.
상위 checkout이나 BE는 수정하지 않는다. push·PR·merge는 현재 요청에 없다.

구현 단계에서는 frozen 설치와 baseline, API 변환/실패/null·취소/오래된 응답·viewport
변경·화면 밖 검색/목록 선택·geometry 및 데스크톱/모바일 회귀를 검증한다.
`pnpm check`와 브라우저 검사는 빌드 경합 없이 순차 실행하고, 실제 API 읽기 검증과
mock 테스트를 구분한다. 실제 모바일·SDK·좌표 검증을 못 했다면 이유를 기록한다.

## 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| 0.1 | 2026-11-15 | 최신 develop 기반 Orca 작업 환경과 첫 API 연동 조사 범위 전달 |
