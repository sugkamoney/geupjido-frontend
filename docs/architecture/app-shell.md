# 앱 화면 틀 구조와 구현 계획

> 상태: 구현·검증 완료 · 버전: 0.3 · 갱신: 2026-10-13

제품 기준은 [앱 화면 틀 SDD](../product/specs/app-shell/README.md)다.
이번 작업은 기존 Orca linked worktree `feature/app-shell`에서 실행한다.
사용자가 구현·검증·커밋까지 요청한 범위를 이어 진행한다.

## 구조와 상태 경계

React/TS strict·Router·Vite와 기존 공통 UI/semantic 토큰을 유지한다.
`AppShell`은 데이터와 무관한 nav·panel·detail·search·map slot의 배치만 조합한다.
호출자는 선택 상세와 검색 문자열/결과 콘텐츠를 공급한다. 상세 summary·expandedSummary·
actions를 분리해 모바일 접힘 상태에서 단계 콘텐츠를 숨기고 요약/비교 버튼을 유지한다. 화면 틀은 패널 열림,
구/권역 표시 요청, 모바일 검색 편집과 시트 펼침 상태를 관리한다.
지도 slot에는 측정한 가려지지 않은 사각형과 표시 단위를 전달한다. 패널/시트·검색
콘텐츠·조작 버튼을 제외한 보수적인 사각형이며 전체 노출 영역의 polygon은 아니다.
화면이 너무 좁아 공간이 없으면 width/height가 0일 수 있다. 실제 이동과 zoom은 하지 않는다.
지도 어댑터는 후속에서 실제 이동·zoom 및 선택 연결을 맡는다.
`MapCommand` 콜백이 없으면 확대·축소·전체 보기는 비활성이다.

`/`은 데이터 미연결 홈, `/app-shell`은 별도 fixture 검토 경로다.
검토용 콘텐츠는 `shell-preview.tsx`에만 있고 실제 데이터·API 계약이 아니다.
급지/단계 임계값·숫자·순위·가격·투표 비율을 fixture로 확정하지 않는다.
NAVER SDK, 네트워크 API, 검색 결과 알고리즘, 월드컵 모달은 추가하지 않는다.

## 파일 경계

- `types.ts`: ShellDetail/ShellSearch/AppShellProps, DisplayLevel/MapCommand/MapFrame 슬롯 계약.

- `src/components/app-shell/app-shell.tsx`: 슬롯 API와 레이아웃 조합, focus 이동.
- `shell-navigation.tsx`, `shell-panels.tsx`, `shell-search.tsx`: nav/패널/편집 영역.
- `use-shell-layout.ts`: responsive 감지·지도 여백 측정·가상 키보드 viewport 반영.
- `app-shell.css`: components 레이어 스타일, 크기·겹침·목록 overflow.
- `src/app/shell-page.tsx`, `shell-preview.tsx`: 홈/검토 fixture 컨테이너.
- `app-shell.test.tsx`, `e2e/app-shell.spec.ts`: 상태·focus·실제 배치 검증.

## 검토용 responsive 구현값

768px 미만에서 하단 nav/시트/전체 검색을 사용한다. 최소 지원 폭이 아니다.
1920 기준 폭과 상세 x 좌표는 핸드오프를 따른다. 좁은 desktop에서도 레일·패널·상세
폭을 우선 유지하되 검색 줄은 남는 폭에 맞추고 전환을 아래로 감을 수 있다.
자동 패널 접기는 추가하지 않는다. 768~1100에서는 상세가 있는 검색 줄을 상세 안으로
이동해 지도와 닫기 버튼 접근을 유지한다. 이는 다음 디자인 리뷰에서 확정할 임시안이다.
짧은 화면에서는 고정 요약을 제한하고 그 영역의 세로 스크롤을 허용해 닫기를 유지한다.
모바일 시트는 접힘 min(42%,340px), 펼침은 화면 높이에서 190px와 safe area를 뺀 값이다.
짧은 화면은 별도 높이를 사용한다. 모바일 펼침 요약은 본문 높이의 55%까지 사용하고
넘는 콘텐츠만 요약 내부에서 스크롤한다. 390×844 검토 크기에서는 카드·단계·비교 버튼이 모두 보인다. WebKit 기기 preset의
664px 높이와 더 짧은 화면에서는 요약 내부 scroll로 나머지 콘텐츠에 접근한다.
`100dvh`, safe area와 visualViewport resize를 사용한다. 실제 iOS 키보드 검증은 별도다.

