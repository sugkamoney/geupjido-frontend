# 검색 작업 인수인계

> 날짜: 2026-10-14 · 상태: 새 Codex 세션에 구현 작업 전달

## 작업 환경과 의존성

사용자가 지도 탐색 완료 후 검색 작업 착수를 요청했다. PR #4는 확인 시 OPEN이고
최신 CI는 성공했다. 검색은 지도 선택·상세 흐름에 의존하므로
`origin/feature/map-exploration`의 `63c0c74`에서 `feature/search`를 분기했다.
지도 workspace는 PR 검토를 위해 유지한다.

새 Orca workspace는 `/Users/user/orca/workspaces/geupjido-frontend/feature-search`이며
사용자 지시에 따라 현재 workspace(`/Users/user/Desktop/personal/geupjido-frontend`)의
하위 항목으로 연결한다. Git 브랜치는 `feature/map-exploration`에 stack한다.
`codex --yolo` 세션에 구현을 전달한다. 이 분기는 지도 브랜치의 원격 upstream을
추적하지 않는다. 향후 PR 전에 PR #4 병합과 develop 반영 상태를 확인해 기준을
정리한다. 지도 PR이 OPEN이면 검색 PR의 base는 `feature/map-exploration`이며,
병합 뒤에는 `develop` 반영 상태를 확인한다. 미병합 지도 변경을 검색 PR에 중복 포함하지 않는다.

## 구현 범위

Downloads의 `05-search.md`와 Figma 검색 화면을 기준으로 검색 SDD를 시작한다.
권역·구·단지 부분 일치, 공백 제거·대소문자 무시, 그룹별 개수 제한(5/3/6),
일치 위치·이름 길이 정렬, 결과 없음과 매칭 글자 강조를 구현한다.
한글 조합 중에도 입력 검색을 갱신하되 Enter의 IME 확정과 결과 선택을 구분한다.
방향키 순환, Enter 선택, Escape의 단계별 닫기·focus 처리를 구성한다.

선택하면 결과를 닫고 이름을 입력에 반영한다. 권역은 권역 선택·상세, 구는 fit,
단지는 상세·목록 선택과 중심 이동 및 zoom max(현재,15)로 연결한다.
기존 지도 selection·motion·pointerup·frame centering을 재사용한다.

제품 검색 API 부재 시 명시적인 검색 source/mock으로 구현하고 viewport 밖 대상도
찾을 수 있는 데이터 경계를 둔다. 현재 지도 화면의 결과만 전체 검색 데이터로
취급하지 않는다. 실제 서비스 데이터나 백엔드 생성 계약으로 오인시키지 않는다.
월드컵·실제 투표 집계는 이번 범위가 아니다.

## 자료와 완료 기준

생김새는 [Figma Screens](https://www.figma.com/design/VB4hekcKLXEAyuFPu4zhVU?node-id=82-5),
동작은 MD를 따른다. 모바일 검색은 기존 AppShell 전체 화면 편집 흐름을 재사용한다.
모바일 HTML은 참고 시안이며 미정 지원 정책을 자동 확정하지 않는다.

[지도 인수인계](map-exploration-handoff.md), [지도 구조](map-exploration.md),
[AppShell](app-shell.md), [디자인 시스템](design-system.md)을 먼저 읽는다.
검색 SDD 필수 문서 4개·버전·변경 이력, architecture와 INDEX·현황을 갱신한다.
frozen baseline·의미 있는 상호작용 테스트·데스크톱/모바일 시각 대조를 수행한다.
`pnpm check`와 브라우저 검사는 dist 빌드 경합을 막기 위해 순차 실행한다.
PR 규칙에 따라 AI 코드 작업, 기대/실제·미실행 이유와 모바일 제약을 기록한다.
구현·검증 후 한국어 규칙으로 커밋하고 결과를 보고한다. 이번 전달은 push·PR·merge
요청을 포함하지 않는다.
