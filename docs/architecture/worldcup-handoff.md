# 월드컵 작업 인수인계

> 날짜: 2026-10-15 · 상태: feature/worldcup 검토 UI 구현·검증 완료, 최종 결과는 worldcup.md 참조

## 환경

검색 PR #5가 develop `49f9e5b`에 병합된 것을 확인하고 이 커밋에서
`feature/worldcup`을 분기했다. 새 Orca workspace는
`/Users/user/orca/workspaces/geupjido-frontend/feature-worldcup`이며 현재 상위
workspace(`/Users/user/Desktop/personal/geupjido-frontend`)의 하위 항목이다.
`codex --yolo` 세션에 구현을 전달하고 통합 대상은 develop으로 유지한다.
검색 workspace는 미커밋 변경이 없고 develop에 포함된 것을 확인한 뒤 제거했다.

## 범위와 자료

다음 작업은 월드컵 설명·권역/단지 대진·선택/넘김·내 선택 누적 판과 타임라인 UI다.
Downloads의 `00-README`, `06-worldcup`, `07-timeline-panel`, `08-mobile`, `09-open`을
읽고 Figma와 대조해 `docs/product/specs/worldcup/`의 SDD 필수 문서 4개를 시작한다.
생김새는 [Figma Screens](https://www.figma.com/design/VB4hekcKLXEAyuFPu4zhVU?node-id=82-5),
동작·시간·문구는 MD를 따른다. HTML의 20개 완성 화면·지도 보기·옛 온보딩은
이번 범위가 아니다. 원본 기준과 미정값을 구분한다.

기존 디자인 시스템·AppShell·지도/검색 상태를 재사용한다. 데스크톱 타임라인
시작 버튼과 권역 상세의 해당 권역 단지 비교, 모바일의 직접 월드컵 진입을 연결한다.
선택 전 급지 숨김, 선택/넘김 후 표시, 비율 유무와 reduced motion에 따른 진행,
넘김 제외 누적·20개 이후 계속 증가·완성 화면 없음, 타임라인 필터/스크롤과
권역 상세 연결을 검증한다. 모바일도 지원하며 HTML은 참고 시안이다.

## 미정 정책과 API 경계

로그인·익명 식별, 중복 투표·넘김 산정, 실제 대진 생성(6:4 포함), 비율 공개
임계값·사람/표의 단위, 지도 급지 갱신 주기와 타임라인 숨김 기준은 기획 미정이다.
UI 검증을 위한 시나리오와 실제 집계 정책을 구분하며 10명·40/80회 같은 가정값을
운영 규칙으로 확정하지 않는다. 실제 API는 BE 최신 구현을 읽기 전용으로 확인한다.
준비되지 않았다면 교체형 source와 명시적인 fixture/mock으로 UI를 완성한다.
가짜 사용자 투표를 실제 타인의 활동·실제 급지 반영으로 주장하지 않는다.
backend 생성 OpenAPI 없이 수기 UI 타입을 확정 서버 계약으로 취급하지 않는다.

## 검증과 인수인계

frozen 설치·기존 baseline 이후 의미 있는 상태 전환·중복 입력·실패/재시도·응답 경합,
모달 focus trap/복귀·배경 비활성/스크롤 잠금, 타이머 정리·닫기/재진입, 타임라인
선택·필터, 모바일 touch/짧은 화면·키보드·reduced motion을 검증한다.
`pnpm check`와 브라우저 검사는 dist 경합을 막기 위해 순차 실행한다.
기존 지도·검색 회귀를 유지하고 데스크톱/모바일을 Figma·참고 자료와 대조한다.

제품 SDD와 기술 문서·INDEX·현황에 실제 범위·정책 가정·검사 기대/실제·미실행
이유·모바일 제약을 기록한다. 코드 작성·수정은 100% AI로 진행하고 한국어 규칙으로
커밋한 뒤 보고한다. 이번 착수 전달은 feature push·PR·merge를 포함하지 않는다.
후속 PR에는 기본 템플릿과 [PR 규칙](pull-request-convention.md)을 적용한다.

## 현재 작업 연결

[월드컵 구조·검증 기록](worldcup.md)과 [제품 SDD](../product/specs/worldcup/README.md)가 이번 세션의 현재 기준이다. 초기화·디자인 시스템·화면 틀·지도·검색은 develop에 통합됐고 이 문서의 착수 문구는 당시 전달 기록이다. 실제 NAVER·제품 API/집계 정책은 여전히 미연결·미확정이다.
