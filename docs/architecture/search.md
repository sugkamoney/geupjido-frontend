# 검색 구조와 실행 계획

> 상태: 검토용 구현·검증 완료, 실제 API/SDK 연결 대기 · 버전: 0.2 · 갱신: 2026-10-14

제품 기준은 [검색 SDD](../product/specs/search/README.md)다. 이 문서가 inline 실행 계획과 검증 기록을 겸한다. 사용자 지정 workspace/feature/search를 유지하며 origin/feature/map-exploration 63c0c74에 stack한다. 시작 HEAD는 검색 핸드오프 문서 f82d708이다. push/PR/merge는 이번 요청 밖이다.

## 데이터·상태 경계

백엔드 develop dfb7cc4282979232f616113dd25704ee0b38b405를 2026-10-14 읽기 전용 tree 검사했다. OpenApiConfig는 있으나 공개 product/search controller는 없다. SearchSource.search(query, signal)는 viewport와 무관한 전체 후보에서 그룹 결과를 반환하는 교체 가능한 비동기 프런트엔드 계약이다. backend-generated OpenAPI가 아니다. fixture 소스는 기존 지도 전체 fixture를 사용하며 실제 가격/급지/좌표로 주장하지 않는다.

model.ts는 원문 위치 대응·부분 일치·정렬·제한을 담당한다. use-search.tsx는 query/open/active 결과와 IME, 취소·stale 응답, 로딩/실패·재시도를 담당한다. search-results.tsx는 그룹/option과 강조·pointerup을 담당한다. AppShell의 기존 SearchField·전체 모바일 편집을 확장 슬롯으로 재사용한다. ExplorationPage는 기존 zoneId/apartmentId와 selectLabel/selectApartment를 유일한 지도 선택 상태로 유지한다. 검색 단지는 소스가 권역 정보와 함께 제공하므로 viewport 결과에 없어도 상세와 overlay에 연결한다.

## 실행 계획

Goal: 이름 검색으로 기존 지도·상세를 탐색한다. Stack: React/TypeScript, 기존 CSS components 레이어·토큰, Vitest/RTL/Playwright. 새로운 의존성/작업공간은 추가하지 않는다.

### Task 1: 검색 모델

파일: src/features/search/model.ts, model.test.ts. matchCatalog(data, query): SearchGroup[], highlightParts(text, query): HighlightPart[]를 제공한다.

- [x] 공백/대소문자·원문 강조, 이름/구+권역/접미사, 순서/동률, 그룹/5·3·6 제한, 빈 값/없는 값 테스트를 먼저 쓰고 실패 확인.
- [x] 모델 구현 후 해당 테스트·전체 단위 검사 통과 확인.

### Task 2: 검색 UI와 선택 연결

파일: src/features/search/{source,use-search,search-results,search.css}, app-shell/{types,shell-search,app-shell}, exploration-page. SearchSource.search(query, signal): Promise<SearchGroup[]>를 소비한다.

- [x] 실제 ShellSearch/ExplorationPage 통합 검사로 IME·229·방향키·Enter·Escape·clear·pointerup·화면 밖 선택·요청 경합 실패 확인.
- [x] 기존 검색 슬롯에 optional interaction 계약을 추가하고 기존 preview 소비자는 유지. 목록 ID/aria-activedescendant·listbox/group/option, 입력 focus 유지, 모바일 선택 시 편집 닫기 연결.
- [x] 기존 selectLabel/selectApartment와 motion/frame 경계를 재사용. 전체 단위 검사 통과.

### Task 3: 검증·문서·커밋

- [x] frozen baseline, pnpm check 후 브라우저 검사를 순차 실행한다. 포트 사전 확인.
- [x] desktop/mobile 결과·빈 결과·짧은 높이·scroll·touch·focus·IME와 기존 gesture 회귀를 검사하고 Figma 대조.
- [x] 전체 diff 리뷰, 실패 보완, SDD/INDEX/현황·기대/실제/제약 기록 후 한국어 로컬 커밋.

## 리뷰 초점

