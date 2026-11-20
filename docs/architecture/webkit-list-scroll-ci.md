# WebKit 목록 수동 스크롤 CI 실패 조사

> 상태: 원인 재현·수정·Linux 전체 E2E 검증 완료, GitHub CI 미실행 · 버전: 1.0 · 갱신: 2026-11-20

## 조사 기준과 증상

지도 연동 PR #9는 `0b54503`으로 병합됐다. 병합 전
[CI run 44648640042](https://github.com/sugkamoney/geupjido-frontend/actions/runs/44648640042)는
`pnpm check`를 통과했지만 mobile WebKit의
`map and viewport updates preserve manual list scrolling after selection`이
최초 실행과 재시도 2회 모두 실패했다. 기대 `scrollTop=500`, 실제 `0`이었다.
다른 E2E는 130개 통과했고 플랫폼 조건에 따른 34개는 제외됐다.

이 조사는 병합된 `0b54503`에서 시작했다. 완료된 지도 child는 미커밋 변경이 없고
작업 커밋이 `origin/develop`에 포함된 것을 확인한 뒤 Orca로 제거했다.
부모 작업공간은 보존된 문서 커밋을 포함해 `origin/develop`으로 fast-forward했다.

## 재현과 원인

macOS WebKit에서는 기존 테스트가 3회 모두 통과했다. 같은 Playwright 1.64.0의
공식 Linux arm64 컨테이너에서는 기존 테스트를 재시도 없이 2 workers로 5회 실행해
3회 실패·2회 통과했다. GitHub의 Ubuntu runner와 CPU 아키텍처까지 같다는 의미는 아니다.

임시 진단 테스트로 실제 ResizeObserver 콜백, 목록 크기, focus, scroll, scrollTo 호출을 기록했다.
실패 실행에서 다음 순서를 확인했다.

1. 단지 선택 후 `useLayoutEffect`가 선택 행을 즉시 정렬했다. 목록은 폭 390px, 높이 92px였다.
2. 테스트가 목록을 500px 내려 읽고 지도 확대를 시작했다.
3. `observe(list)`가 예약한 **최초 알림**이 뒤늦게 도착했다. 목록 크기는 그대로였다.
4. 콜백이 크기 변경 여부와 관계없이 `centerRow()`를 다시 실행해 수동 스크롤을 0으로 덮었다.

따라서 API 응답이나 지도 focus 자체가 목록을 초기화한 것이 아니라,
`ApartmentList`의 동일 크기 최초 알림 처리가 직접 원인이었다.
기존 스크롤 구현은 PR #9 이전에도 이 처리를 갖고 있었다.
테스트 실행 속도와 엔진에 따라 재현 여부가 달라지지만 제품 코드의 잘못된 재정렬이다.

## 수정과 유지하는 동작

`ApartmentList`는 즉시 정렬한 시점의 `clientWidth`·`clientHeight`를 보관하고,
ResizeObserver 콜백에서 실제 크기가 달라졌을 때만 다시 정렬한다.
숨겨져 높이가 0이 된 상태도 기록하므로 같은 크기로 다시 펼쳐도 재정렬한다.
선택 ID 변경·뒤늦은 선택 행 도착에 따른 즉시 정렬은 유지한다.
desktop과 mobile web이 같은 구현을 사용한다.

회귀 단위 테스트는 수동 스크롤 뒤 같은 크기의 최초 알림이 도착하는 순서를 직접 실행한다.
JSDOM의 레이아웃 크기는 부모 DOM을 설정한 다음 목록을 표시하여 제공한다.
실제 높이·너비 변경·동일 알림 반복·숨김/재표시도 검사한다.
기존 E2E 본문·기대값·대기 시간·재시도 정책은 변경하지 않았다.
진단용 코드와 테스트는 저장소에서 제거했다.

## 검증과 한계

Node 24.15.0 / pnpm 11.13.0을 사용한다.

| 검사 | 결과 |
| --- | --- |
| 회귀 단위 RED→GREEN | 기존 구현에서 수동 스크롤 100→0과 불필요한 재정렬 재현, 수정 후 통과 |
| 로컬 `pnpm check` | 단위 237개·타입·lint·format·토큰·production build 통과 |
| Linux 기존 WebKit E2E 5회, workers=2, retries=0 | 수정 전 3회 실패·2회 통과 → 수정 후 5회 통과 |
| Linux 전체 E2E, workers=2, retries=0 | desktop Chromium·mobile Chromium/WebKit·NAVER 오류 구성: 131 통과·34 플랫폼 제외·실패 0·flaky 0 |
| 독립 코드 리뷰 | 확정된 결함 없음. 너비만 바뀌는 경우의 단위 검증을 추가 보강 |

이번 수정의 GitHub CI는 아직 실행하지 않았다. 과거 실패 run은 그대로이며,
컨테이너 결과를 GitHub CI 재실행 성공으로 표현하지 않는다.
이번 브라우저 검증은 fixture 지도·mock HTTP 계약이며 실제 NAVER SDK나 물리 모바일 기기는 재검증하지 않았다.
BE 변경·개발 API 쓰기는 수행하지 않았다.

관련: [지도 연동 마무리](map-integration-finalization.md),
[ResizeObserver 최초 알림 Q&A](../learning/frontend/q-and-a/QA-FE-011-resize-observer-initial-scroll.md).
