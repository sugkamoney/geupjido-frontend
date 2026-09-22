# 프론트엔드 기반 구축 현황과 다음 단계

> 상태: **구현 대기** · 기준 날짜: 2026-09-20

## 현재까지 확정한 기준

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

## 현재 작업 상태

- 프론트 애플리케이션 코드, 패키지 설정, CI, 배포 설정은 아직 만들지 않았다.
- 백엔드 `develop`의 `3cf1fc1` 기준에는 지도 controller·GeoJSON DTO·지도 API
  OpenAPI 명세가 없다. 따라서 현재 지도 API 문서는 구현 결과가 아니라
  프론트·백엔드가 합의해 구현할 계약이다.
- 지도 API 계약의 설계 문서는 리뷰 보완 사항까지 반영했지만, 백엔드 담당자의
  endpoint·응답 스키마 승인과 OpenAPI 생성이 선행되어야 실제 타입 사본을 만들 수 있다.

## 다음 진행 순서

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

백엔드 API 담당자와 지도 OpenAPI 계약을 확인할 수 있다면 1단계부터 시작한다.
백엔드 구현을 기다려야 한다면 2단계와 3단계의 MSW mock까지는 병렬로 진행할 수 있다.
이 경우 mock은 이 문서가 링크한 설계 계약을 그대로 따라야 하며, 실제 OpenAPI가
도착하면 차이를 확인해 갱신한다.
