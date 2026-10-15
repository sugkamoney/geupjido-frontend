# 프론트엔드 기반 구축 현황과 다음 단계

> 상태: 초기화·디자인 시스템·AppShell·지도·검색 develop 통합 완료, 월드컵 검토 UI 구현·검증 완료 · 기준 날짜: 2026-10-15

## 현재 구현

디자인 시스템 PR #2는 `2c3a1f4`, AppShell PR #3은 `d3971c5`로 develop에 병합됐다. PR #3의 터치 합성 click 누락은 pointerup 처리와 Linux 재현으로 보완했고 지도 구현에서도 유지한다. 이전 app-shell workspace와 서버는 정리됐다.

`feature/map-exploration`은 develop `d3971c5`에서 시작했다(인수인계 기록 `36adf0c`). `/`와 `/map-exploration`은 명시적인 검토용 지도·데이터로 구/권역 라벨·핀·선택 면·제스처·상세/목록 선택을 제공한다. `/app-shell`, `/design-system` 기존 검토·회귀 경로도 유지한다. 코드 작성·수정은 100% AI로 수행했다. `pnpm check` RTL 48개와 production build, 전체 브라우저 66개가 통과했다(24개 플랫폼 적용 제외). 독립 리뷰의 pointer 종료/focus 복귀 2건은 회귀 실패→성공으로 보완했다. PR #4 전체 코드리뷰의 중요 결함 5건도 재현·수정했다(마커 제거 후 gesture, 짧은 화면 목록, 접힌 선택 행, 최신 source 표시, 긴 이름 충돌). 키보드 접힘 focus와 WebKit 후속 touch click 회귀도 포함한다. 후속 사용자 요청으로 클릭 확대·이동을 300ms에 걸쳐 전환하며, 이동 효과 줄이기·연속 클릭·직접 gesture 중단도 검증했다.

2026-10-14 백엔드 develop 읽기 전용 재확인은 `dfb7cc4`이며 batch 데이터 수집 기반 외 제품 지도·검색·상세 API는 아직 없다. 잠정 UI source와 지도 adapter를 분리했고 실제 NAVER 지도·검증된 좌표계·API·시세·단계·투표 집계는 연결하지 않았다. 검토 데이터가 실제 가격이나 집계라는 안내는 없다. [지도 구조·검증 결과](map-exploration.md)와 [현재 제품 SDD](../product/specs/map-exploration/README.md)를 따른다.

## 검색 구현

`feature/search`는 지도 브랜치 `63c0c74`에 stack한 기존 Orca workspace에서 구현했다(시작 HEAD는 핸드오프 문서 `f82d708`). 검색은 공백/대소문자 정규화·부분 일치·그룹 제한·정렬·원문 강조와 IME/키보드·touch 선택을 제공한다. 모바일 전체 검색·기존 SearchField/토큰·지도 selection/motion/frame을 재사용한다. viewport와 무관한 교체형 비동기 SearchSource로 화면 밖 대상을 찾는다. source는 직접 작성한 frontend 계약이며 실제 제품 API나 backend 생성 타입이 아니다. 코드는 100% AI 작성·수정이다. SDD는 [검색](../product/specs/search/README.md)을 따른다.

`pnpm check`(67개 테스트·품질 gate·빌드)와 desktop/mobile 브라우저 82개가 통과했다(29개 플랫폼 적용 제외). 지도 PR #4 리뷰 수정 통합 후 검색 후보보다 최신 상세 값을 우선하는 통합 회귀도 검증했다. 사용자 요청의 추가 독립 리뷰에서 확인한 Important 3건(모바일 재진입·이미 열린 상세의 focus 복귀·동일 검색어의 옛 응답 재활성화)을 회귀 실패→성공으로 수정했다. Figma 검색 컴포넌트·데스크톱 결과/빈 결과와 모바일 전체 검색을 시각 대조했다. 결과와 실제 API/SDK·실기기 IME/키보드/VoiceOver 미실행 사유는 [검증 기록](search.md)에 기록한다. 후속 사용자 요청으로 검색 feature push·PR·merge까지 승인됐다. 지도 PR #4는 develop 1cf3013에 병합된 것을 확인했고, 추가 지도 리뷰 수정 203c0b4까지 검색 브랜치에 통합해 검색 PR base를 develop으로 정리했다.

## 월드컵 구현

검색 PR #5는 develop `49f9e5b`에 병합됐고 이 기준과 인수인계 `694d98e`에서 현재 `feature/worldcup`에서 검토 UI를 구현·검증했다. 기존 검색 workspace는 정리됐으며 현재 지정된 workspace만 변경한다. 월드컵 설명·권역/단지 대진·선택/넘김·누적 My Picks·데스크톱 타임라인을 구현한다. 제품 기준은 [월드컵 SDD](../product/specs/worldcup/README.md), source·모달·검증은 [월드컵 구조](worldcup.md)다. 실제 투표/대진/비율 공개/급지 갱신 정책은 미확정이며 API·NAVER 연결은 없다. `VITEST_MAX_WORKERS=2 pnpm check`는 78개 단위 테스트와 품질 gate·운영 빌드를 통과했고, 이어 순차 실행한 브라우저는 108개 통과/33개 플랫폼 제외다. 데스크톱 Chromium·모바일 Chromium/WebKit 검증과 실제 기기/API 한계는 구조 문서에 기록했다. 코드 작업은 100% AI다. 이번 요청은 커밋까지이며 push·PR·merge는 포함하지 않는다.

