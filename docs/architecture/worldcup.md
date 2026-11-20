# 월드컵 실제 API 구조와 검증

> 상태: 실제 API 연동·자동 검증 완료, 실서버 쓰기·실기기 검증 남음 · 버전: 1.0 · 갱신: 2026-11-20

제품 기준은 [월드컵 SDD](../product/specs/worldcup/README.md), 구현 선택의 근거는 [ADR-009](../history/ADR-009-worldcup-server-game-state.md)다. develop `0b545035` 기반의 지정 Orca worktree에서 FE만 변경했다. 코드 작성·수정은 100% AI다. 최초 인계는 구현·검증까지였고, 후속 사용자 요청으로 커밋·push·develop 대상 PR 생성까지 승인됐다. merge는 포함하지 않는다.

## 계약과 파일 책임

- `api/contracts.ts`: 기존 지도 API 위치의 생성 `components` 타입을 재사용한다. 배포 OpenAPI의 월드컵 DTO는 required/null 표현이 부족해 `Required`와 실제 nullable 필드를 읽기 전용 BE 문서에 따라 보강한다. 생성 파일은 수정하지 않는다.
- `api/validation.ts`: 모든 네트워크 JSON을 unknown으로 받아 카드·고정10판·연속 확정 기록·다음 판·완료·좌우 합100 또는 비공개 null·진행 수·목록을 검증한다. 계약 오류는 예시값으로 복구하지 않는다.
- `api/client.ts`: 상대 `/api/v1/worldcup`와 `credentials: 'include'`, `cache: 'no-store'`, AbortSignal을 사용한다. 서버 오류 메시지를 그대로 UI에 노출하지 않고 status/code를 구분한다. 요청 전·응답·JSON 해석 후 취소를 확인한다.
- `live-source.ts`: 실제 API capability를 제공한다. 예시 loadMatch/submit으로 fallback하면 명시적으로 실패한다. `source.ts`의 기존 cursor source와 `/worldcup?scenario=`는 검토용이다.
- `use-live-worldcup.ts`: 세션별 게임 snapshot, 일반/권역 scope, 제출 잠금, 불확실한 응답 복구, 피드백/다음 판 타이머, 날짜 경계를 소유한다. `use-worldcup.ts`는 실제 source면 이 hook을 선택하고 예시 흐름도 유지한다.
- `use-live-data.ts`, `live-data.tsx`: 진행·타임라인 읽기, scope별 취소, 오류·빈 목록·재시도, 실제 권역 상세 조회를 담당한다. 페이지 성공 revision·재진입·1분 주기·window focus에서 재조회한다. 전체 선택5건 미만이면 타임라인 영역을 숨긴다.
- `worldcup-dialog.tsx`: 기존 native dialog·Button·CloseButton·토큰·집/왕관 자산을 재사용한다. 실제 카드에 대표 거래·계약일을 표시하고 예시 역·소개는 표시하지 않는다.
- `ExplorationPage`: 모달 진입 scope·페이지 My Picks·읽기 refresh revision을 소유한다. 실제 지도 메뉴/권역 상세를 활성화하고 실제 source에는 예시 본인 타임라인을 추가하지 않는다.

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

첫 설명 키 `geupjido.worldcup.intro.v1`는 익명 쿠키와 별개다. dialog.showModal·배경 inert·정/역 Tab 순환·IME Escape 보호·body overflow 복원·원래 trigger 또는 지도 메뉴 focus 복귀를 유지한다. 비동기 상태가 바뀌어도 유효한 닫기 focus를 빼앗지 않는다. 공개 비율1.1초/비공개·복구·reduced motion0.6초와 별도2.4초 피드백 타이머를 유지한다. 데스크톱은600px 창, 모바일768px 미만은 전체화면과 세로 대진이며 짧은 화면은 내부 스크롤·sticky 닫기를 사용한다. 모바일 타임라인은 미제공이다.

## 배포·쿠키

