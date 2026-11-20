# 월드컵 실제 API 구조와 검증

> 상태: 실제 API 연동·자동 검증 완료, 실서버 쓰기·실기기 검증 남음 · 버전: 1.3 · 갱신: 2026-11-20

제품 기준은 [월드컵 SDD](../product/specs/worldcup/README.md), 구현 선택의 근거는 [ADR-009](../history/ADR-009-worldcup-server-game-state.md)다. develop `0b545035` 기반의 지정 Orca worktree에서 FE만 변경했다. 코드 작성·수정은 100% AI다. 최초 인계는 구현·검증까지였고, 후속 사용자 요청으로 커밋·push·develop 대상 PR 생성까지 승인됐다. merge는 포함하지 않는다.

## 계약과 파일 책임

- `api/contracts.ts`: 기존 지도 API 위치의 생성 `components` 타입을 재사용한다. 배포 OpenAPI의 월드컵 DTO는 required/null 표현이 부족해 `Required`와 실제 nullable 필드를 읽기 전용 BE 문서에 따라 보강한다. 생성 파일은 수정하지 않는다.
- `api/validation.ts`: 모든 네트워크 JSON을 unknown으로 받아 카드(급지1.0~5.9)·고정10판·연속 확정 기록·다음 판·완료·좌우 합100 또는 비공개 null·진행 수·목록을 검증한다. 계약 오류는 예시값으로 복구하지 않는다.
- `api/client.ts`: 상대 `/api/v1/worldcup`와 `credentials: 'include'`, `cache: 'no-store'`, AbortSignal을 사용한다. 서버 오류 메시지를 그대로 UI에 노출하지 않고 status/code를 구분한다. 요청 전·응답·JSON 해석 후 취소를 확인한다.
- `live-source.ts`: 실제 API capability를 제공한다. 예시 loadMatch/submit으로 fallback하면 명시적으로 실패한다. `source.ts`의 기존 cursor source와 `/worldcup?scenario=`는 검토용이다.
- `use-live-worldcup.ts`: 세션별 게임 snapshot, 일반/권역 scope, 제출 잠금, 불확실한 응답 복구, 피드백/다음 판 타이머, 날짜 경계를 소유한다. `use-worldcup.ts`는 실제 source면 이 hook을 선택하고 예시 흐름도 유지한다.
- `use-live-data.ts`, `live-data.tsx`: 진행·타임라인 읽기, scope별 취소, 오류·빈 목록·재시도, 타임라인 이동의 로컬 취소·오류 UI를 담당한다. 실제 상세 조회·이동의 권위와 최신 탐색 취소는 ExplorationPage가 소유한다. 페이지 성공 revision·재진입·1분 주기·window focus에서 재조회한다. 전체 선택5건 미만이면 타임라인 영역을 숨긴다.
- `worldcup-dialog.tsx`: 기존 native dialog·Button·CloseButton·토큰·집/왕관 자산을 재사용한다. 실제 카드에 대표 거래·계약일을 표시하고 예시 역·소개는 표시하지 않는다.
- `ExplorationPage`: 모달 진입 scope·페이지 My Picks·읽기 refresh revision과 타임라인 이동 요청을 소유한다. 실제 지도 메뉴/권역 상세를 활성화하고 실제 source에는 예시 본인 타임라인을 추가하지 않는다.

게임 카드에는 zoneId/좌표가 없다. 이 카드의 권역 정보는 표시용이며 navigationZone을 만들지 않는다. 타임라인에는 실제 zoneId가 있으므로 지도 source.loadZone으로 좌표·geometry를 확인한 다음 기존 선택 경계로 이동한다. 급지 없는 타임라인 행에 임의 급지를 표시하지 않는다.

## 게임 흐름과 경합