z-index는 map 0 / map overlay 10 / search·control 20 / panel 30 /
search results 40 / modal 50. nav는 panel과 같은 층, 모바일 검색은 모달층이다.
목록은 min-height:0·overflow:auto·overscroll-behavior:contain으로 부모 scroll과 구분한다.
공통 UI CSS는 재작성하지 않고 global에서 새 CSS도 layer(components)로 가져온다.

## 실행 계획

> 실행 방식: 이 세션에서 직접 구현(executing-plans). 제품 문서/기술 계획을 먼저 기록하고 사용자 승인 범위에 따라 계속 진행한다.

### Task 1: 상태와 슬롯

- [x] `app-shell.test.tsx`에 패널 복원, 구 전환/선택 해제, 상세 focus 복귀와 검색 유지 테스트 작성.
- [x] `pnpm test -- app-shell`을 실행해 실제 미구현 실패를 확인.
- [x] AppShellProps(상세/검색/지도 callback), AppShell, nav/패널/검색 조합 구현.
- [x] 같은 테스트를 다시 실행해 통과 확인.

### Task 2: responsive와 fixture

Task 1의 상세/검색/지도 slot을 소비해 `/`와 `/app-shell`을 구성한다.

- [x] 브라우저에 1920 좌표/패널 조합, 1280/1440·320 긴 문구, 목록 scroll·touch·keyboard 테스트 작성.
- [x] `pnpm test:e2e e2e/app-shell.spec.ts`로 실패 확인.
- [x] 레이어 CSS·viewport 측정·아래 시트 드래그와 전체 검색 focus 준비.
- [x] 데스크톱 Chromium·모바일 Chromium/WebKit에서 통과 확인.

### Task 3: 검증과 기록

- [x] Figma 레일/시작 구역/상세 머리/Level Toggle context 확인, 레일/설명 그림 원본 자산과 출처 기록.
- [x] `pnpm check` 및 전체 브라우저 검사와 원본 시각 대조.
- [x] 독립 코드 리뷰, 발견 사항 수정·필요한 실패→성공 검증.
- [x] SDD/INDEX/통합 현황과 검사 기대·실제/미실행 사유 갱신 후 한국어 커밋.

## 리뷰 초점

숨은 패널의 focus, 상세 닫기의 focus 대상 제거, breakpoint 전환 중 숨은 focus,
긴 글자/짧은 높이에서 헤더 접근, 시트 드래그와 목록 터치 스크롤 구분을 확인한다.

## baseline

frozen 설치 통과. 기존 `pnpm check`(RTL 8개·토큰/타입/lint/format/build)와
기존 브라우저 18개 통과. 4173 포트가 비어 있음을 확인해 Playwright가 사용했다.
내장 브라우저는 연결 초기화에서 sandbox metadata 환경 오류로 사용할 수 없었다.
프로젝트 Playwright로 배치·브라우저 검증을 수행한다.

## 실행 결과와 시각 대조

코드 작성·수정은 100% AI로 수행했다. `feature/app-shell`에 커밋하며
통합 대상은 develop이다. 최초 구현 요청은 커밋까지였고, 이후 사용자 요청으로 feature push와 PR #3 생성을 진행했다.
merge는 요청하지 않았다.
후속 PR은 `.github/pull_request_template.md`와 [PR 규칙](pull-request-convention.md)을 적용한다.

