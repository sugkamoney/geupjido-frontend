# 디자인 시스템 작업 인수인계

> 날짜: 2026-10-13 · 상태: 당시 전달 기록 · 현재 PR #2 develop 병합 완료

## 작업 환경

초기화 PR #1이 병합된 `origin/main`의 `8910f8b`에서 `develop`을 생성하고
`origin/develop`으로 push했다. `feature/design-system`은 이 `develop`에서 분기했다.
후속 PR의 대상은 `develop`이다.

당시 Orca workspace는 `/Users/user/orca/workspaces/geupjido-frontend/feature-design-system`이다.
당시 이 workspace에 `codex --yolo` 터미널을 생성해 아래 범위를 전달했다.
현재 디자인 시스템 PR #2는 develop `2c3a1f4`에 병합됐고 해당 workspace는 사용자 요청으로 제거했다.
초기화 workspace와 개발 서버는 기존 환경으로 남아 있다.

## 전달 범위

Figma Foundations·Components를 기준으로 디자인 토큰과 재사용 가능한 공통
컴포넌트 기반을 구축한다. React·TypeScript·Vite·Tailwind 초기화 구조를 활용한다.
실제 화면에서 필요한 컴포넌트와 variant를 먼저 확인하고 구현 순서를 문서화한다.
색, 타이포그래피, spacing, radius, size, shadow와 아이콘/이미지 자산을 확인한다.
화면 스타일은 semantic token을 사용하고 Figma 변수·스타일 이름과 대응을 유지한다.

이 작업은 지도·검색·월드컵의 제품 화면과 BE 연동 구현을 포함하지 않는다.
미정 급지·투표 정책을 확정값으로 구현하지 않는다. 모바일 웹은 정식 지원 범위지만
모바일 HTML은 참고 시안이므로 공통 컴포넌트의 터치·키보드 조작과 작은 화면
적응성을 준비하고 모바일 전용 레이아웃의 미정 사항은 기록한다.

## 자료와 우선순위

- 시각 기준: [Figma Foundations](https://www.figma.com/design/VB4hekcKLXEAyuFPu4zhVU?node-id=81-3),
  [Components](https://www.figma.com/design/VB4hekcKLXEAyuFPu4zhVU?node-id=82-4).
- 사용 예: [Screens](https://www.figma.com/design/VB4hekcKLXEAyuFPu4zhVU?node-id=82-5).
- 동작·조건·시간·문구: Downloads의 `민심급지도-md-전체` 내부 `00-README.md`부터 읽는다.
- Desktop UI + 브랜드 시트 HTML은 확정 참고 시안이다. 모바일·월드컵 선택판 HTML은 참고용이다.
- Figma와 HTML/MD의 생김새가 다르면 Figma가 우선이다.
- 저장소 맥락: [디자인 핸드오프 기준](../product/design-handoff.md),
  [플랫폼 지원](../product/platform-support.md), [프로젝트 초기화](project-initialization.md),
  [BE·디자인 준비 점검](2026-10-13-implementation-readiness.md).

## 완료 기준

의존성 frozen 설치로 시작해 baseline을 확인한다. 구현한 컴포넌트의 의미 있는
상호작용·접근성·variant 동작을 테스트하고 Figma와 시각적으로 대조한다.
`pnpm check`와 해당 범위의 브라우저 테스트를 통과해야 한다. API나 NAVER 키 없이
검증할 수 있어야 한다. docs의 구조·범위·사용 방법·모바일 제한과 INDEX를 갱신한다.
사용자의 커밋 규칙을 따르고 변경을 검토 가능한 상태로 정리한다.

당시 전달은 push·PR·merge 요청이 아니었다. 이후 PR #2의 develop 병합까지 완료했다.
현재 후속 작업은 [앱 화면 틀 인수인계](app-shell-handoff.md)를 따른다. 현재 `develop`의 원격 기본 브랜치 설정은 변경하지 않았다.
