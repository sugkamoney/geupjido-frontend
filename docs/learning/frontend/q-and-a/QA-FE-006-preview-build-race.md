# QA-FE-006: Vite preview 검사 중 다른 빌드를 실행하면 왜 asset 404가 날까?

> 날짜: 2026-10-14 · 지도 탐색 회귀 검증 사례

## 질문

코드와 단위 검사는 정상인데 Playwright의 WebKit에서 화면이 비어 있다. 같은 workspace의 `pnpm check`와 `pnpm test:e2e`를 동시에 실행한 것이 원인일 수 있는가?

## 답변

그럴 수 있다. Vite production build는 `dist/`를 비우고 content hash가 붙은 JS/CSS를 다시 생성한다. preview는 그 디렉터리를 제공하므로 브라우저가 이전 index.html을 읽은 뒤 다른 빌드가 기존 asset을 삭제하면 JS 요청이 404가 된다. 서로 다른 빌드 프로세스의 index/asset 읽기는 한 번의 트랜잭션이 아니다.

이 프로젝트의 `pnpm check`는 마지막에 build를 실행하고, Playwright webServer도 build 후 preview한다. 지도 탐색 검증에서 두 명령이 겹친 실행은 기존 app-shell WebKit 3건이 빈 화면으로 실패했다. trace에는 `/app-shell` 200 후 이전 hash JS 404와 stylesheet MIME 오류가 있었다. 선택/focus 기능 결함을 의미하는 실패가 아니었다.

같은 dist를 사용하는 quality check와 browser 검사는 순차 실행한다. 병렬화가 필요하다면 각 검증에 독립된 빌드 출력/서버를 제공해야 한다. timeout이나 retry를 늘려 원인을 숨기지 않는다.

[검증 기록](../../../architecture/map-exploration.md)을 따른다.
