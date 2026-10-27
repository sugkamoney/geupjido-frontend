# NAVER 지도 SDK 연결 작업 인수인계

> 상태: 작업 환경 준비·브레인스토밍 시작 · 갱신: 2026-10-27

## 시작 기준과 요청

사용자는 상위 저장소를 `develop`으로 전환하고 최신 `develop`의 `5830f1e`에서
`feature/integrate-naver-map-sdk` 브랜치와 Orca workspace를 생성하도록 요청했다.
Claude 세션에서 구현 방식 브레인스토밍부터 진행하며 제품 코드는 아직 작성하지 않는다.
PR #6은 병합됐고 GitHub Frontend CI check는 성공했다.

Workspace는 `/Users/user/orca/workspaces/geupjido-frontend/feature-integrate-naver-map-sdk`다.
상위 저장소의 미커밋 문서 5개는 `codex-preserve-main-docs-before-develop-2026-10-27`
stash에 보존했다. 해당 변경을 이 브랜치에 적용하지 않았다. 특히 이전 OpenAPI 생성
정책 변경을 현재 계약으로 자동 채택하지 말고 필요한 경우 별도로 검토한다.

## 현재 구현과 읽을 자료

디자인 시스템·AppShell·지도 탐색/상세·검색·월드컵 UI는 develop에 통합됐다.
지도는 가상 grid와 fixture adapter이며 실제 NAVER SDK·검증된 geometry·제품 API는
미연결이다. 기존 선택·검색·카메라 이동·월드컵 연결과 데스크톱/모바일 동작을 살핀다.

- [지도 구조와 검증](map-exploration.md)
- [검색 구조](search.md), [월드컵 구조](worldcup.md), [앱 화면 틀](app-shell.md)
- [디자인 핸드오프](../product/design-handoff.md), [플랫폼 지원](../product/platform-support.md)
- `src/features/map-exploration/`의 types·fixture-adapter·map-surface·use-map-input
- 지도/검색 SDD와 [기존 API 설계](../superpowers/specs/2026-09-19-map-api-and-runtime-design.md)

9월의 cluster·정수 zoom 기준을 그대로 적용하지 않는다. 최신 핸드오프의 fractional
zoom·구/권역 라벨·단지 핀·선택 면과 기존 코드가 우선 검토 대상이다. 시각 기준은
AGENTS.md의 Figma 작업공간이며 실제 디자인 검토 시 해당 Figma skill을 따른다.

## 브레인스토밍 범위

기존 adapter 교체 범위와 SDK loader/객체 수명주기, 카메라·projection·overlay·패널
가림 영역 처리, 기존 gesture와 SDK gesture의 책임, 오류/재시도와 fixture 검토 경로
유지 방식을 조사한다. 공개 Client ID·등록 origin·GL 스타일 metadata·검증된 좌표
자료의 준비 상태를 값 노출 없이 확인하고, SDK 최신 기능은 공식 문서로 검증한다.
실제 SDK 연결과 API/geometry 준비 대기 범위를 구분해 대안을 제시한다.

데스크톱과 모바일 웹 모두 지원하며 실제 touch·짧은 화면·접근성 검증 범위를
설계한다. 모바일 최소 viewport/OS와 실제 좌표 정확성을 임의로 확정하지 않는다.
키나 비공개 환경 정보는 문서에 넣지 않는다.

2026-10-27 GitHub 읽기 전용 확인에서 backend develop은
`206b0e0980e85ff9f3494c422de8a929178b87bc`다. 단지 선택 적재와 실거래 저장·수동 적재가
추가됐으나 전체 파일 트리에 제품 controller는 없다. 서버/DB/실제 데이터는 검증하지
않았다. backend 변경은 요청 범위가 아니며 수기 UI source를 확정 OpenAPI로 보지 않는다.

## 다음 세션 진행

Claude는 superpowers brainstorming을 사용해 기존 코드와 문서를 먼저 읽고,
핵심 미결 범위를 사용자에게 한 번에 한 질문씩 확인한다. 접근 방식의 대안과 권장안을
논의하고 사용자가 선택·승인한 설계 뒤에 구현 계획으로 넘어간다. 이 인수인계는 구현
승인이 아니다. 의존성 설치·baseline 검사는 설계 이후 구현 준비 시 진행한다.
현재 조정 세션의 Node는 v25.8.0이고 pnpm은 PATH에 없었다. 프로젝트 README의
지원 Node/pnpm 버전을 확인해 기존 도구 관리 설정을 사용한다.

이번 환경 준비에서 제품 코드·테스트·의존성은 변경하지 않았으며 테스트는 미실행이다.
후속 제품/구조 결정은 적절한 SDD·architecture·ADR에 기록하고 INDEX를 유지한다.

## 브레인스토밍 중간 결정 (2026-10-27, 설계 승인 전)

- 완료 장면: 실제 NAVER 서울 지도 위에 기존 라벨·핀이 뜨고 드래그·줌이 동작한다.
- Client ID·개발 origin 등록은 사용자와 함께 준비한다. 값은 `.env.local`에만 둔다.
- 좌표는 실제 지도 기준의 검토용 WGS84 좌표를 새로 만든다. 실제 경계·지적 자료가 아님을 유지한다.
- 라벨·핀은 커스터마이징을 위해 React overlay로 직접 그린다(SDK 마커 미사용).
- 지도 로드 실패 시 grid 대체 없이 오류 안내·재시도를 보여 준다. grid adapter는 테스트 주입용으로만 남긴다(Claude 판단).
- 드래그·휠·핀치는 SDK 제스처에 맡기는 안을 권장안으로 둔다(Claude 판단, 설계 문서에서 확정).
- NAVER 기본 POI·행정동 라벨 숨김은 다음 단계로 미룬다. [지도 탐색 결정](../product/specs/map-exploration/decisions.md)의 미결 결정에 기록했다.
- 모바일은 데스크톱 브라우저 에뮬레이션·자동 테스트까지만 확인하고 실기기는 다음 단계로 미룬다(사용자 결정).
- 실수 줌 규칙(12.5/14.5, 면 투명도)을 유지하기 위해 첫 연결부터 GL 지도(`gl: true`, GL 서브모듈)로 띄운다(사용자 결정). customStyleId는 미적용.
- 다음: Client ID 발급·origin 등록 → 버리는 spike로 GL 실수 줌·projection·드래그 중 이벤트 확인 → 설계 문서 작성·승인 → 구현 계획.

## GL spike 결과 (2026-10-27, 버리는 코드, 저장소 밖에서 실행)

`http://localhost:5173` 등록 origin에서 `maps.js?ncpKeyId=…&submodules=gl`과 `gl: true`로 확인했다.

- 인증 통과(`navermap_authFailure` 미호출), 서울 GL 지도 렌더 확인.
- 초기 zoom 12.5 유지, `setZoom(13.37)` 그대로 반영, 휠 줌 중 `zoom_changed`가 13.46→13.65처럼 연속 소수값으로 발생. 실수 줌 규칙 유지 가능.
- `getProjection().fromCoordToOffset(LatLng)`가 지도 컨테이너 기준 pixel을 반환(중심 좌표 → 컨테이너 중앙).
- `submodules=gl`과 `callback=` 비동기 로드를 함께 쓰면 `maps-gl.js`에서 `naver` 미정의 예외가 났다. loader는 callback 대신 script `load` 이후 초기화하거나 GL 준비 신호를 별도로 확인해야 한다.
- 자동화 드래그는 합성 이동이라 드래그 중 이벤트 빈도는 판단하지 않았다. overlay 동기화 빈도는 구현 시 실제 입력으로 확인한다.
