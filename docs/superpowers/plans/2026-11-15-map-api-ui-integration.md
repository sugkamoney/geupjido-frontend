# 기존 지도 화면의 실제 API 연결 계획

> 상태: 구현·자동 및 실제 API 브라우저 검증 완료, BE 보완·SDK 결합·실기기 별도 · 갱신: 2026-11-15
> 실행: superpowers:executing-plans, test-driven-development, verification-before-completion 적용.

## 범위와 설계

사용자는 가능한 기존 화면 연결부터 진행하고 BE 요청은 전달했다고 밝혔다.
`/`, `/map-exploration`에서 실제 cities·viewport zones/complexes·검색·상세를 사용한다.
기존 fixture 화면은 `/map-exploration/fixtures`로 분리하고 자동 fallback하지 않는다.
NAVER adapter와 제스처는 유지하며 지도 키 없는 로컬 검토에서는 명시적으로 fixture adapter만 사용한다.

표시는 초기 급지 기준이며 원본 initial/vote·각 rank/total·rankingBasis는 보존한다.
초기 값 null은 정보 없음이며 민심 값으로 채우지 않는다. 가격은 대표 거래가, 단지 순위는
BE rankingBasis와 zoneRank다. 위치 없는 행은 선택을 유지하되 이동하지 않고 안내한다.
면적 없는 라벨은 선택 우선·ID 순으로 임시 배치하며 bbox를 면적으로 사용하지 않는다.
이 임시 동작은 사용자가 승인한 '가능한 부분 우선 연결'에 대한 구현 결정이며 BE 계약 보완 후 재검토한다.
상태 카드·월드컵·타임라인·새 디자인 전면 반영은 후속이다. 실제 화면의 fixture 투표는 연결하지 않는다.

## Task 1: 서버 응답을 탐색 모델로 변환

- [x] `api/live-source.test.ts` 작성 후 미구현 실패 확인.
- [x] `api/live-source.ts`: city overview, zone summary, 핀, 전체 상세 목록·geometry, 서버 검색 그룹 변환.
- [x] bounds/area/polygon/단지 좌표를 optional로 구분. fixture 모델은 위치·경계가 존재하는 타입 유지.
- [x] 상세 bbox에 좌표 반올림 오차 여유 0.000001도를 더해 핀 조회, zoneId/id 결합.
  위치 조회 실패도 상세·목록은 표시하며 실패와 데이터 누락을 구분한다. 취소는 전파한다.
- [x] 검색은 서버 그룹 순서·상위 결과를 유지하고 단지는 zoneId 참조로 선택. 기존 IME/focus 계약 유지.
- [x] null·순위 없음·여러 면/hole·viewport 밖 검색·추가 핀 실패 테스트 통과.

## Task 2: 기존 UI 연결과 서버 상태

- [x] 실제 경계 source를 주입한 UI 통합 테스트를 먼저 작성·실패 확인.
- [x] cities 초기 요청과 실패/빈 값/재시도. TanStack Query로 viewport 요청 관리.
- [x] MapSurface는 실측 크기·ready 이후 네 모서리의 bounds를 산출해 200ms debounce.
  zones는 12.5 이상, pins는 14.5 이상. Query key와 signal로 취소/범위 응답 분리.
- [x] viewport가 바뀌어도 선택 상세·핀 유지. 실패를 빈 결과나 fixture로 바꾸지 않음.
- [x] geometry SVG path evenodd로 모든 면·hole 보존. 초기 급지·대표 거래가·실제 rank 표시.
- [x] 모바일 목록 선택·시트/검색·focus 유지. 좌표 없는 선택 시 지도 이동/접힘 생략 및 안내.
- [x] 실제 route와 fixture route 분리. 개발 프록시 target은 비공개 서버 환경 변수로 설정.

## Task 3: 검증·문서·사용자 웹 확인

- [x] `pnpm check`, 기존 fixture E2E와 신규 실제 경계 mock E2E를 순차 실행.
- [x] 실제 API로 desktop/mobile 브라우저에서 검색→상세→목록 이동, 실패/재시도·빈 검색 검증.
  로컬 키 없음과 실제 NAVER GL 미검증 범위는 별도 보고.
- [x] 독립 읽기 전용 리뷰, SDD·architecture·ADR·INDEX 갱신.
- [x] 사용자가 볼 기존 화면을 개발 서버에서 열어두고 구체적 확인 절차 안내.

## 제약

BE와 상위 checkout은 수정하지 않는다. push·PR·merge 없음. 새 의존성 없음.
추가 승인 질문 없이 이 계획의 범위를 진행하며 미지원 계약을 구현 완료로 주장하지 않는다.

## 최종 결과

- `pnpm check`: 25파일·223개 통과, 빌드 성공. 전체 E2E125개 통과/34개 플랫폼 적용 제외.
- 실제 API desktop/mobile Chromium·WebKit에서 검색·상세·목록 선택·빈 검색 확인.
- 독립 리뷰 Important 3건은 재현 테스트 실패→수정 후 통과. 미해결 Critical/Important 없음.
- 최초 API 검증은 키 없는 로컬 명시적 fixture 지도 모드였다. 후속 사용자 키 설정 뒤 인증 200과 desktop 실제 NAVER GL/API 결합을 확인했다. 후속 모바일 SDK 브라우저 검증과 경계 원인 확인도 완료했다. 한강 수면 제외는 BE 보완이 필요하며 물리 기기·시작 지연 관찰은 별도다.
- 사용자에게 기존 기본 화면을 열어둔다. 후속 실제 SDK·경계 검증은 [검증 기록](../../architecture/map-boundary-mobile-validation.md)을 따르며 BE 보완·물리 기기는 후속이다.
