# 월드컵 구조·구현 계획

> 상태: 검토 UI 구현·검증 완료, 실제 API 연결 대기 · 버전: 0.2 · 갱신: 2026-10-27

제품 기준은 [월드컵 SDD](../product/specs/worldcup/README.md)다. 현재 workspace에서 직접 구현하며 추가 worktree·push·PR·merge는 하지 않는다. 코드 작성/수정은 100% AI다.

## 경계

WorldcupSource는 loadMatch(scope, cursor, signal), submit(match, choice, signal), timeline 표시 데이터를 제공하는 교체형 프론트 UI 계약이다. 백엔드 생성 계약이 아니다. 실제 API 미연결 상태를 명시한다. 2026-10-15 backend develop은 읽기 전용 조회에서 dfb7cc4282979232f616113dd25704ee0b38b405로 기존 재확인과 동일하다.

지도 선택과 월드컵 scope는 분리한다. 상세 진입 scope는 해당 zone 객체이며 source도 권역 제한을 지킨다. 타임라인은 기존 selectLabel 경계로 연결한다. AppShell에는 시작 callback과 타임라인 header slot만 확장하고 기존 sheet pointerup·검색 focus·지도 frame 계산은 유지한다.

모달은 native dialog.showModal로 top layer·배경 inert·focus trap을 사용한다. body overflow를 복원하고 닫힌 trigger가 숨겨졌으면 지도 메뉴로 focus를 돌린다. IME composition 중 Escape는 취소하지 않는다. 진행 화면 제목 focus는 최초 진입이나 기존 focus 대상이 비활성화·제거·dialog 밖일 때만 옮기고, 닫기 버튼처럼 유효한 대상의 focus는 비동기 상태 변경 뒤에도 유지한다. 비동기 요청은 AbortController와 세션 생존 flag로 응답을 차단한다. submit 동기 잠금으로 bubbling/반복 입력을 차단하며 성공 뒤에만 누적 callback을 호출한다. 진행/피드백 timer는 분리해 다음 대진 뒤에도 2.4초 피드백을 유지하고 teardown에서 모두 취소한다.

첫 설명은 geupjido.worldcup.intro.v1 키를 최초 표시 때 기록한다. 저장 접근/쓰기 오류는 catch하고 모듈 메모리 fallback을 쓴다. 개인 ID·투표 저장과 무관하다. 선택·timeline·수는 ExplorationPage 메모리 소유이며 새로고침 초기화가 잠정 가정이다.

## 실행 계획

1. source/소개 우선순위/첫 설명 저장의 실패 테스트 → 구현. source는 명시적 fixture 표시, 비율 공개/숨김·mixed·sparse 시나리오를 제공한다.
2. dialog 상태/실패/중복/취소/시간/누적 테스트 → 모달·카드·My Picks 구현. 기존 토큰·Button·grade 스타일·자산 재사용.
3. AppShell 시작·상세 비교·모바일 진입, timeline 필터/scroll/상세 연결. 화면별 브라우저 실패 테스트 → 구현.
4. pnpm check 완료 후 브라우저 검사 순차 실행, Figma/모바일 참고 대조. 검증 결과와 한계를 문서/INDEX/현황에 반영하고 커밋.

## 리뷰 초점

내부 버튼 bubbling·동기 입력 경합, 실패 후 재시도, close/reopen·scope 변경의 stale 성공, 피드백과 진행 timer 분리, focus를 잃는 disabled 버튼, 짧은 화면에서 닫기/넘김 접근, timeline 필터 scroll 보존, 모바일 shell 회귀.

## 구현 파일과 검토 시나리오

- `source.ts`는 프론트 검토 계약·취소 가능한 fixture를 제공한다. `model.ts`는 소개 문구 우선순위·조사·표현 지연만 담당한다.
- `use-worldcup.ts`는 요청/제출/결과/실패/다음 판과 타이머를 담당한다. 다음 판 요청을 시작할 때 이전 선택을 비워 재시도가 이전 투표를 다시 보내지 않게 한다. scope와 다른 응답·동일 단지 쌍은 오류로 처리한다.
- `worldcup-dialog.tsx`는 native modal과 명시적 정/역 Tab 순환, 카드·My Picks를 조합한다. WebKit의 기본 Tab 설정에서도 문서나 브라우저 chrome으로 빠지지 않게 각 이동을 제어한다. modal 아래 스크롤 잠금·배경 inert는 native top layer와 body overflow로 처리한다.
- `timeline.tsx`는 선택 필터·대진 행만 담당하며 부모의 기존 목록 scroll container를 유지한다. 칩을 바꿀 때만 scrollTo(0)한다. 높이 축소로 남는 scroll 범위가 줄면 브라우저가 허용 범위로 보정한다.
- `ExplorationPage`는 모달 열림/scope·누적 count·본인 타임라인을 소유한다. source는 갱신하지 않으며 다른 사람의 실시간 활동을 생성하지 않는다.