IME compositionend 직후 Enter/229, 공백을 포함한 복합 강조, 요청 취소 후 stale 완료, 선택 직후 사라지는 option의 focus, 모바일 scroll 후 pointerup을 확인한다. 외부 API/SDK와 fixture 검증은 분리한다.

## 데이터·접근성 구현 결과

선택 완료 render callback의 `finishSelection`은 결과/모바일 편집을 닫고 입력으로 focus를 복원한다. 새 상세의 focus는 AppShell의 기존 effect가 닫기 버튼으로 옮긴다. 재시도용 `focusInput`은 편집을 닫지 않는다. 결과는 combobox/listbox/group/option, aria-expanded/controls/activedescendant/selected를 제공하고 옵션을 Tab 순서에서 제외해 입력에서 방향키로 이동한다. 포인터 origin은 제거될 option이 아닌 입력이다.

모델은 정규화된 UTF-16 단위마다 원문 code point의 start/end를 저장한다. 공백 제거·소문자 변환으로 길이가 바뀌어도 원문 span으로 굵게 표시한다. 구+권역은 매칭한 복합 원문 span을 구와 권역 이름에 분리 대응한다. 이름 길이는 원문 code point 수이며 동률 ID는 locale에 의존하지 않는 문자열 비교를 사용한다. ID는 그룹 내 고유해야 하고 단지는 권역 참조와 함께 공급되어야 한다. 유효한 권역 참조가 없는 fixture 단지는 검색에서 제외한다.

SearchSource는 AbortSignal을 받고 입력마다 즉시 호출된다. 이전 effect의 signal을 취소하고 응답의 query/source/retry/입력 revision 식별을 확인하며, 취소를 무시하는 소스의 완료도 effect generation을 통해 배제한다. 로딩/조회 실패를 결과 없음과 구별하고 동일 query 재시도 때 입력 focus를 복원한다. 소스가 제공하는 후보는 전체 검색 범위여야 한다. 현재 보이는 지도 단지 응답을 전체 검색 catalog로 재사용해서는 안 된다. [지도 fixture 경계 ADR](../history/ADR-005-map-fixture-boundary.md)을 유지한다.

실제 SDK/API smoke는 제품 endpoint/운영 adapter 미연결로 미실행이다. geometry·급지·지표는 fixture 검증이며 운영 데이터 정확성을 증명하지 않는다. 실제 iOS/Android 키보드·IME·VoiceOver와 주소창/회전은 물리 기기 접근이 없어 미실행이다. Playwright desktop Chromium/Pixel 7 Chromium/iPhone 13 WebKit engine 검사는 실제 Chrome/Edge/Safari 최신 안정 버전 보장을 대체하지 않는다. 최소 viewport·OS 정책은 대기다.

## 실행 검증

코드 작성·수정은 100% AI다. pnpm check와 browser는 dist 경합을 방지해 순차 실행한다. 지도 검토 workspace가 4173을 사용해 검색은 빈 4175에서 검사했다. PLAYWRIGHT_PORT를 지원하고 기존 서버 재사용을 끄므로 다른 workspace를 검사하지 않는다. 내장 브라우저는 sandbox metadata 초기화 오류로 실패해 프로젝트 Playwright로 대체했다. 테스트 preview만 종료하며 지도 workspace와 서버는 보존한다.

| 검사                       | 기대                                                          | 실제                                 |
| -------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| frozen 설치                | package/lock 변경 없음                                        | 통과, pnpm 11.13.0                   |
| baseline check             | 기존 품질 gate/42 tests/build                                 | 통과                                 |
| baseline browser           | 기존 지도·시트·UI 회귀                                        | 61 통과, 20 플랫폼 적용 제외         |
| pnpm check                 | 토큰·타입·lint·format·60 tests/build                          | 통과, 60개 테스트와 운영 빌드 성공   |
| 최종 browser               | 검색·기존 회귀                                                | 77 통과, 25 플랫폼 적용 제외, 실패 0 |
| 정규화·강조·그룹·순서      | 5/3/6, 동률 ID, 원문 span 대응                                | 모델 5개 통과                        |
| 검색 상호작용·화면 밖 선택 | IME/229·순환·Enter·Escape·pointerup·focus, 외부 zone/apt 보완 | 통합 9개 통과                        |
| 비동기 소스                | 취소·stale 응답 배제·실패 재시도/focus                        | 4개 통과                             |

