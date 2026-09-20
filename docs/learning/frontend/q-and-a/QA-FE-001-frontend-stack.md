# QA-FE-001: 급지도에는 어떤 프론트엔드 기술 스택이 적합한가?

> 날짜: 2026-09-19 · 성격: 현재 백엔드 골격을 기준으로 한 추천과 확정안

## 질문

Spring Boot REST API와 PostGIS 기반의 지도 중심 급지 서비스에는 어떤
프론트엔드 기술 스택이 적합한가?

## 핵심 답변

프로젝트에서 확정한 초기 조합은 다음과 같다.

- React + TypeScript strict mode
- Vite + React Router
- TanStack Query
- NAVER Maps JavaScript API v3 + `@types/navermaps`
- `openapi-typescript` + `openapi-fetch`
- Tailwind CSS + 필요한 Radix UI Primitives
- Vitest + React Testing Library + MSW + Playwright
- pnpm, ESLint, Prettier

지도 상호작용과 API 조회가 제품의 중심이고, 백엔드가 별도의 Spring Boot
REST 서비스이므로 초기에는 정적 배포가 가능한 SPA를 사용한다. 초기 품질
보증 범위는 데스크톱 웹이며 모바일 웹은 후속 검토 대상으로 둔다. 공개
지역·단지 상세 페이지의 검색 유입이 핵심 요구가 되면 Next.js 또는 React
Router의 SSR·정적 렌더링 구성을 다시 검토한다.

## 급지도 프로젝트에 적용되는 방식

- PostGIS의 `Point`와 `MultiPolygon`은 GeoJSON API 계약으로 전달하고
  NAVER Maps 데이터 레이어로 표현한다. NAVER SDK 접근은 프로젝트 내부 지도
  어댑터에 격리한다.
- 서버 데이터 캐시와 동기화는 TanStack Query가 담당한다. 선택된 지역,
  권역, 필터처럼 공유 가능한 상태는 URL에 두고 단순 UI 상태는 React에 둔다.
  Zustand는 복잡한 전역 UI 상태가 실제로 생길 때만 추가한다.
- Springdoc OpenAPI 문서에서 API 타입을 생성하여 백엔드 DTO와 프론트엔드
  타입의 중복 정의를 피한다. 운영 환경에서는 OpenAPI가 비활성화되므로
  CI에서 고정된 스키마 파일 또는 개발 환경 산출물을 사용한다.
- 백엔드 API가 아직 구현 전이므로 MSW를 이용해 합의된 API 계약으로 화면과
  테스트를 병렬 개발한다.
- 실시간 대진은 프로토콜이 결정된 뒤 단방향 갱신이면 SSE, 양방향 상호작용이
  필요하면 WebSocket을 추가한다.
- 공간 포함 여부, 인접 권역 판정과 같은 기준 계산은 PostGIS가 담당하고,
  브라우저의 공간 연산 라이브러리는 표시 보조에만 사용한다.

## 지금 추가하지 않는 기술

- Redux Toolkit: 초기 서버 상태와 UI 상태 규모에는 과하다.
- GraphQL: 현재 Springdoc 기반 REST 계약과 맞지 않는다.
- deck.gl: 대규모 포인트·3D 시각화 요구가 확인되기 전에는 필요하지 않다.
- 복잡한 폼 라이브러리: 로그인이나 관리 화면 등 실제 폼이 생길 때 도입한다.

## NAVER Maps API 적용 기준

지도 렌더링 계층에는 다음 기준을 적용한다.

- NAVER Maps JavaScript API v3를 사용한다.
- 공식 TypeScript 안내에 따라 `@types/navermaps`를 개발 의존성으로 둔다.
- SDK는 외부 스크립트로 한 번만 로드하고, React 컴포넌트가 지도 인스턴스와
  이벤트 리스너의 생성·해제를 책임지게 한다.
- 화면과 기능 코드가 `window.naver`에 직접 의존하지 않도록 지도 생성,
  viewport 이동, GeoJSON 표시, 선택 이벤트를 얇은 프로젝트 어댑터로 감싼다.
- 권역 데이터는 가능하면 `naver.maps.Data`의 GeoJSON 데이터 레이어로
  표현하고, 특수한 상호작용이 필요한 경우에만 개별 `Polygon`을 사용한다.
- PostGIS의 SRID 4326 좌표는 유지한다. 수동 변환 시 GeoJSON의
  `[longitude, latitude]` 순서와 `naver.maps.LatLng(latitude, longitude)`
  순서를 혼동하지 않도록 변환 함수를 한곳에 둔다.
- 브라우저용 지도 Client ID는 허용 웹 도메인으로 제한한다. Client Secret이
  필요한 Geocoding 등 REST 호출은 프론트엔드에서 직접 하지 않고 Spring
  백엔드를 경유한다.
- 단위·통합 테스트에서는 NAVER SDK 자체가 아니라 지도 어댑터를 대체한다.
  실제 SDK 연동, 등록 도메인과 모바일 동작은 별도의 Playwright smoke test로
  확인한다.

React, TypeScript, Vite, React Router, TanStack Query, OpenAPI 타입 생성,
Tailwind CSS, Radix UI와 나머지 테스트 도구는 그대로 유지한다. NAVER SDK는
국내 지도와 POI 품질 면에서 유리하지만 공급자 종속성과 호출 비용이 생기므로
프로젝트 내부 데이터 모델과 API 응답은 GeoJSON 등 공급자 중립 형식을
유지한다.

## 관련 자료

- [백엔드 저장소](https://github.com/sugkamoney/geupjido-backend)
- [Vite 공식 가이드](https://vite.dev/guide/)
- [React Router 모드](https://reactrouter.com/start/modes)
- [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [react-map-gl](https://visgl.github.io/react-map-gl/docs)
- [NAVER Maps JavaScript API v3](https://navermaps.github.io/maps.js.ncp/docs/)
- [NAVER Maps TypeScript 사용](https://navermaps.github.io/maps.js.ncp/docs/tutorial-3-Using-TypeScript.html)
- [openapi-typescript](https://openapi-ts.dev/introduction)
- [Mock Service Worker](https://mswjs.io/docs/)