| 검사 | 기대 | 실제 결과 |
|---|---|---|
| `pnpm install --frozen-lockfile` | 잠금 파일 변경 없이 설치 | 통과, package/lockfile 변경 없음 |
| `pnpm check` | 토큰 생성 일치·타입·lint·format·RTL·build 통과 | 통과, RTL 15개(기존 8 + 화면 틀/포인터 7), 운영 빌드 성공 |
| `pnpm test:e2e --workers=3` | 기존 UI 회귀와 화면 틀 브라우저 시나리오 통과 | 40개 통과, 14개 플랫폼 적용 제외, 실패 0 |
| 1920 패널 조합 | 64/390/360/340 폭·상세/검색 좌표 | 패널 접기·상세 닫기/구 전환 후 좌표까지 통과 |
| 패널 scroll·focus | 헤더 고정·목록 독립·숨은 콘텐츠 탐색 제외 | 휠/End 키, 패널 복원, 상세 origin 복귀 통과 |
| 반응형/긴 글자 | 1440/1280/800/320 및 667×375에서 가로 넘침 없음 | 닫기 버튼 bounds와 focus 복귀·200% 글자 확대 시뮬레이션 통과 |
| 모바일 검색 | 진입/지우기/닫기/Escape·IME·Tab 순환·짧은 높이 | Chromium/WebKit 통과, 390×460 전체 편집 영역과 44px 입력 줄 확인 |
| 모바일 상세 | 접힘 카드/버튼, 펼침 단계/목록, 터치/키보드 | 탭·Enter 및 Chromium의 실제 touch 이벤트 stream으로 드래그/목록 scroll 통과 |
| 지도 frame | 검색/결과/패널/조작에 가리지 않는 slot 경계 | 좁은 desktop 재배치와 search/control 영역 제외 회귀 통과 |
| 로컬 자산 | 표시 이미지 로드 | 로고·설명 이미지·공통 아이콘 naturalWidth 확인, nav mask와 원본을 시각 대조 |

14건 제외: desktop 전용 좌표/resize/frame 검사는 모바일 project에서 제외하고,
전체 검색 검사는 desktop에서 제외했다. 터치 드래그 stream은 CDP를 지원하는
모바일 Chromium에서 실행했다. WebKit은 tap·키보드·목록 End 검사를 실행했으며
물리적 터치 swipe 검증을 대신하지 않는다. 브라우저 구성은 desktop Chromium,
Pixel 7 Chromium, iPhone 13 WebKit이다. Chrome/Edge/Safari 실제 최신 안정 버전과
물리 기기·VoiceOver·운영 배포·실제 NAVER/API·최초 구현 단계의 GitHub CI는 미실행이었다. 이후 PR #3에서 발생한 실패는 아래 보완 기록을 따른다.
각각 실제 환경 또는 후속 기능/PR 범위가 필요하기 때문이다.

Figma 메인 `594:21211`을 캡처하고 레일 `594:21246`, 시작 `594:21260`,
상세 머리 `594:21300`, 구/권역 `594:21334`의 고해상도 context를 읽었다.
1920 렌더의 레일·메뉴·시작 그림·패널 손잡이·상세 머리·검색/전환을 원본과 대조했다.
원본 지도·급지·순위·검색 결과는 기능 범위 밖이므로 모사하지 않았다.
fixture 요약/목록은 회색의 별도 표시이며 전체 화면 pixel 일치를 주장하지 않는다.
모바일은 Figma 화면이 없는 참고 HTML/MD 방향을 검토해 WebKit 캡처와 대조했다.
390×844는 비교 크기이며 최소 지원값이 아니다. WebKit preset 390×664와 짧은 높이에서는
요약 overflow를 허용한다. 가상 키보드는 visualViewport와 높이 축소로 준비했으며
실제 iOS/Android 키보드와 주소창·회전 조합은 후속 실기기 검사다.

## 실패에서 수정한 항목과 리뷰

처음 단위 검사는 미구현 모듈 import 실패를 확인했다. 브라우저 실행 초기에는
TS 검사에서 테스트 API의 `exact` 옵션 불일치와 미사용 변수/DOM iterable 오류를 수정했다.
모든 최종 검사는 이 실행 오류를 해결한 후 실제 운영 빌드에 대해 수행했다.

상세 focus 복귀는 pointer capture와 focus capture를 함께 기록한다. WebKit 버튼 클릭은
native focus를 보장하지 않으며, 과거 pointer origin만 쓰면 나중의 keyboard trigger를
놓친다. breakpoint가 CSS를 먼저 숨겨 BODY로 focus를 옮길 수 있어 마지막 focus 요소를
기록하고 남아 있는 nav/상세 닫기/검색 input으로 복구한다.