`/`·`/map-exploration`은 기존 검토 지도와 월드컵을 연결한다. `/worldcup?scenario=`는 별도 검토 경로로 mixed/hidden/unavailable/failure/pending/sparse/long을 선택한다. mixed는 권역·같은 권역 단지 예시를 교대로 제시하며 6:4 서버 정책을 구현하지 않는다. failure는 첫 제출만 실패, pending은 5초 지연이다. sparse는 source의 visible=false이며 행 수를 기준으로 공개 정책을 계산하지 않는다. 실제 연결에는 endpoint·생성 OpenAPI·인증·서버 idempotency·저장/집계 정책 합의가 필요하다.

## 스타일·자산과 반응형

기존 semantic 토큰과 components CSS layer를 유지한다. Button·CloseButton, grade 색/집 합성, 왕관·타임라인 그림을 재사용한다. 선택 후 disabled 버튼은 현재 성공 결과의 Primary/Subtle 모양을 보존하고 제출 잠금은 유지한다. W-01 그림은 `594:20785` image fill을 기존 타임라인 그림과 구분하고 원본 crop(width 245.7%, left −120.02%)을 적용한다. 원본 raster를 편집하지 않는다.

1920×1080에서 창 600×468은 x660/y306이고 My Picks 600×120은 y174다. 780px 미만 desktop 높이는 상단 144px 여백과 스크롤로 판·창·닫기 접근을 보장하는 잠정 배치다. 이때 viewport 중앙보다 전체 콘텐츠 접근을 우선한다. 768px 미만은 전체 화면·상단 내부 판·위아래 카드, 740px 이하 높이는 역 줄을 숨기고 세로 스크롤을 허용한다. 닫기 줄은 sticky이고 safe area 하단 여백을 둔다. 최소 지원 크기를 확정하지 않는다. 긴 단지명은 줄바꿈하고 소개는 한 줄 말줄임하되 전체 문구는 DOM에 유지한다.

## 검증 기록

baseline: frozen 설치, 기존 pnpm check 67개와 브라우저 82개 통과(29개 플랫폼 제외). 내장 Browser는 연결 시 sandbox metadata 오류로 사용하지 못해 프로젝트 Playwright로 검증한다. 4175 포트는 이 workspace의 strictPort preview가 소유하며 다른 서버를 재사용하지 않는다. 검토 dev 서버는 빈 포트 확인 후 5175를 사용했다.

단위 실패→성공: 소개 우선순위/동률/누락, 비율 표현 시간, 동기 중복 잠금과 제출 재시도, stale scope/unmount, 진행/피드백 타이머 분리, 차단된 저장, scope 불일치, 다음 판 로딩 실패의 재시도를 검증한다. 브라우저에서 native dialog Tab 이탈을 재현해 명시적 순환으로 보완했다. asset crop·성공 버튼 색은 시각 대조와 실패 회귀 후 보완했다.

초기 개발 검사에서 NODE_ENV 없이 Vitest를 직접 실행해 production React.act 오류가 났으므로 test 모드로 재실행했다. 중간 브라우저 두 실행이 겹쳐 포트 사용 중/trace 임시 파일 충돌이 발생했고 해당 결과는 최종 결과로 채택하지 않는다. 독립 리뷰 병렬 검사에서 기존 검색 1건 timeout이 있었으며 최종 check는 순차 재확인한다.

독립 읽기 전용 리뷰는 당시 코드/SDD/source/경합 처리를 검사했고 확실한 Critical/Important/Minor는 보고하지 않았다. 그 이후 시각 보완과 다음 판 재시도·scope 검증은 별도 회귀로 검증한다. 최종 전체 결과는 아래 표를 따른다.



## 최종 검증 결과

