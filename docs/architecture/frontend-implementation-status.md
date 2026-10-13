# 프론트엔드 기반 구축 현황과 다음 단계

> 상태: **프로젝트 초기화 구현·로컬 검증 완료, 제품 화면 구현 대기** · 기준 날짜: 2026-10-13

## 최신 준비 점검

10월 13일 백엔드 `develop`의 `dfb7cc4`와 새 디자인 핸드오프를 확인했다.
지역·단지·실거래 데이터 수집 기반은 있으나 제품용 지도·검색·월드컵 API는
아직 없다. Figma·동작 MD를 기준으로 UI/mock 개발은 착수할 수 있다.
사용자는 모바일 웹도 지원하기로 확정했으며 모바일도 제품·QA 범위에 포함한다.
React·TypeScript·Vite 앱과 pnpm lockfile, Router·Query provider, Tailwind, 품질 검사,
단위·브라우저 테스트 및 GitHub CI 설정을 추가했다. 로컬 검사는 통과했고 실제
GitHub CI 실행·운영 배포 설정과 제품 화면은 후속 작업이다.
자세한 구성과 실행 방법은 [프로젝트 초기화](project-initialization.md)를 따른다.

새 핸드오프의 라벨·단지 핀·실수 zoom 기준은 아래 9월 지도 설계와 다르다.
아래 기준과 순서는 당시 기록이며 현재 화면 규칙으로 그대로 적용하지 않는다.
[최신 구현 준비 점검](2026-10-13-implementation-readiness.md)과
[디자인 핸드오프 기준](../product/design-handoff.md)을 먼저 확인한다.

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

## 다음 세션 시작 지점

`feature/initialize-project`와 Orca workspace 생성 및 프로젝트 초기화는 완료했다.
현재 Orca CLI는 workspace 생성의 `--yolo`를 지원하지 않아 workspace 안에
`codex --yolo` 터미널을 따로 준비했다. 구현 파일은 Orca worktree에 있다.

다음에는 초기화 브랜치의 변경을 검토·통합한 뒤 Figma tokens·공통 컴포넌트와
데스크톱·모바일 화면 틀을 구현한다. 새 디자인의 모바일 세부 배치와 지도 API 계약은
별도로 확인한다. 실제 BE OpenAPI 전까지 mock은 임시 계약임을 명시한다.
