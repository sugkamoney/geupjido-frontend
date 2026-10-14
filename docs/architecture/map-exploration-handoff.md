# 지도 탐색 작업 인수인계

> 갱신: 2026-10-14 · 상태: PR #4 리뷰 보완·검증 완료, 이 workspace 작업 종료 · 상위 workspace에서 재개

## 브랜치와 PR

- PR: [#4 지도 탐색과 권역 상세 선택 구현](https://github.com/sugkamoney/geupjido-frontend/pull/4)
- 대상: `develop` ← `feature/map-exploration`. 현재 PR은 OPEN이며 merge는 수행하지 않았다.
- 기준: AppShell PR #3이 병합된 develop `d3971c5`, 최초 인수인계 `36adf0c`.
- 구현: `94841ca` 지도 탐색·상세 선택, `6f8331b` 클릭 확대·이동의 300ms 전환.
- 작업 위치: `/Users/user/orca/workspaces/geupjido-frontend/feature-map-exploration`.
- 브랜치는 origin에 push했다. Vite 검토 서버(5174)는 종료했고 포트 해제를 확인했다.
- PR 리뷰를 위해 feature 브랜치와 workspace는 유지한다. 사용자 요청에 따라 다음 작업은 상위 workspace에서 진행한다.

## 완료한 범위

최신 Figma·MD 기준으로 구/권역 라벨, 단지 핀, 선택 권역 면, 실수 zoom 경계, 전체 보기·구/권역 전환·지도 조작, 상세/목록 선택·scroll·clearing을 구현했다. 클릭 이동은 300ms ease-out이며 연속 클릭·직접 gesture 중단과 reduced motion을 처리한다. 모바일 pointerup 선택과 시트/목록 scroll, 낮은 zoom에서 닫기 focus 복귀를 검증했다.

`/`와 `/map-exploration`은 명시적인 검토용 지도·데이터다. AppShell slot/MapFrame/MapCommand·공통 UI·토큰·원본 자산을 재사용하고 지도 adapter와 상세 source를 교체할 수 있게 분리했다.

## 검증과 문서

- frozen install, `pnpm check` 통과: 단위 48개·8파일, production build 성공.
- 전체 Playwright: desktop Chromium, mobile Chromium/WebKit 66개 통과, 플랫폼별 24개 제외.
- Figma context·원본 SVG metadata 및 desktop/mobile 렌더 대조.
- 독립 리뷰의 pointer 종료/focus 복귀·직접 zoom 중단 결함을 실패→성공으로 수정.
- PR #4 전체 리뷰 Important 5건을 재현·수정했다: 제거된 마커 pointer 정리, 짧은 모바일 목록, 접힌 선택 행·focus, 최신 상세 값, 긴 선택 이름 충돌. WebKit compatibility click 보완도 포함한다.
- 원격 CI 최신 head의 상태는 [PR #4 checks](https://github.com/sugkamoney/geupjido-frontend/pull/4/checks)에서 확인한다.

[지도 기술 구조·상세 검증](map-exploration.md), [통합 현황](frontend-implementation-status.md), [지도 SDD](../product/specs/map-exploration/README.md), [ADR-005](../history/ADR-005-map-fixture-boundary.md)를 먼저 읽는다. `pnpm check`와 브라우저 검사 모두 dist를 빌드하므로 순차 실행한다([QA-FE-006](../learning/frontend/q-and-a/QA-FE-006-preview-build-race.md)).

## 남은 연결과 정책

2026-10-14 읽기 전용 재확인의 backend develop은 `dfb7cc4282979232f616113dd25704ee0b38b405`다. 수집 기반 외 공개 제품 지도·검색·상세 API는 없다. 실제 NAVER SDK·CRS/geometry·시세·급지 단계·투표 집계는 미연결이다. UI 타입은 잠정 수기 계약이며 backend-generated OpenAPI가 아니다.

실제 API/OpenAPI, 검증된 CRS·한강 제외 면, 공개 SDK key/GL style metadata가 준비되면 source/adapter와 운영 smoke를 이어 연결한다. 임의 좌표 오프셋을 적용하지 않는다. 행정동 라벨·아파트 POI 개별 숨김과 실제 fractional zoom 동작은 SDK 환경에서 확인해야 한다.

모바일 웹은 지원한다. 기존 breakpoint·시트 높이·좁은 desktop 배치는 검토 가정이며 최소 viewport/OS 정책으로 확정하지 않는다. 실기기 gesture·키보드/주소창·VoiceOver, 대규모 실제 데이터 성능·운영 배포는 별도 검증이다. 미정 급지/단계/투표 임계값을 계산 정책으로 확정하지 않는다.

## 상위 workspace에서 이어갈 순서

1. PR #4의 최신 checks·리뷰·병합 상태와 작업 트리를 확인한다. develop 반영 상태를 확인한 뒤 후속 작업의 기준 브랜치를 정한다.
2. 다음 기능 범위를 정한다. 검색 알고리즘과 월드컵 대진/투표/집계는 아직 시작하지 않았다. 검색은 Downloads `05-search.md`가 준비된 다음 후보이며, 사용자에게 이번 단계의 구현 승인을 받지는 않았다.
3. 새 기능을 시작하면 AGENTS.md와 해당 자료를 읽고 SDD 필수 4개·제품/기술 문서 경계를 유지한다. 원본 Downloads의 한국어 파일명은 Unicode 분해형일 수 있다.
4. Figma 생김새, MD 동작·시간·문구를 따른다. 기존 지도 범위와 검증된 pointerup 처리·모션 중단·frame centering을 보존한다.

Figma: [Screens](https://www.figma.com/design/VB4hekcKLXEAyuFPu4zhVU?node-id=82-5), [Components](https://www.figma.com/design/VB4hekcKLXEAyuFPu4zhVU?node-id=82-4). 필수 Figma 스킬을 해당 도구 호출 전에 로드한다.