| 검사 | 기대 | 실제 |
|---|---|---|
| frozen 설치 | 잠금 파일 변경 없이 설치 | 통과, 의존성·lockfile 변경 없음 |
| `VITEST_MAX_WORKERS=2 pnpm check` | 토큰·타입·lint·format·단위·운영 build | 15파일 78개 테스트 포함 전체 통과 |
| `PLAYWRIGHT_PORT=4175 pnpm test:e2e --workers=2` | 기존 회귀와 desktop/mobile 월드컵 | 108개 통과, 33개 플랫폼 적용 제외, 실패 0 |
| 입력·비동기 | 빠른 카드/버튼/키보드 중복 차단, 실패 재시도·옛 응답 무시 | 단위·브라우저 통과, 실패 count 증가/자동 진행 없음 |
| 시간·누적 | 1.1/0.6초, 2.4초 문구, 21번째 선택 계속 | fake timer·브라우저 clock에서 통과, 20칸/21개·재열기 유지 |
| modal | 이름·focus 진입/정역순환/복귀, native inert·스크롤 잠금·IME Escape | desktop Chromium·mobile Chromium/WebKit 통과, 배경 focus 시도도 차단 |
| timeline | 양쪽 권역 연결·권역 변경 scroll 유지·칩 변경 reset·source 숨김 | desktop 통과, 모바일은 의도적으로 제공 안 함 |
| responsive·자산 | 1920 기준 치수, 800×600/320×460·긴 문구·터치·자산 로드 | 가로 overflow 없음, 닫기/넘김 접근·stacked 카드·crop·왕관/버튼 상태 통과 |

첫 무제한 병렬 `pnpm check`는 호스트 load average가 50 이상인 상황에서 기존 지도/검색 포함 8건이 5초 timeout으로 실패했다. 동시 실행 수만 2로 제한한 재검사에서 같은 78개가 모두 통과했고 이어 전체 check도 통과했다. timeout·기대 조건·재시도 수는 늘리지 않았다. 이 환경 변수는 로컬 검증 자원 설정이며 저장소의 테스트 정책을 바꾸지 않는다. check와 브라우저는 shell의 성공 조건으로 연결해 **check 종료 후** 브라우저 build를 실행했다.

33건 제외는 기존 29건과 월드컵 desktop-only 타임라인/21번째 누적 검사 2종의 모바일 project 4건이다. 모바일은 같은 상태 모델을 사용하며 선택/넘김·실패/취소·focus·짧은 화면은 별도로 실행했다. 누적 단위 검증과 21회 브라우저 경계 검증은 desktop에서 수행했다.

Figma W-01/W-02/W-03/W-03b/W-04/W-05/W-06/W-08 context·스크린샷과 timeline 하위 고해상도 context를 읽었다. production preview에서 설명 crop·중앙 창·내 선택 판·급지 공개·왕관/상대 흐림·비율 숨김/넘김·같은 권역 단지·상세 진입을 대조했다. fixture 이름·가격·비율과 기존 검토 지도는 실제 데이터나 원본 전체 화면 pixel 일치를 뜻하지 않는다. mobile WebKit의 390×844·320×460을 참고 HTML/08 MD의 전체 화면·위아래 카드·역 줄 숨김·스크롤 방향과 대조했다.

실제 기기 iOS/Android IME·소프트 키보드·VoiceOver·물리 터치·주소창/회전 조합은 장치가 없어 미실행이다. 자동화의 composition 이벤트·WebKit 기기 모사는 이를 대체하지 않는다. 실제 NAVER SDK/좌표·제품 API·인증·서버 중복 방지·집계/급지 반영과 운영 배포는 계약/키/제품 정책 연결이 없어 미실행이다. 실제 안정 버전 Chrome/Edge/Safari 전체 지원과 WCAG 색 대비 준수를 주장하지 않으며 기존 디자인 시스템의 대비 검토 사항을 유지한다.

## 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| 0.1 | 2026-10-15 | 월드컵 source/모달/누적/타임라인 구현, SDD·검증과 미확정 정책 경계 기록 |
| 0.2 | 2026-10-27 | PR 리뷰 반영: 상태 변경 시 유효한 focus를 빼앗지 않도록 제목 focus 조건 제한, pending 중 닫기 focus 유지 e2e 추가 |

검증에 사용한 이 workspace의 dev/preview 서버(5175)는 시각 대조 후 종료했다. Playwright preview(4175)도 검사 종료 시 정리됐으며 다른 workspace의 서버는 변경하지 않았다.

## PR 진행 상태

2026-10-15 후속 사용자 요청으로 feature push와 develop 대상 [PR #6](https://github.com/sugkamoney/geupjido-frontend/pull/6) 생성을 진행했다. 최초 커밋 한정 범위는 해당 후속 요청으로 확장됐다. 검토 서버(5175)는 종료했고 workspace와 브랜치는 유지한다. merge는 수행하지 않았다. PR 본문에는 기존 78개 단위/108개 브라우저 검증과 실제 기기·API 미실행 한계를 기록했다.