## 실패 보완과 독립 리뷰

처음 모델은 빈 구현에서 5개 assertion 실패, UI는 미연결 combobox에서 5개 실패를 확인한 후 구현했다. baseline browser 준비 시 새 테스트가 미완성 import를 참조해 build가 실패했고 기준 파일로 재실행해 61개 통과했다. 실제 검색 검증은 그 이후 완성된 소스로 수행했다. 화면 밖 단지 검사는 기존 300ms 카메라 최종 목적지를 기다리도록 보완했다. pointer 선택은 제거될 option 대신 input을 origin으로 기록한다(회귀 실패→성공).

최초 전체 browser는 72 통과/23 제외/1 실패였다. desktop type=search의 두 번째 Escape가 기본 동작으로 값을 지웠다. 값 보존 assertion으로 실패를 확인하고 preventDefault 후 blur로 수정했다. 이 기본 동작 방지와 별개로 모바일 검색의 상위 Escape handler는 결과 소비자의 stopPropagation 여부를 따르게 보완한다. 첫 Escape는 input에서 전파를 막아 결과만 닫고 두 번째는 상위 검색 편집도 닫는다. 조합 상태 ref는 참인데 native isComposing이 거짓인 Escape도 모바일에서 실패를 재현하고 전파를 차단해 IME 취소를 전체 검색 닫기로 오인하지 않게 했다. 최종 전체 브라우저 검사에서 모두 통과했다.

Figma 검색 단지 아이콘은 공통 기본 아이콘과 다른 text/tertiary 인스턴스다. 기존 도형 export geometry 검사 실패(기대16/실제10.3906px) 후 원본16×16 자산을 해당 슬롯에 적용했다. SVG path/색은 수정하지 않았다.

requesting-code-review 스킬의 독립 읽기 전용 리뷰에서 재시도 버튼 제거 시 focus 유실을 확인했다. fixture가 실패하지 않아 리뷰는 Minor로 분류했지만 교체형 비동기 소스의 키보드 흐름을 끊으므로 Important로 재분류했다. keyboard retry→input focus assertion 실패 후 focusInput callback으로 수정했다. touch option focus 후보는 실제 tap E2E와 option.focus 후 pointerup 단위 검사에서 재현되지 않았다. 선택 완료 callback의 입력 focus가 origin을 복원하므로 추가 수정하지 않았다. 초기 지적은 수정했고 추가 리뷰 보완은 아래 기록을 따른다. 실기기/실제 API·SDK/지원 최소값은 위 검증 경계로 유지한다.

## 시각 대조

Figma 메인 594:21211 screenshot과 결과 594:21324 context, 결과 없음 594:21154 context/screenshot, Components 82:4 metadata와 595:6572/595:6566 context를 확인했다. 기존 SearchField·GradeChip·Pretendard·토큰과 340×44 field/340 결과 폭/8px gap/32px 제목/40px 행/6·10px padding/Float2 shadow를 대조한다. 긴 이름/글자 확대는 행 높이를 늘려 담고 coarse pointer는 44px로 터치 목표를 확보한다. 실제 지도 바탕·지표는 fixture와 달라 전체 화면 pixel 일치를 주장하지 않는다.

모바일 확정 Figma 화면은 없어 기존 전체 검색과 모바일 참고 HTML/08-mobile 방향을 비교한다. 참고 HTML의 선택 후 query 초기화는 이번 05-search의 선택 이름 유지 정책을 따르므로 채택하지 않았다. 전체 입력/결과 스크롤·상단 닫기·지우기 방향을 재사용하고 390×320 짧은 화면을 검사한다. 실제 가상 키보드·VoiceOver는 별도 대기다. Figma SVG 원본은 [자산 안내](../../public/assets/README.md)에 기록한다. 데스크톱 결과/빈 결과와 Chromium/WebKit 390×320 전체 검색 PNG를 시각 확인했다. 새 검색 시나리오는 16 통과/5 제외이며 기존 61 통과/20 제외를 유지한다. 25건 제외는 desktop 전용 geometry/hover/resize/frame 또는 mobile/CDP 전용 입력 검사이므로 해당 project에서 실행하지 않은 것이다. WebKit은 tap/키보드와 scroll 접근을 확인했지만 물리적 swipe나 실기기 소프트 키보드를 대신하지 않는다.

