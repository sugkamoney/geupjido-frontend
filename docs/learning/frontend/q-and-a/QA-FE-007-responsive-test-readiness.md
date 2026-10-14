# QA-FE-007: 화면 크기 변경 뒤 검색 재진입 검사가 Linux WebKit에서 왜 실패했나?

> 갱신: 2026-10-14

## 질문

setViewportSize 뒤 결과가 닫혔다는 ARIA 상태를 확인했는데, macOS에서 통과한 검색 재진입 검사가 PR #5의 Linux WebKit CI에서 왜 실패했나?

## 답변

브라우저의 viewport 변경과 앱의 반응형 상태 반영은 별개다. 급지도는 MediaQueryList change 이벤트를 받아 React의 compact 상태와 검색 닫기를 갱신한다. viewport API가 반환된 시점에도 해당 이벤트와 React commit은 처리 중일 수 있다.

이전 상태에서도 참인 조건으로 다음 동작의 준비를 판단하면 안 된다. 결과 닫힘은 desktop과 mobile 모두에서 가능하다. 실제 배치가 바뀌었다는 조건을 먼저 기다리고, 그 다음 결과 닫힘과 키보드 재진입을 확인한다. 고정 sleep·늘린 timeout·반복 재시도는 이 선후 관계를 보장하지 않는다.

## 급지도 적용

최초 [PR #5 CI](https://github.com/sugkamoney/geupjido-frontend/actions/runs/38528955275)는 mobile WebKit type/arrow 2건이 마지막 1280→390 전환 후 실패했다. trace에서 Backspace 시점의 data-compact=false와 이후 true 전환을 확인했다. 입력이 전환 전 배치에서 처리된 뒤 전환 callback이 편집·결과를 닫았고, 검사는 모바일 재진입을 기대했다.

[e2e/search.spec.ts](../../../../e2e/search.spec.ts)는 전환 후 `.app-shell[data-compact]`의 false/true를 각각 확인한 뒤 aria-expanded와 재진입을 검사한다. 두 UI 동작·지원 범위·제품 코드는 유지했고 retries/timeout은 변경하지 않았다. 보완 후 단위/품질 검사 67개와 공식 Playwright 1.64.0 Linux 컨테이너의 실제 두 테스트 3회 반복(6건)이 통과했다. 컨테이너는 GitHub amd64 runner와 구분하며 최종 원격 결과는 [PR checks](https://github.com/sugkamoney/geupjido-frontend/pull/5/checks)를 따른다.

[검색 구조·CI 기록](../../../architecture/search.md), [반응형 상태 hook](../../../../src/components/app-shell/use-shell-layout.ts)을 참조한다.