## 후속 연결과 정책

공개 지도/상세 API 및 백엔드 생성 OpenAPI, 실제 geometry CRS와 지점 대조, NAVER 키/GL 스타일 metadata를 확보한 뒤 운영 adapter·source와 실제 SDK smoke를 이어 연결한다. 행정동 라벨·아파트 POI 숨김과 실제 fractional zoom은 미검증이다. 검색 알고리즘·결과·지도 선택 연결은 [검색 구조](search.md)에서 구현했다. 실제 검색 API와 월드컵 투표/대진/집계 연결은 후속 작업이다. 월드컵 UI는 위 현재 작업에서 진행한다.

모바일 웹은 지원한다. 기존 breakpoint·시트 높이·좁은 desktop 배치는 검토 가정이다. 실제 iOS/Android gesture·키보드/주소창·접근성 및 최소 viewport/OS는 추가 검토한다. 미정 급지/단계/투표 정책을 임의 계산하지 않는다.

후속 사용자 요청으로 브랜치를 push하고 develop 대상 [PR #4](https://github.com/sugkamoney/geupjido-frontend/pull/4)를 생성했다. 이 workspace의 검토 서버(5174)는 종료했으며 후속 작업은 상위 workspace에서 이어간다. PR #4는 2026-10-14 develop 1cf3013에 병합됐다. 검색 PR #5는 develop 49f9e5b에 병합됐다. 당시 지도 CI는 [PR checks](https://github.com/sugkamoney/geupjido-frontend/pull/4/checks), 재개 순서는 [인수인계](map-exploration-handoff.md)를 따른다.

## 9월에 확정한 기반 기준

급지도 프론트엔드는 React·TypeScript 기반 Vite SPA로 시작한다. 초기 품질 보증
범위는 1280×720 CSS px 이상의 데스크톱 Chrome·Edge·Safari 최신 안정 버전이며,
모바일 웹은 차단하지 않되 정식 지원과 QA 범위에서는 제외한다.

- 지도 제공자는 NAVER Maps JavaScript API v3다.
- 운영 웹과 Spring Boot API는 같은 origin에서 제공하고 API는 `/api` 경로를 쓴다.
  로컬 개발에서만 Vite `/api` 프록시를 사용한다.
- 경계는 GeoJSON `FeatureCollection`, 단지는 bounds·zoom 기반의 경량 viewport
  응답으로 제공한다.
- 단지 조회는 임시로 zoom 12~13에서 cluster, 14~21에서 개별 단지를 표시하며 zoom
  0~11에서는 요청하지 않는다. 실제 디자인·기획과 성능 검증 뒤 이 기준을 조정할 수 있다.
- 백엔드가 생성한 OpenAPI JSON이 계약의 단일 기준이다. 프론트는 검토된 버전의
  사본으로 TypeScript 타입을 생성한다.

상세 계약과 지도 SDK 운영 기준은 [지도 API·운영 기준 설계](../superpowers/specs/2026-09-19-map-api-and-runtime-design.md)에
기록한다. 기술 선택의 현재 기준은 [프론트엔드 기반 기술 구조](frontend-foundation.md),
선택 이유는 [ADR-002](../history/ADR-002-frontend-foundation.md)에서 확인한다.

## 9월 당시 작업 상태

- 프론트 애플리케이션 코드, 패키지 설정, CI, 배포 설정은 아직 만들지 않았다.
- 백엔드 `develop`의 `3cf1fc1` 기준에는 지도 controller·GeoJSON DTO·지도 API
  OpenAPI 명세가 없다. 따라서 현재 지도 API 문서는 구현 결과가 아니라
  프론트·백엔드가 합의해 구현할 계약이다.
- 지도 API 계약의 설계 문서는 리뷰 보완 사항까지 반영했지만, 백엔드 담당자의
  endpoint·응답 스키마 승인과 OpenAPI 생성이 선행되어야 실제 타입 사본을 만들 수 있다.

## 9월 당시 진행 순서

1. **백엔드 지도 API 계약 확정**

   지도 경계·단지 viewport·단지 상세 endpoint를 OpenAPI로 정의한다. GeoJSON
   좌표 순서, ID, zoom·bounds 제한, cluster `oneOf`, ETag와 오류 응답을 설계 문서와
   대조한다.

2. **프론트 프로젝트 초기화**

   pnpm 기반 React + TypeScript strict + Vite SPA를 만들고, ESLint·Prettier,
   Vitest·React Testing Library·MSW·Playwright의 최소 실행 구성을 추가한다.

3. **계약 기반 API 계층 구축**

   백엔드 OpenAPI JSON의 고정 사본을 추가하고 `openapi-typescript`와
   `openapi-fetch`를 구성한다. 백엔드 구현 전에는 같은 응답 계약으로 MSW mock을
   제공한다.

4. **지도 어댑터와 지도 화면 구현**

   NAVER SDK 단일 loader, 인증·네트워크 오류 분기, 지도 객체·listener 정리,
   GeoJSON Feature 참조 Map을 구현한다. 이어서 경계와 단지 query를 TanStack Query로
   연결한다.

5. **배포·통합 검증**

   개발 `/api` 프록시, 운영 동일 origin `/api`, SPA deep-link fallback을 설정한다.
   지도 SDK 인증, 경계 캐시, 단지 요청 취소·오래된 응답 차단, 최소 desktop viewport를
   브라우저 테스트와 Safari smoke test로 검증한다.