시트 손잡이의 touch-action:none이 공통 button 규칙에 밀려 pointercancel이 발생한 것을
실제 이벤트 stream으로 확인하고 손잡이 선택자를 보완했다. 터치·펜의 드래그/탭은 pointerup에서 한 번 처리하고 후속 호환 click은 무시한다.
마우스·키보드 click은 유지한다. Linux CI에서 호환 click이 생략되는 경우까지 보완했다. 검색 전체 화면의 inset 우선순위와 입력 줄 flex도
캡처에서 발견하고 실패 테스트 후 수정했다.

`requesting-code-review` 스킬에 따른 독립 읽기 전용 리뷰를 수행했다.
키보드 상세 origin, 양방향 breakpoint focus, 좁은 desktop 검색의 지도 frame 계산을
Important로 확인해 모두 회귀 테스트 실패→성공으로 수정했다. control/result frame 누락은
slot 계약과 관련되므로 Minor 제안도 Important로 재분류해 같은 수정 패스에서 해결했다.
남은 코드 리뷰 결함은 없으며 실제 환경 검증과 미정 제품 정책은 아래 경계에 남는다.

리뷰에서 판단을 유보한 범위는 정확한 Figma 생김새, 최종 모바일 지원 정책, 실제
SDK/API/검색 결과/월드컵/지표, 랭킹·리포트 운영 노출, 색상 대비 준수,
실기기 키보드/VoiceOver/gesture와 운영 배포·브라우저 버전 보장이다.
생김새는 위 원본 대조로 확인했고 나머지는 사용자 지정 범위 또는 승인 미정 정책에
따라 후속에 남겼다. 색상 변경 없이 WCAG 대비 준수를 주장하지 않는다.

검토 서버: `http://127.0.0.1:5174/app-shell` (시작 전 빈 포트 확인).
테스트 preview는 4173을 사용하고 실행 후 종료한다. 서버 포트는 제품 정책이 아니다.

## PR #3 CI 보완

최초 CI [38356143404](https://github.com/sugkamoney/geupjido-frontend/actions/runs/38356143404)는
품질 검사를 통과한 뒤 터치 드래그→탭 접기 시나리오 1개가 실패했다(39 통과/14 제외).
macOS에서는 CI 옵션으로 5회 통과했지만 같은 Playwright 1.64.0의 Ubuntu arm64 컨테이너에서
운영 빌드로 10회 모두 재현했다. 실제 입력 로그에서 다음 탭의 pointerdown/up은 발생하고
click은 발생하지 않았다. 탭 처리를 합성 click에 맡긴 구현이 원인이다.

터치/펜은 pointerup에서 이동량에 따라 드래그 또는 탭을 처리하고, 호환 click을 무시해
중복 처리를 막는다. detail=0 활성화와 마우스 click은 유지한다. 클릭이 없는 탭/후속 클릭/
키보드 활성화를 검증하는 회귀 2개를 먼저 실패시키고 수정 후 통과시켰다.
수정 후 Linux 같은 재현은 10회 모두 통과했다. 테스트 제외·재시도·대기 시간은 늘리지 않았다.
컨테이너는 GitHub amd64 runner의 대체가 아니며 원격 결과는
[PR #3 checks](https://github.com/sugkamoney/geupjido-frontend/pull/3/checks)에서 별도로 확인한다.
설명은 [QA-FE-005](../learning/frontend/q-and-a/QA-FE-005-touch-release-ci.md)에 보존한다.

## 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| 0.1 | 2026-10-13 | 상태/슬롯/반응형 기술 경계와 구현 계획, baseline 기록 |
| 0.2 | 2026-10-13 | 화면 틀 구현·독립 리뷰 보완·브라우저/시각 검증 결과와 후속 제한 기록 |
| 0.3 | 2026-10-13 | PR #3 Linux 터치 CI 실패를 재현하고 pointerup 처리·회귀 2개 추가 |
