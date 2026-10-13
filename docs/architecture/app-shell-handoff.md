# 앱 화면 틀 작업 인수인계

> 날짜: 2026-10-13 · 상태: 새 Codex 세션에 구현 작업 전달

## 환경과 이전 작업

디자인 시스템 PR #2는 `develop`의 `2c3a1f4`에 병합됐다. 이 커밋에서
`feature/app-shell`을 만들고 Orca workspace
`/Users/user/orca/workspaces/geupjido-frontend/feature-app-shell`을 생성했다.
구현은 workspace의 `codex --yolo` 세션에 전달한다. 통합 기준은 `develop`이다.

기존 디자인 시스템 workspace는 미커밋 변경이 없고 커밋이 develop에 포함된 것을
확인한 뒤 사용자 요청에 따라 Orca의 worktree 제거 기능으로 정리했다.

## 다음 구현 범위

디자인 시스템 토큰·공통 컴포넌트를 재사용해 앱 화면 틀을 조합한다.
데스크톱의 레일, 왼쪽 패널과 접기/복원, 권역 상세 슬롯, 검색 줄, 구/권역 전환,
지도 조작 영역과 겹침·스크롤·패널 상태별 배치를 우선 검토한다.
모바일은 참고 시안의 하단 탭·아래 시트·작은 화면 검색 배치를 검토하고
기능 데이터와 화면 틀의 경계를 유지한다.

실제 지도 SDK·검색 데이터/API·월드컵 투표/대진/집계는 후속 범위다.
지도는 이후 어댑터가 들어갈 슬롯으로 두며, 임시 fixture나 mock을 실제 데이터로
표시하지 않는다. 미정 레일 메뉴 노출·좁은 데스크톱·모바일 세부 정책은 확인하고
현재 적용하는 가정과 한계를 명시한다.

## 기준 자료와 검증

- [디자인 시스템](design-system.md)의 사용법·CSS 레이어·자산·접근성 제약을 유지한다.
- 생김새는 [Figma Screens](https://www.figma.com/design/VB4hekcKLXEAyuFPu4zhVU?node-id=82-5),
  동작은 Downloads 핸드오프의 `00-README.md`, `02-layout.md`, `08-mobile.md`를 우선 확인한다.
- 모바일도 정식 지원 범위지만 HTML은 참고용이다. 320px 스트레스 테스트나
  카탈로그 breakpoint를 정식 지원 정책으로 확정하지 않는다.
- 기능 SDD 시작 시 `docs/product/specs/app-shell/`에 필수 문서 4개를 작성하고
  버전·변경 이력 및 제품/기술 경계를 지킨다. 이 폴더는 구현 세션에서 시작한다.
- frozen 설치·baseline, `pnpm check`, 필요한 데스크톱·모바일 브라우저 검증과
  Figma 대조를 수행하고 문서·INDEX·현황을 갱신한다.
- 커밋은 프로젝트 규칙에 맞춰 작성한다. PR 작성 단계에는 기존 템플릿과
  [PR 작성 규칙](pull-request-convention.md)을 사용한다. 이 전달 단계에서 feature
  push·PR·merge를 자동 수행하도록 요청하지 않았다.