## 추가 독립 리뷰와 보완 (2026-10-14)

사용자 요청으로 requesting-code-review 스킬의 별도 리뷰어가 f82d708..f8b4168을 읽기 전용 검토했다. Critical/Minor는 없고 Important 3건을 확인했다.

| 지적                                                               | 수정                                                                                                   | 재현·검증                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 모바일 편집을 닫은 focused 입력에서 입력/방향키가 숨은 결과만 연다 | 입력 변경·결과 이동이 기존 전체 편집 상태도 열게 연결, IME가 소비한 키는 제외                          | Chromium trusted 입력 재현, Chromium/WebKit type/arrow 회귀 실패→수정            |
| 이미 열린 상세에서 검색 선택해도 최초 지도 origin을 유지한다       | 실제 검색 선택 완료 callback에서 입력을 detailOrigin/interactionOrigin으로 기록, 단순 닫기는 별도 유지 | 다른 권역·같은 권역·단지 3개 단위 검사 실패→성공                                 |
| A→B→A 또는 A→빈 값→A에서 완료된 옛 A 응답이 다시 유효해진다        | 입력 revision을 state/응답 식별과 effect dependency에 포함, 현재 요청 결과만 표시                      | deferred source의 두 roundtrip에서 옛 option/Enter 선택 배제·로딩 확인 실패→성공 |

모바일 구 선택 후 재진입 확장 검사에서 후속 호환 mousedown이 사라진 결과 행 아래의 지도에 focus를 주는 경로도 재현했다. 결과 pointerdown 기본 동작을 취소해 호환 마우스 focus 전달을 차단하고 기존 touch-action:pan-y와 결과 스크롤 회귀로 스크롤 보존을 검증했다. 이 변경은 pointerup 1회 선택 및 키보드/보조기술의 click 활성화를 유지한다. 배치 전환에서도 전체 편집만 닫히고 결과/ARIA가 열린 상태로 남는 회귀를 추가 재현했다. 기존 useCompactLayout 전환 callback에서 결과도 닫도록 연결해 검색어와 focus 복구는 유지한다.

리뷰가 판단을 유보한 실제 API·인증·운영 결과, NAVER SDK/좌표/실제 지표, 물리 기기 키보드/IME/VoiceOver, 모바일 지원 최소값은 기존 연동·실기기 대기 범위로 유지한다. 이번 보완은 CSS·자산을 바꾸지 않아 전체 Figma pixel 대조를 반복하지 않고 기존 geometry/자산·모바일 검사를 유지한다. 최종 check/build/E2E는 부모가 순차 실행했다. `pnpm check` 60개 테스트·타입·lint·format·토큰·운영 빌드와 전체 브라우저 77개가 통과했다(25개 플랫폼 적용 제외). 신규 5개 단위 회귀와 Chromium/WebKit 4개 재진입 회귀의 실패→성공을 확인했으며, 같은 브라우저 회귀 안에서 구 선택 뒤 focus·같은 권역 재선택·양방향 배치 전환도 검증했다. 확인된 Important 3건과 그 흐름에서 재현한 후속 경계를 모두 수정했고 남은 확정 Critical/Important/Minor는 없다. 반복 선택·source 변경·취소 무시·IME·터치 스크롤은 리뷰에서 제외하지 않았다.

## 변경 이력

| 버전 | 날짜       | 변경                                                              |
| ---- | ---------- | ----------------------------------------------------------------- |
| 0.2  | 2026-10-14 | 사용자 요청 추가 독립 리뷰와 검색 재진입·focus·응답 revision 보완 |
| 0.1  | 2026-10-14 | 검색 소스·UI·지도 연결 구현과 백엔드 경계·검증 기록               |
