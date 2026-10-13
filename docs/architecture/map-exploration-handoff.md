# 지도 탐색 작업 인수인계

> 날짜: 2026-10-13 · 상태: 새 Codex 세션에 구현 작업 전달

## 환경

앱 화면 틀 PR #3이 `develop`의 `d3971c5`에 병합된 것을 확인하고 이 커밋에서
`feature/map-exploration`을 분기했다. Orca workspace는
`/Users/user/orca/workspaces/geupjido-frontend/feature-map-exploration`이며
`codex --yolo` 세션에 다음 구현을 전달한다. 통합 대상은 `develop`이다.
이전 앱 화면 틀 workspace는 미커밋 변경이 없고 develop에 포함된 것을 확인한 뒤
사용자 요청으로 개발 서버와 함께 정리했다.

## 구현 순서와 경계

1. 기존 `docs/product/specs/map-exploration/`의 필수 문서 4개를 최신 Figma·MD에
   맞춰 갱신한다. 오래된 cluster·zoom 규칙과 상세 미정 기록을 현재 기준에
   맞춰 정리하고 상태·버전·변경 이력과 제품/기술 문서 경계를 유지한다.
2. 기존 디자인 시스템과 AppShell 슬롯을 재사용해 지도 탐색 상태·표시 구조를
   구성한다. 구·권역 라벨, 단지 핀, 선택 권역 면, 구/권역 전환과 지도 조작을
   구현하고 권역 상세·단지 목록 선택/해제를 연결한다.
3. 제품용 API 부재 시 명시적인 mock/fixture와 공급자 대체 어댑터로 선택·상세
   흐름을 먼저 검증한다. mock을 실제 지도/실거래/집계 데이터로 표시하지 않는다.
4. 백엔드 구현 현황을 읽기 전용으로 재확인하고 새 UI의 데이터 계약을 정리한다.
   NAVER SDK와 실제 API는 준비된 계약·환경에 따라 이어 연결하며, 미연결·미검증
   범위는 명확히 기록한다. 임의 OpenAPI를 백엔드 생성 계약으로 취급하지 않는다.

독립 검색 기능, 월드컵 대진·투표·집계는 이번 작업의 후속 범위다.
급지 색·단계 임계값 등 미정 기획값을 자동 계산 정책으로 확정하지 않는다.

## 자료와 검증

생김새는 [Figma Screens](https://www.figma.com/design/VB4hekcKLXEAyuFPu4zhVU?node-id=82-5),
동작은 Downloads 핸드오프의 `00-README`, `03-map`, `04-zone-detail`과 필요한
MD를 따른다. zoom 12.5 권역/14.5 핀/최소 9.5·최대 17 기준을 확인한다.
모바일도 지원하며 모바일 HTML은 참고용이다. 현재 AppShell의 좁은 화면 배치는
검토안이므로 최종 지원 정책으로 확정하지 않는다.

[디자인 시스템](design-system.md), [AppShell 구조](app-shell.md),
[디자인 핸드오프](../product/design-handoff.md), [플랫폼 지원](../product/platform-support.md)을
먼저 읽는다. 전체 데이터 경계 면을 기본 표시하거나 프론트 임의 좌표 오프셋으로
데이터를 보정하지 않는다. 실제 좌표계·geometry는 원본과 실제 지점으로 검증한다.

frozen 설치와 baseline 후 meaningful 상태·선택·zoom·늦은 응답 차단·자원 정리
테스트 및 데스크톱/모바일 브라우저·Figma 대조를 수행한다. `pnpm check`와 필요한
브라우저 검사를 실행하고 기대/실제·미실행 이유·모바일 제약을 기록한다.
문서·INDEX·통합 현황을 갱신하고 한국어 규칙으로 커밋한다. PR 작성 단계에서는
기본 템플릿과 AI 코드 작업 100%·검증 결과 기록 규칙을 적용한다.
이번 인수인계는 feature push·PR·merge 요청을 포함하지 않는다.