1. 진입하면 scope의 `GET .../games/current`를 조회한다. `404 GAME_NOT_FOUND` 또는 완료된 최근 게임이면 시작으로 간다. 권역 신규 시작 전 zones의 canStart를 확인하고 부족하면 alternatives를 조회한다. 이어갈 미완료 권역 게임은 신규 후보 조건으로 막지 않는다.
2. `POST .../games`는201 신규 또는200 이어하기다. 일반 경로와 `/zones/{zoneId}/games` 경로를 분리한다. 고정 matchups에서 서버 nextRoundNumber에 해당하는 판만 표시한다.
3. 선택/넘김을 동기 잠금 후 `PUT .../current/rounds/{n}/vote` 또는 `/skip`으로 보낸다. 선택 body는 selectedComplexId, 넘김은 본문이 없다. 응답 게임과 해당 확정 기록·roundResult를 확인한 뒤에만 성공 callback을 호출한다. 비율은 서버 available/leftPercent/rightPercent만 사용한다.
4.409 충돌과404 게임 소실은 새 성공을 만들지 않고 해당 흐름의 현재 상태로 재동기화한다. GAME_UNAVAILABLE은 부족 안내·권역 대안, DAILY_GAME_LIMIT_REACHED는 일일 종료로 구분한다.
5. 네트워크·응답 검증 실패로 결과가 불확실하면 재시도에서 먼저 current를 읽는다. 같은 snapshot의 같은 선택/넘김이 저장됐으면 재전송 없이 성공을 확인한다. 다른 확정 기록·다른 게임이면 최신 진행으로 돌아가며 본인 새 선택으로 세지 않는다. 미저장일 때만 같은 요청을 보낸다. 시작 응답 유실도 재시도 GET으로 이미 생성된 게임을 찾는다.
6.10판 완료 후 피드백 시간을 마치면 최신 current를 확인하고 다음 게임을 시작한다. 다른 탭에서 이미 시작한 미완료 게임이 있으면 그것을 이어간다. 일일 한도에 도달하면 자동 생성/재전송을 멈춘다.
7. 한국 날짜는 Asia/Seoul로 비교한다. 일반 조회·시작·재시도 GET이 자정을 가로지르면 새 날짜 current를 읽는다. 열린 전날 카드도 다음 입력 전에 다시 읽고 투표하지 않는다. 권역 비교는 날짜로 초기화하지 않는다.

서버는 외부 game ID·version·startedAt을 제공하지 않는다. 프론트는 10판 snapshot과 이미 확인한 선택/넘김 기록으로 변경을 확인한다. 서로 다른 두 게임의 snapshot이 완전히 같고 기존 확정 기록도 구분되지 않는 극단적 경합은 클라이언트만으로 식별할 수 없다. 다중 탭에서 조회와 PUT 사이의 원자적 게임 버전 조건이 필요해지면 BE 계약 보완을 검토한다.

모든 요청과 타이머는 scope 변경·unmount에서 취소한다. 취소를 무시하는 응답도 생존 flag·signal로 차단한다. 닫기가 서버의 이미 저장된 선택을 롤백한다는 의미는 아니다. 닫힌 사이 저장된 판은 다음 current로 복구되지만 페이지 My Picks에 임의 추가하지 않는다.

## 읽기·숫자·접근성

My Picks는 페이지 메모리의 성공 확인 선택 수이고 넘김은 제외한다. 새로고침 시0으로 시작하며 전체 개인 이력을 복원하지 않는다. 서버 progress는 오늘 일반 선택+넘김 확정 판을 센다. 권역 비교가 성공해도 progress의 일반 수를 로컬 증가시키지 않고 재조회한다. 개인 리포트 API는 호출하지 않는다. 지도 급지·순위·유효표를 즉시 갱신했다고 표시하지 않는다.

타임라인은 공개 최근20건이고 같은 쿠키의 mine을 `나`로 표시한다. 전체 목록5건 임계값과 권역 목록 빈 결과를 분리한다. API가 없는 급지·좌표를 만들지 않고, 상세 조회 실패에는 재선택을 안내한다. 필터 변경·응답 취소·목록 스크롤은 기존 shell 컨테이너를 유지한다.

