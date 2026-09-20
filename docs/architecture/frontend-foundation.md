# 프론트엔드 기반 기술 구조

> 상태: **확정** · 날짜: 2026-09-19

## 기본 스택

- React + TypeScript strict mode
- Vite 기반 SPA
- React Router
- TanStack Query
- NAVER Maps JavaScript API v3 + `@types/navermaps`
- `openapi-typescript` + `openapi-fetch`
- Tailwind CSS + 필요한 Radix UI Primitives
- Vitest + React Testing Library + MSW + Playwright
- pnpm + ESLint + Prettier

라이브러리 버전은 프로젝트 초기화 시점의 호환되는 안정 버전을 선택하고
lockfile로 고정한다.

## 렌더링과 라우팅

초기 애플리케이션은 브라우저에서 실행되는 Vite SPA로 구성한다. 지도 탐색과
API 기반 상호작용이 중심이고 Spring Boot 백엔드가 별도로 존재하므로, 초기
운영에 프론트엔드 서버 계층을 추가하지 않는다.

선택한 지역, 권역과 필터처럼 공유·복원이 필요한 상태는 URL에 둔다. 공개
지역·단지 페이지의 검색 유입, 서버 렌더링 또는 정적 생성이 중요해지면
Next.js나 React Router의 SSR·정적 렌더링 구성을 검토한다.

## 지도 경계

NAVER Maps JavaScript API v3를 지도 제공자로 사용한다. 화면과 기능 코드는
`window.naver`에 직접 의존하지 않고 프로젝트 내부 지도 어댑터를 통해 지도
생성, viewport 이동, GeoJSON 표시와 선택 이벤트를 사용한다.

- 권역 데이터는 우선 `naver.maps.Data`의 GeoJSON 레이어로 표현한다.
- PostGIS SRID 4326과 GeoJSON을 프로젝트의 공급자 중립 데이터 형식으로
  유지한다.
- 브라우저에는 허용 도메인이 설정된 지도 Client ID만 제공한다.
- Client Secret이 필요한 NAVER REST API는 Spring Boot 백엔드를 경유한다.
- 단위·통합 테스트는 지도 어댑터를 대체하고, 실제 SDK 연동은 브라우저 smoke
  test로 검증한다.

## 상태와 API

TanStack Query는 API에서 받은 서버 상태를 관리한다. 단순 UI 상태는 React에
두고, 복잡한 전역 UI 상태가 실제로 생기기 전에는 별도 전역 상태 라이브러리를
추가하지 않는다.

Springdoc OpenAPI 스키마에서 TypeScript 타입을 생성한다. 운영 API 문서에
의존하지 않도록 CI 산출물 또는 저장소에 고정한 OpenAPI 스키마를 입력으로
사용한다. 백엔드 API 구현 전에는 같은 계약을 기반으로 MSW 응답을 제공한다.

## 초기 플랫폼 범위

초기 품질 보증 범위는 데스크톱 웹이다. 모바일 웹은 후속 제품 결정 전까지
지원 범위에서 제외한다. 자세한 기준은 [플랫폼 지원 범위](../product/platform-support.md)를
따른다.
