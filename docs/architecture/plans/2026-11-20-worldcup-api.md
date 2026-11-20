# 월드컵 실제 API 연동 실행 계획

> 상태: 구현·자동 검증 완료 · 버전: 1.0 · 갱신: 2026-11-20

**목표:** 인계문의 확정된 서버 계약으로 일반·권역 월드컵, 진행 현황, 공개 타임라인을 기존 지도와 연결한다.
**기준:** [제품 SDD](../../product/specs/worldcup/README.md), 배포 OpenAPI 2026-11-20, 백엔드 main, Figma 04 월드컵.
**실행:** 현재의 develop 기반 격리 worktree에서 직접 구현. 최초 범위는 커밋·push·PR·BE 수정 없음. 후속 사용자 요청으로 커밋·push·develop 대상 PR 제출을 진행한다. BE 수정·merge는 제외한다.

## 구조와 선택

URL만 교체하면 cursor 기반 예시가 서버의 고정 10판·이어하기를 표현하지 못한다. UI 전체 재작성은 기존 모달 접근성·모바일 회귀 범위를 늘린다. 기존 모달과 예시 source를 유지하고 실제 게임용 hook/API를 추가한다. 생성 타입을 재사용하되 nullable·진행 불변식은 런타임에서 검증한다. 일반/권역 API와 읽기 query key는 scope로 분리한다.

## 작업

- [x] 1. `src/features/worldcup/api/{contracts,validation,client}.ts`와 테스트: 10판/기록/다음 판/비율 불변식, 상대 URL·credentials·오류·취소를 실패→성공으로 검증한다.
- [x] 2. `use-live-worldcup.ts`와 테스트: 서버 상태를 권위로 시작/이어하기, 제출 잠금, 409 재동기화, 응답 유실 후 재조회, 10판 연결/429, 한국 날짜 변경, scope 변경·닫기 뒤 늦은 응답을 검증한다. 기존 `use-worldcup.ts`는 실제 source를 해당 hook에 위임한다.
- [x] 3. `live-data.tsx`, `worldcup-dialog.tsx`, `exploration-page.tsx`: 실제 진입·권역 대안·진행/타임라인을 연결하고 API 오류·빈 상태·모바일 전체화면·focus를 검증한다. 예시 데이터 fallback 없음.
- [x] 4. `e2e/live-worldcup.spec.ts`: 격리 mock transport로 desktop/mobile Chromium·WebKit의 실제 화면 흐름과 새로고침 이어하기를 검증한다. 공유 개발 서버에는 GET만 사용한다.
- [x] 5. 제품 4문서·architecture/API/현황/INDEX 갱신. Node24.15/pnpm11.13으로 pnpm check와 전체 E2E 실행, 알려진 미병합 PR10 회귀와 신규 실패 구분. 최종 diff 리뷰.

## 리뷰 초점

- 불확실한 PUT 뒤 재시도가 다른 게임에 투표하지 않는가.
- 409가 본인 새 선택으로 누적되지 않는가.
- 한국 자정 뒤 일반 게임이 전날 카드로 제출되지 않는가.
- 닫기·scope 전환 뒤 이전 응답/타이머가 새 화면에 영향을 주지 않는가.
- 타임라인의 좌표·급지 없는 권역을 임의 좌표로 이동시키지 않는가.

## 검증·제약 기록

- 시작 시 PR10 OPEN. 부모의 스크롤 수정 미포함.
- 실제 서버 쓰기는 격리 환경이 제공되지 않아 수행하지 않는다. HTTP mock·브라우저 모사 결과를 실서버 저장·실기기 검증으로 표현하지 않는다.

## 실행 결과

- `pnpm check`: 단위256개와 품질 gate·운영 build 통과.
- 전체 E2E:151개 통과·38개 플랫폼 제외·실패0. 격리 HTTPS 쿠키/새로고침은 세 엔진 통과.
- 독립 리뷰의 retry GET 자정 경계1건을 실패→성공으로 보완하고 재리뷰 완료.
- 타임라인 칩 reset·다른 권역 지연 조회의 스크롤 유지 회귀 통과.
- 최종 PR10 OPEN. Linux·실서버 쓰기·실기기는 미실행. 상세 제약과 결과는 [기술 문서](../worldcup.md)를 따른다.