첫 설명 키 `geupjido.worldcup.intro.v1`는 익명 쿠키와 별개다. dialog.showModal·배경 inert·정/역 Tab 순환·IME Escape 보호·body overflow 복원·원래 trigger 또는 지도 메뉴 focus 복귀를 유지한다. 비동기 상태가 바뀌어도 유효한 닫기 focus를 빼앗지 않는다. 공개 비율1.1초/비공개·복구·reduced motion0.6초와 별도2.4초 피드백 타이머를 유지한다. 데스크톱은 My Picks·600px 창·하단 안내를 포함한 전체 묶음을 중앙에 배치한다. My Picks는 ResizeObserver로 실측한 높이+12px 간격을 부모 padding에 반영하고, 전체가 화면보다 크면 레이아웃의 자연 높이로 상단부터 스크롤한다. 779px 이하만 보정하던 분기는 제거했다. 모바일은 부모 padding0을 유지한다. 768px 미만은 전체화면과 세로 대진이며 짧은 화면은 내부 스크롤·sticky 닫기를 사용한다. 모바일 타임라인은 미제공이다.

## 배포·쿠키

[고정 OpenAPI](api/INDEX.md)와 BE main `2e4aab80`의 [게임](https://github.com/sugkamoney/geupjido-backend/blob/main/docs/architecture/worldcup-game-api.md), [카드](https://github.com/sugkamoney/geupjido-backend/blob/main/docs/architecture/worldcup-card-api-contract.md), [권역](https://github.com/sugkamoney/geupjido-backend/blob/main/docs/architecture/worldcup-zone-selection-api.md), [타임라인](https://github.com/sugkamoney/geupjido-backend/blob/main/docs/architecture/worldcup-timeline-api.md), [배포 인계](https://github.com/sugkamoney/geupjido-backend/blob/main/docs/architecture/dev-api-frontend-handoff.md)를 대조했다. BE를 수정하지 않았다.

프론트는 동일 출처 상대 `/api`를 사용한다. 로컬 Vite는 기존 MAP_API_PROXY_TARGET으로 대상을 선택하며 운영도 같은 origin 경로를 전달해야 한다. gjd_uid는 HttpOnly·Secure·SameSite=Lax라 JS로 읽거나 localStorage에 저장하지 않는다. 개발 API 절대 주소를 브라우저에서 직접 호출하는 교차 사이트 방식으로 바꾸지 않는다. Safari 실연동은 신뢰할 수 있는 HTTPS 프론트 또는 HTTPS 동일 사이트 배포에서 검증해야 한다.

## 검증 기록

Node24.15.0·pnpm11.13.0을 사용했다. 실행 명령은 `npx --yes --package=node@24.15.0 --package=pnpm@11.13.0 -- <명령>`이다. 최종 결과는 다음과 같다. 이번 실행 환경은 macOS이며 Linux WebKit 검증을 대체하지 않는다.

| 검사 | 기대 | 현재 결과 |
|---|---|---|
| 시작 baseline `pnpm test` | 기존 단위 회귀 |236개 통과 |
| API·상태·읽기 테스트 | 계약·409·응답 유실·시작 유실·날짜·scope·타임라인 stale | 27개 추가 단위 테스트 포함 전체263개 통과. 두 일반 자정 경계와 필터 scroll 회귀는 실패→성공 확인, 권역 게임은 자정 뒤에도 유지 확인 |
| `pnpm check` | 토큰·타입·lint·format·단위·운영 build | 단위263개(30파일)·전체 품질 gate·운영 빌드 통과 |
| 실제 월드컵 경로 E2E | desktop Chromium/mobile Chromium·WebKit | 전체156개 통과·48개 플랫폼 조건 제외·실패0. 실제 월드컵/쿠키·후속 리뷰는25개 통과·14개 모바일 타임라인/desktop 배치 조건 제외 |
| 격리 HTTPS cookie E2E | Secure/HttpOnly/SameSite·PUT 쿠키·새로고침 이어하기 | 세 브라우저 통과 |
| 공유 개발 API GET | progress·zones·timeline 배포 응답 |2026-11-20 progress·zones·timeline 조회, 쿠키 없는 진행0. current는404 GAME_NOT_FOUND·Set-Cookie 없음. 배포 월드컵 경로는 고정 OpenAPI와 동일 |
| 실제 개발 서버 POST/PUT | 실제 DB 저장 |미실행: 격리 BE/DB 미제공, 공유 DB에 가상 표를 기록하지 않음 |
| 실기기 iOS/Android·VoiceOver·IME/주소창/회전 | 물리 기기 조합 |장치 없음, 자동화의 WebKit/Pixel 모사는 실기기 검증이 아님 |

쿠키 검증은 `e2e/helpers/worldcup-server.ts`의 루프백 전용 HTTPS 서버에서 실제 Set-Cookie·HTTP 요청으로 수행한다. 자체 서명 인증서를 만들고 테스트 context에서 인증서 오류만 허용한다. 브라우저 쿠키를 수동 주입하지 않으며 공유 API·DB로 연결하지 않는다. 테스트 종료 시 서버와 임시 인증서를 정리한다. Spring 서비스·실제 배포 CORS·공인 인증서의 종합 검증은 아니다.

초기 route.fulfill 기반 쿠키 검사는 WebKit에서 Set-Cookie가 전달되지 않아 실패했고, 이를 실제 HTTPS transport 검사로 분리했다. 초기 데스크톱 테스트는 패널 열기를 누락해 실패했으며 실제 메뉴 진입 절차로 고쳤다. 타임아웃을 늘리거나 실패를 무시하지 않았다. 내장 브라우저는 iab 연결 불가로 프로젝트 Playwright와 캡처를 사용했다. 모바일·데스크톱 실제 API 카드 캡처에서 대표 거래·계약일, 기존 자산·버튼·대진 배치를 확인했다.

PR10은 최종 재확인(2026-11-20)에도 OPEN이다. 부모의 ResizeObserver 스크롤 수정은 이 기준 develop에 없고 임의 병합·중복 수정하지 않았다. macOS의 기존 수동 목록 스크롤 회귀는 세 엔진에서 통과했으며 Linux WebKit의 알려진 지연 최초 ResizeObserver 이슈가 해결됐다고 주장하지 않는다. 이 child에서는 Linux를 실행하지 않았다. PR10 병합 후 정상 develop 통합·Linux 전체회귀가 남는다.

`requesting-code-review` 스킬의 읽기 전용 독립 리뷰에서 재시도 current GET 중 자정 변경 누락1건을 확인해 실패 회귀와 수정으로 해소했다. 재리뷰에서 추가 Critical/Important는 없었다. 다음 세트 E2E도 literal 판번호 `[10,1,2,3,4,5,6,7,8,9,10]`으로 강화했다. 타임라인은 칩 전환 시 scroll0, 다른 권역의 지연 조회 중/완료 뒤 scroll200 유지 회귀를 통과했다.

전체 E2E 뒤 지도 테스트의 미지정 타임라인 GET을 명시적으로 격리했다. 변경한 지도 API E2E15건은 세 엔진에서 재검사해 모두 통과했으며 전체 결과와 구분한다. 최초 전체 실행의 proxy ECONNREFUSED는 이 미지정 읽기 요청이 원인이었고 제품 성공을 만든 것은 아니다. 타임아웃·재시도·플랫폼 제외 정책은 변경하지 않았다.

최종 `pnpm check`, `pnpm test:e2e --workers=2`와 `git diff --check`를 사용한다. 제외48건은 기존34건, 실제 타임라인2종의 모바일4건, 리뷰 후속 desktop 전용5종의 모바일10건이다. 물리 기기·실제 NAVER SDK와 새 월드컵 쓰기의 결합, 실제 배포 CORS·DB 저장·Linux는 미검증이다.

## 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
|0.1|2026-10-15|검토용 source·모달·My Picks·타임라인 구현 |
|0.2|2026-10-27|유효한 focus 보존 |
|1.0|2026-11-20|실제 게임·권역 대안·진행·타임라인·쿠키·경합·날짜 계약과 현재 검증으로 갱신 |
| 1.1 | 2026-11-20 | PR #11 최신 지도 탐색 경합·가변 모달 높이 회귀 보완 |
| 1.2 | 2026-11-20 | 실제 개발 Origin CORS 확인·5.x 카드 급지 검증 보완 |
| 1.3 | 2026-11-20 | E2E 생성 HTML의 개발 서버 새로고침 간섭 차단 |

## PR 제출

2026-11-20 후속 요청으로 기능 브랜치를 커밋·push하고 develop 대상 [PR #11](https://github.com/sugkamoney/geupjido-frontend/pull/11)을 생성했다. 이후 사용자 리뷰의 두 재현을 같은 PR의 후속 수정으로 반영한다. 최신 origin/develop은 시작 기준과 같고 PR10은 OPEN이어서 부모의 스크롤 수정 커밋은 포함하지 않는다. 게시 전 pnpm check와 diff를 재확인한다.

## PR #11 리뷰 회귀 보완

2026-11-20 사용자 리뷰의 두 재현을 실패 테스트로 확인했다. 전체 타임라인에서 A 상세를 기다리다 검색으로 B를 고르면 A가 늦게 덮었고,1280×780·긴 단지명에서 My Picks의 y는−26.5px(높이800에서는−16.5px)였다.

타임라인 조회 scope와 지도 탐색의 수명을 분리했다. LiveTimeline은 버튼 요청의 자식signal을 전달하고 ExplorationPage의 useTimelineNavigation이 source.loadZone용 controller를 소유한다. 새 라벨/검색/목록 선택, 상세 닫기, 지도 명령은 동기적으로 이전 이동을 취소한다. MapSurface의 onNavigationStart를 실제 포인터 시작·휠·유효한 더블클릭·이동/줌 키 입력에서 호출한다. 카메라 revision 변화 자체는 취소 기준이 아니다. 이전 선택의 이동 애니메이션 프레임이나 화면 크기 조정이 더 최신 타임라인 클릭을 취소해서는 안 되기 때문이다. 취소를 무시한 source도 resolve 뒤 controller·자식signal을 검사하므로 최신 선택을 덮지 않는다. 자식 취소·unmount·source 교체도 정리하며, 이전 finally가 새 요청 ref를 지우지 않게 동일 controller인지 확인한다.

My Picks의 절대 배치는 유지하되 실측 높이를 부모의 레이아웃 높이에 포함했다. 고정 높이 임계값을 늘리는 방식은 진행/이름/피드백/글자 크기가 바뀔 때 같은 문제가 생겨 사용하지 않았다. 기존 데스크톱 중앙 정렬 검사는 창 단독이 아닌 전체 묶음 중심을 확인한다. 모바일 전체화면·상단 내부 판·닫기·넘김 배치는 유지한다.

검증: 지연 타임라인 E2E, 취소를 무시하는 source의 같은 권역 재검색·목록 선택·상세 닫기·키보드 pan·휠 zoom·이전 애니메이션 프레임 통합 테스트,779/780/800/1080 높이의 긴 이름·진행 현황·My Picks 위치와 스크롤/닫기 회귀를 추가했다. `pnpm check`는262개(30파일)와 빌드를 통과했다. 독립 리뷰에서 카메라 revision 구독이 이전 애니메이션의 남은 프레임으로 새 요청을 취소하는 경계를 추가로 확인했고, 실패 회귀 뒤 실제 입력 기반 취소로 수정했다. 최종 좁은 재리뷰에서는 추가 Important 이상이 없었다. 전체 E2E 결과는 아래 최종 실행 기록을 따른다.


최종 실행 기록(리뷰 후속): Node24.15.0·pnpm11.13.0에서 `pnpm check`262개 통과, `pnpm test:e2e --workers=2`156개 통과·48개 플랫폼 조건 제외·실패0. macOS desktop Chromium·mobile Chromium/WebKit과 NAVER 오류 구성을 실행했다. 새 제외10건은 desktop 전용 지연 타임라인1건과 높이4종의 모바일 project 조건이다. 기존 모바일 whole-screen·짧은 화면·focus·넘김 회귀도 통과했다. 공유 API 쓰기·실기기·Linux는 이번 후속에서도 미실행이다.


## 로컬 대진 로드 오류 확인

2026-11-20 실제 실행에서 `http://127.0.0.1:5173`의 Origin은 개발 API에서403 `Invalid CORS request`, `http://localhost:5173`은 허용됨을 확인했다. 같은 포트라도 두 host는 다른 Origin이다. `changeOrigin: true`는 upstream Host를 바꾸며 브라우저 Origin을 허용된 값으로 바꾸는 설정이 아니다. 기존 허용 localhost 주소를 사용하고 서버 CORS를 임의 완화하거나 프록시에서 Origin을 숨기지 않는다. `.env.example`의 NAVER 서비스 URL도 localhost를 기준으로 한다. 최초 실행 안내에서 IP 주소를 연 것은 잘못이었으며 localhost로 다시 열었다.

확인은 개발 API OPTIONS와 프록시 경유 GET으로 수행했다. POST 사전 요청은 IP Origin403·localhost Origin200, current GET은 IP Origin403·localhost Origin404 GAME_NOT_FOUND였다. 후자의404는 익명 쿠키 없는 조회에서 정상이며 신규 시작으로 진행하는 조건이다. 이 진단에서 공유 개발 API의 게임·투표 쓰기는 하지 않았다.

추가로 공개 zones 응답의 급지 최대5.8을 읽어, 카드 검증의 `<=5`가 유효한5.x 대진을 거부함을 발견했다. BE `V3__expand_zone_tier_range.sql`은1.0~5.9를 허용한다. 검증을 이 범위에 맞추고5.8·5.9 수용,5.91·6·비유한 숫자 거부 회귀를 추가했다. 지도 카드의 정수 등급은 여전히 floor(tier)1~5를 사용한다. 새 게임을 쓰지 않고 합성 계약 응답으로 실제 화면의 대진 로드·투표 후5.x 급지 공개를 검증한다.

급지 검증 후속 검사: `pnpm check`263개와 빌드 통과. 새5.x 대진 E2E는 desktop Chromium·mobile Chromium/WebKit3건 통과(합성 API). 직전 전체 E2E156개 통과·48개 조건 제외와 구분한다. 개발 API 진단은 OPTIONS·GET만 수행했다.


## 개발 화면 새로고침 간섭

2026-11-20 사용자 확인 중 개발 서버 로그에 E2E 산출물 HTML 변경의 `page reload`가 반복된 것을 확인했다. `server.watch.ignored`에서 dist-e2e·test-results·playwright-report를 제외한다. 소스 변경에 대한 정상 갱신은 유지한다. 실제 설정을 사용한 임시 루트 Vite 서버의 생성 HTML 변경은 수정 전 새로고침3건→수정 후0건, 앱 HTML 변경의 전후 양성 대조는 모두 감지했다. 실행 화면을 켠 채 테스트 빌드를 수행한 개발 환경 간섭이며, 제품 실행 중 주기적인 문서 새로고침으로 단정하지 않는다.

직접 확인할 화면은 소스 수정·E2E 빌드로 바뀌지 않는 별도 production build의 preview로 제공할 수 있다. 현재 사용 origin은 localhost:5173을 유지하며 NAVER 공개 Client ID와 개발 API 프록시를 실행 환경에서 전달한다. 실제 서버 저장·투표는 이 진단에 포함하지 않는다. 검증 범위와 HMR·API 재조회의 차이는 [Q&A-011](../learning/frontend/q-and-a/QA-FE-011-dev-reload-during-e2e.md)을 따른다.

현재 직접 확인용 화면은 저장소 밖의 독립된 임시 production build를 `http://localhost:5173`에서 preview로 제공한다. HTML에 `@vite/client`가 없고 NAVER 공개 Client ID가 빌드에 포함됐음을 값 노출 없이 확인했다. 실제 API proxy의 Origin 포함 current GET은 정상404 GAME_NOT_FOUND였다. 이 preview는 후속 소스 수정·테스트 빌드가 바꾸지 않으며, 변경을 보여주려면 다시 빌드해 교체해야 한다.

감시 수정 후 `pnpm check`263개와 운영 build가 통과했다. 개발 서버 감시 동작의 수정이므로 UI 전체 E2E는 반복하지 않았고, 실제 설정을 읽은 격리 Vite 서버에서 생성 HTML 무시·앱 HTML 정상 갱신을 직접 검증했다.