[고정 OpenAPI](api/INDEX.md)와 BE main `2e4aab80`의 [게임](https://github.com/sugkamoney/geupjido-backend/blob/main/docs/architecture/worldcup-game-api.md), [카드](https://github.com/sugkamoney/geupjido-backend/blob/main/docs/architecture/worldcup-card-api-contract.md), [권역](https://github.com/sugkamoney/geupjido-backend/blob/main/docs/architecture/worldcup-zone-selection-api.md), [타임라인](https://github.com/sugkamoney/geupjido-backend/blob/main/docs/architecture/worldcup-timeline-api.md), [배포 인계](https://github.com/sugkamoney/geupjido-backend/blob/main/docs/architecture/dev-api-frontend-handoff.md)를 대조했다. BE를 수정하지 않았다.

프론트는 동일 출처 상대 `/api`를 사용한다. 로컬 Vite는 기존 MAP_API_PROXY_TARGET으로 대상을 선택하며 운영도 같은 origin 경로를 전달해야 한다. gjd_uid는 HttpOnly·Secure·SameSite=Lax라 JS로 읽거나 localStorage에 저장하지 않는다. 개발 API 절대 주소를 브라우저에서 직접 호출하는 교차 사이트 방식으로 바꾸지 않는다. Safari 실연동은 신뢰할 수 있는 HTTPS 프론트 또는 HTTPS 동일 사이트 배포에서 검증해야 한다.

## 검증 기록

Node24.15.0·pnpm11.13.0을 사용했다. 실행 명령은 `npx --yes --package=node@24.15.0 --package=pnpm@11.13.0 -- <명령>`이다. 최종 결과는 다음과 같다. 이번 실행 환경은 macOS이며 Linux WebKit 검증을 대체하지 않는다.

| 검사 | 기대 | 현재 결과 |
|---|---|---|
| 시작 baseline `pnpm test` | 기존 단위 회귀 |236개 통과 |
| API·상태·읽기 테스트 | 계약·409·응답 유실·시작 유실·날짜·scope·타임라인 stale | 20개 추가 단위 테스트 포함 전체256개 통과. 두 일반 자정 경계와 필터 scroll 회귀는 실패→성공 확인, 권역 게임은 자정 뒤에도 유지 확인 |
| `pnpm check` | 토큰·타입·lint·format·단위·운영 build | 단위256개(29파일)·전체 품질 gate·운영 빌드 통과 |
| 실제 월드컵 경로 E2E | desktop Chromium/mobile Chromium·WebKit | 전체151개 통과·38개 플랫폼 조건 제외·실패0. 신규 실제 월드컵/쿠키는20개 통과·4개 모바일 타임라인 제외 |
| 격리 HTTPS cookie E2E | Secure/HttpOnly/SameSite·PUT 쿠키·새로고침 이어하기 | 세 브라우저 통과 |
| 공유 개발 API GET | progress·zones·timeline 배포 응답 |2026-11-20 progress·zones·timeline 조회, 쿠키 없는 진행0. current는404 GAME_NOT_FOUND·Set-Cookie 없음. 배포 월드컵 경로는 고정 OpenAPI와 동일 |
| 실제 개발 서버 POST/PUT | 실제 DB 저장 |미실행: 격리 BE/DB 미제공, 공유 DB에 가상 표를 기록하지 않음 |
| 실기기 iOS/Android·VoiceOver·IME/주소창/회전 | 물리 기기 조합 |장치 없음, 자동화의 WebKit/Pixel 모사는 실기기 검증이 아님 |

쿠키 검증은 `e2e/helpers/worldcup-server.ts`의 루프백 전용 HTTPS 서버에서 실제 Set-Cookie·HTTP 요청으로 수행한다. 자체 서명 인증서를 만들고 테스트 context에서 인증서 오류만 허용한다. 브라우저 쿠키를 수동 주입하지 않으며 공유 API·DB로 연결하지 않는다. 테스트 종료 시 서버와 임시 인증서를 정리한다. Spring 서비스·실제 배포 CORS·공인 인증서의 종합 검증은 아니다.

초기 route.fulfill 기반 쿠키 검사는 WebKit에서 Set-Cookie가 전달되지 않아 실패했고, 이를 실제 HTTPS transport 검사로 분리했다. 초기 데스크톱 테스트는 패널 열기를 누락해 실패했으며 실제 메뉴 진입 절차로 고쳤다. 타임아웃을 늘리거나 실패를 무시하지 않았다. 내장 브라우저는 iab 연결 불가로 프로젝트 Playwright와 캡처를 사용했다. 모바일·데스크톱 실제 API 카드 캡처에서 대표 거래·계약일, 기존 자산·버튼·대진 배치를 확인했다.

PR10은 최종 재확인(2026-11-20)에도 OPEN이다. 부모의 ResizeObserver 스크롤 수정은 이 기준 develop에 없고 임의 병합·중복 수정하지 않았다. macOS의 기존 수동 목록 스크롤 회귀는 세 엔진에서 통과했으며 Linux WebKit의 알려진 지연 최초 ResizeObserver 이슈가 해결됐다고 주장하지 않는다. 이 child에서는 Linux를 실행하지 않았다. PR10 병합 후 정상 develop 통합·Linux 전체회귀가 남는다.

`requesting-code-review` 스킬의 읽기 전용 독립 리뷰에서 재시도 current GET 중 자정 변경 누락1건을 확인해 실패 회귀와 수정으로 해소했다. 재리뷰에서 추가 Critical/Important는 없었다. 다음 세트 E2E도 literal 판번호 `[10,1,2,3,4,5,6,7,8,9,10]`으로 강화했다. 타임라인은 칩 전환 시 scroll0, 다른 권역의 지연 조회 중/완료 뒤 scroll200 유지 회귀를 통과했다.

전체 E2E 뒤 지도 테스트의 미지정 타임라인 GET을 명시적으로 격리했다. 변경한 지도 API E2E15건은 세 엔진에서 재검사해 모두 통과했으며 전체 결과와 구분한다. 최초 전체 실행의 proxy ECONNREFUSED는 이 미지정 읽기 요청이 원인이었고 제품 성공을 만든 것은 아니다. 타임아웃·재시도·플랫폼 제외 정책은 변경하지 않았다.

최종 `pnpm check`, `pnpm test:e2e --workers=2`와 `git diff --check`를 사용한다. 제외38건은 기존34건과 새 데스크톱 전용 타임라인2종의 모바일4건이다. 물리 기기·실제 NAVER SDK와 새 월드컵 쓰기의 결합, 실제 배포 CORS·DB 저장·Linux는 미검증이다.

## 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
|0.1|2026-10-15|검토용 source·모달·My Picks·타임라인 구현 |
|0.2|2026-10-27|유효한 focus 보존 |
|1.0|2026-11-20|실제 게임·권역 대안·진행·타임라인·쿠키·경합·날짜 계약과 현재 검증으로 갱신 |

## PR 제출

2026-11-20 후속 요청에 따라 현재 기능 브랜치를 커밋·push하고 develop 대상 PR로 제출한다. 최신 origin/develop은 시작 기준과 같고 PR10은 OPEN이어서 부모의 스크롤 수정 커밋은 포함하지 않는다. 게시 전 pnpm check와 diff를 재확인한다.
