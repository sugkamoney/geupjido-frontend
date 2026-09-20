# SDD 지도 탐색 문서 구축 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 기능별 SDD 제품 문서 체계를 만들고, 지도 탐색을 첫 번째 현재 기준 제품 명세로 기록한다.

**Architecture:** docs/product/specs/는 기능 단위 제품 요구사항만 소유한다. 네 가지 템플릿을 만든 뒤 map-exploration/에서 실제 요구사항·수용 기준·제품 결정을 구체화한다. API·SDK·상태·성능 구현은 제품 문서에 복제하지 않고 아키텍처 문서로 연결한다.

**Tech Stack:** Markdown, Git

**Spec:** docs/product/sdd-document-structure.md

## Input Documents

- [Notion 서비스 기획안](https://app.notion.com/p/9564038ee1da8376a998011ae64b138c?pvs=204)
- [Notion 개발 명세](https://app.notion.com/p/7d54038ee1da82b9b70081f19f174919?pvs=204)
- docs/product/platform-support.md
- docs/superpowers/specs/2026-09-19-map-api-and-runtime-design.md
- docs/architecture/frontend-foundation.md

## Global Constraints

- 초기 정식 지원·QA 대상은 1280×720 CSS px 이상의 데스크톱 Chrome·Edge·Safari 최신 안정 버전이다.
- 모바일 웹은 접속을 차단하지 않지만 초기 출시의 정식 지원과 품질 보증 범위가 아니다.
- 제품 문서는 사용자 경험과 정책을, docs/architecture/는 API·상태·컴포넌트·SDK·오류 처리·성능·테스트 구현을 소유한다.
- README.md, requirements.md, acceptance-criteria.md, decisions.md는 모두 상단에 상태·현재 버전·최종 변경일·관련 Notion을, 하단에 변경 이력을 가진다.
- 본문에는 최신 유효 기준만 두며, 장기적 결정 근거는 docs/history/ ADR로 연결한다.
- 비밀값, 접근 토큰, 개인 사용자 데이터, 민감한 배포 정보는 문서에 기록하지 않는다.

## Review Focus

- 1280px 미만 또는 모바일에서 접속을 차단하지 않되 데스크톱 권장 안내와 지원 제한이 수용 기준에 포함된다.
- zoom 0~9, 10~13, 14~21에서 도시·권역·단지 탐색 경험이 요구사항과 수용 기준에서 일치한다.
- 지도 SDK loader 네트워크 실패, 지도 API 조회 네트워크 실패, 지도 SDK 인증 실패의 사용자 안내와 재시도 가능 여부가 다르다.
- 결과 없음 또는 결과 제한 상황에서도 경계 탐색을 유지하며, 결과 제한의 다음 행동은 미결 제품 정책으로 남긴다.
- Notion 초안의 급지·필터·검색·공유 URL 중 미확정 정책을 확정 요구사항으로 기록하지 않는다.

---

## File Structure

- Create: docs/product/specs/INDEX.md — SDD 기능 문서의 탐색 시작점과 활성 기능 목록
- Create: docs/product/specs/_templates/README.template.md — 기능 개요·범위·연결 문서 템플릿
- Create: docs/product/specs/_templates/requirements.template.md — 사용자 흐름과 반응형 범위 템플릿
- Create: docs/product/specs/_templates/acceptance-criteria.template.md — 관찰 가능한 완료 시나리오 템플릿
- Create: docs/product/specs/_templates/decisions.template.md — 확정·미결 제품 결정 템플릿
- Create: docs/product/specs/map-exploration/README.md — 지도 탐색의 목표, 범위, 출처와 기술 문서 링크
- Create: docs/product/specs/map-exploration/requirements.md — 지도 탐색의 현재 사용자 경험 기준
- Create: docs/product/specs/map-exploration/decisions.md — 지도 탐색의 확정·미결 제품 결정
- Create: docs/product/specs/map-exploration/acceptance-criteria.md — 지도 탐색 완료 판정 시나리오
- Modify: docs/product/INDEX.md — specs/INDEX.md 링크 추가
- Modify: docs/superpowers/specs/2026-09-19-map-api-and-runtime-design.md — 결과 제한 후속 UX의 미결 상태 반영

### Task 1: SDD 탐색 구조와 문서 템플릿

**Files:**
- Create: docs/product/specs/INDEX.md
- Create: docs/product/specs/_templates/README.template.md
- Create: docs/product/specs/_templates/requirements.template.md
- Create: docs/product/specs/_templates/acceptance-criteria.template.md
- Create: docs/product/specs/_templates/decisions.template.md
- Modify: docs/product/INDEX.md

**Interfaces:**
- Consumes: docs/product/sdd-document-structure.md의 기능 폴더·버전·변경 이력 규칙
- Produces: 이후 기능 SDD 문서가 복사해 채울 수 있는 네 가지 표준 Markdown 형식

- [ ] **Step 1: specs/INDEX.md의 탐색 규칙을 작성한다.**

_templates/는 문서 작성용이며 제품 기능 목록에서 제외한다는 점, map-exploration/은 최초 작성 예정 기능이라는 점, 실제 활성 기능은 완결된 README.md 링크가 생긴 뒤 등록한다는 점을 기록한다.

- [ ] **Step 2: README.template.md를 작성한다.**

상단에 상태, 현재 버전, 최종 변경, 관련 Notion의 네 메타데이터를 모두 둔다. 이어서 기능 목표, 대상 사용자, 포함·제외 범위, 관련 제품·아키텍처 문서, 변경 이력 표를 포함한다. 문서 상태 값은 제안, 확정, 대체됨만 사용한다고 안내한다.

- [ ] **Step 3: requirements.template.md를 작성한다.**

상단에 상태, 현재 버전, 최종 변경, 관련 Notion의 네 메타데이터를 모두 둔다. 사용자 흐름, 화면·상태별 동작, 정책, 데스크톱·모바일 웹 범위, 제외 범위, 변경 이력 표를 포함한다. 기술 구현은 아키텍처 문서 링크로 대체한다는 안내를 포함한다.

- [ ] **Step 4: acceptance-criteria.template.md를 작성한다.**

상단에 상태, 현재 버전, 최종 변경, 관련 Notion의 네 메타데이터를 모두 둔다. 각 항목이 사전 조건·사용자 행동·관찰 가능한 결과를 포함하도록 표 형식을 제공한다. 지원하지 않는 화면 크기·브라우저와 오류 상태도 해당 기능에 적용되면 판정 기준으로 기록한다.

- [ ] **Step 5: decisions.template.md를 작성한다.**

상단에 상태, 현재 버전, 최종 변경, 관련 Notion의 네 메타데이터를 모두 둔다. 확정 결정과 미결 결정을 분리하고, 각 항목에 상태·결정 또는 질문·근거·다음 검토 조건을 기록하도록 한다. ADR가 있으면 연결하고 단순 구현 세부사항은 이 문서의 대상이 아님을 명시한다.

- [ ] **Step 6: 제품 INDEX에서 SDD 탐색 경로를 연결한다.**

docs/product/INDEX.md에 SDD 기능 명세 항목으로 specs/INDEX.md를 추가한다.

- [ ] **Step 7: Markdown 구조를 검증한다.**

Run: git diff --check && rg -n "^# |^## 변경 이력|현재 버전|최종 변경" docs/product/specs docs/product/INDEX.md

Expected: 공백 오류가 없고, 네 템플릿과 INDEX가 모두 검색되며 각 템플릿에서 버전·변경 이력 구조를 확인한다.

- [ ] **Step 8: 템플릿 구조를 커밋한다.**

    git add docs/product/INDEX.md docs/product/specs
    git commit -m "docs: SDD 기능 문서 템플릿 추가" -m "기능별 제품 명세의 공통 형식과 탐색 INDEX를 만든다."

### Task 2: 지도 탐색의 기능 개요·요구사항·제품 결정

**Files:**
- Create: docs/product/specs/map-exploration/README.md
- Create: docs/product/specs/map-exploration/requirements.md
- Create: docs/product/specs/map-exploration/decisions.md
- Modify: docs/superpowers/specs/2026-09-19-map-api-and-runtime-design.md

**Interfaces:**
- Consumes: Notion 서비스 기획안의 급지 지도 흐름, docs/product/platform-support.md, docs/superpowers/specs/2026-09-19-map-api-and-runtime-design.md
- Produces: 지도 탐색의 사용자 경험 범위, 확정·미결 제품 결정, 이를 구현할 때 참조할 기술 문서 링크

- [ ] **Step 1: 결과 제한 UX의 기술 문서를 미결 상태로 정정한다.**

docs/superpowers/specs/2026-09-19-map-api-and-runtime-design.md에서 complex 구간의 MAP_RESULT_LIMIT 오류는 유지한다. 다만 프론트가 확대 안내를 표시한다고 단정한 문구를 제거하고, 결과 제한 후속 행동은 확대 안내·cluster 재전환·목록 제공 중 제품 정책이 확정될 때 결정한다고 기록한다. 이 변경은 이후 decisions.md의 미결 항목과 같은 상태를 유지한다.

- [ ] **Step 2: 지도 탐색 문서 세 개의 공통 메타데이터를 작성한다.**

README.md, requirements.md, decisions.md 모두 첫 부분에 아래 값을 명시한다.

    > 상태: 제안
    > 현재 버전: v0.1
    > 최종 변경: 2026-09-20
    > 관련 Notion: [서비스 기획안](https://app.notion.com/p/9564038ee1da8376a998011ae64b138c?pvs=204)

- [ ] **Step 3: 지도 탐색 README.md를 작성한다.**

목표는 사용자가 지도에서 시군구·생활권 권역·아파트 단지 순으로 현재 위치를 탐색하도록 하는 것이다. 경계 탐색, 확대에 따른 단지 탐색, cluster 선택 시 지도 중심 이동·확대를 포함하고 월드컵·랭킹·커뮤니티·관심 권역 저장은 제외한다. 권역·개별 단지의 상세 정보와 진입 방식은 미결 제품 결정으로 분리한다. Input Documents의 Notion 서비스 기획안 URL, 플랫폼 지원 범위, 지도 API·운영 기준, 프론트엔드 기반 기술 구조를 연결한다.

- [ ] **Step 4: 지원 플랫폼과 진입 경험을 requirements.md에 기록한다.**

1280×720 이상 데스크톱 Chrome·Edge·Safari 최신 안정 버전을 정식 지원으로 기록한다. 1279×719 이하 또는 모바일은 접속을 막지 않지만 “데스크톱 화면에서의 사용을 권장합니다” 안내를 표시하며 지도 조작·레이아웃 품질을 보장하지 않는다고 기록한다.

- [ ] **Step 5: 확대 수준별 탐색 경험을 requirements.md에 기록한다.**

사용자는 넓은 지도에서 시군구와 권역 범위를 이해하고 확대하면 생활권 권역을 선택하며, 충분히 확대한 상태에서만 단지를 탐색한다. zoom 0~9에서는 단지 결과를 표시하지 않고, 10~13에서는 여러 단지를 묶은 군집만 표시하며, 14~21에서는 개별 단지를 표시한다. 요청·캐시 구현은 아키텍처 문서로 연결한다.

- [ ] **Step 6: 지도 상태와 예외 경험을 requirements.md에 기록한다.**

경계와 단지 결과가 없을 때는 현재 탐색 위치를 유지하고 결과 없음 안내를 보인다. 결과 제한 시에는 경계 탐색을 유지하고, 확대 안내·cluster 재전환·목록 제공 중 어떤 다음 행동을 제공할지는 미결 결정으로 둔다. 지도 SDK loader의 네트워크 실패와 지도 API 조회 네트워크 실패에는 각각 재시도 행동을 제공하고, 지도 SDK 인증 오류에는 재시도 대신 서비스 운영 설정 확인 안내를 보인다.

- [ ] **Step 7: decisions.md에 확정 및 미결 제품 결정을 작성한다.**

초기 정식 지원이 데스크톱 웹이라는 결정, 모바일이 후속 재검토 대상이라는 결정, 시군구·권역·단지 순 탐색과 cluster 선택 시 지도 중심 이동·확대라는 결정을 기록한다. zoom 0~9, 10~13, 14~21 구분은 현재 기준이며 실제 데이터·브라우저 성능 검증 후 재검토한다고 기록한다. 결과 제한의 다음 행동, 권역·개별 단지 상세 정보와 진입 방식, 시세·민심 급지, 지역·평형·연차 필터, 통합 검색, 공유 URL은 미결로 기록한다.

- [ ] **Step 8: 지도 탐색 문서의 상호 연결을 검증한다.**

Run: rg -n "Notion|platform-support|map-api-and-runtime-design|frontend-foundation|decisions\\.md|변경 이력" docs/product/specs/map-exploration/README.md docs/product/specs/map-exploration/requirements.md docs/product/specs/map-exploration/decisions.md

Expected: 세 문서에서 출처·플랫폼·기술 문서·미결 결정·변경 이력으로 가는 연결을 확인한다.

- [ ] **Step 9: 지도 탐색의 현재 기준을 커밋한다.**

    git add docs/product/specs/map-exploration/README.md docs/product/specs/map-exploration/requirements.md docs/product/specs/map-exploration/decisions.md docs/superpowers/specs/2026-09-19-map-api-and-runtime-design.md
    git commit -m "docs: 지도 탐색 요구사항과 결정 정리" -m "첫 SDD 기능의 범위와 미결 제품 정책을 기록한다."

### Task 3: 지도 탐색 완료 기준과 제품 결정

**Files:**
- Create: docs/product/specs/map-exploration/acceptance-criteria.md
- Modify: docs/product/specs/INDEX.md

**Interfaces:**
- Consumes: map-exploration/requirements.md의 플랫폼·확대 수준·오류 경험과 decisions.md의 확정·미결 정책
- Produces: 구현·QA가 완료를 판단할 시나리오와 활성 기능 탐색 경로

- [ ] **Step 1: 정상 탐색 수용 기준을 작성한다.**

먼저 acceptance-criteria.md 첫 부분에 다음 메타데이터를 명시한다.

    > 상태: 제안
    > 현재 버전: v0.1
    > 최종 변경: 2026-09-20
    > 관련 Notion: [서비스 기획안](https://app.notion.com/p/9564038ee1da8376a998011ae64b138c?pvs=204)

이어서 1280×720 지원 viewport에서 사용자가 지도를 이동·확대해 시군구/권역 경계를 확인하는 시나리오를 작성한다. zoom 9에서는 단지 결과가 없고 10에서 군집이 표시되며, 13에서는 군집이 유지되고 14와 21에서는 개별 단지가 표시되는 경계값을 포함한다. cluster를 선택하면 지도 중심이 해당 위치로 이동하고 확대되는 시나리오를 포함한다. 권역·개별 단지의 상세 진입은 미결이므로 완료 조건에 넣지 않는다.

- [ ] **Step 2: 화면 크기와 결과 없음 수용 기준을 작성한다.**

1279×719 viewport와 모바일 브라우저에서 접근은 가능하지만 “데스크톱 화면에서의 사용을 권장합니다” 안내가 보이는 시나리오, 1280×720 viewport에서 그 안내 없이 지원 화면이 보이는 시나리오를 작성한다. 현재 viewport에 단지가 없을 때 경계 탐색을 유지하며 결과 없음 안내가 보이는 시나리오와, 결과 제한 시 경계 탐색을 유지하고 미결 정책에 따른 다음 행동 영역이 보이는 시나리오를 작성한다.

- [ ] **Step 3: 지도 실패 수용 기준을 작성한다.**

지도 SDK loader 네트워크 실패와 지도 API 조회 네트워크 실패 각각에서 재시도할 수 있고 성공하면 지도 탐색으로 복귀하는 시나리오를 작성한다. 지도 SDK 인증 실패 시 재시도 버튼 대신 운영 설정 확인 안내가 보이는 시나리오를 작성한다.

- [ ] **Step 4: specs/INDEX.md에서 지도 탐색을 활성 기능으로 연결한다.**

활성 기능 목록에 map-exploration/README.md 링크, 상태, 현재 버전과 한 줄 설명을 추가한다.

- [ ] **Step 5: 문서 간 완결성과 형식을 검증한다.**

Run: git diff --check && rg -n "^> 상태:|^> 현재 버전:|^> 최종 변경:|^> 관련 Notion:|^## 변경 이력" docs/product/specs/map-exploration && rg -n "map-exploration" docs/product/specs/INDEX.md docs/product/INDEX.md

Expected: 네 지도 탐색 문서 모두 상태·현재 버전·최종 변경·관련 Notion·변경 이력을 가지며, 두 INDEX에서 기능 탐색 경로가 확인된다.

- [ ] **Step 6: 첫 번째 완결 SDD 기능 문서를 커밋한다.**

    git add docs/product/specs/map-exploration docs/product/specs/INDEX.md
    git commit -m "docs: 지도 탐색 수용 기준과 결정 추가" -m "지도 탐색의 완료 시나리오와 후속 제품 결정을 관리한다."

## Plan Self-Review

- Spec coverage: 기능 폴더 구성·템플릿·버전 이력·제품/기술 경계는 Task 1에, 첫 기능 문서와 데스크톱/모바일 범위 및 결과 제한 정책 정합성은 Task 2에, 수용 기준·탐색 INDEX는 Task 3에 대응한다.
- Placeholder scan: 각 작업은 문서 경로, 작성 내용, 검증 명령, 커밋 범위를 지정한다.
- Type consistency: 코드 인터페이스를 만들지 않으며 모든 문서 경로는 File Structure와 각 Task에서 같은 이름을 사용한다.
- Review Focus: 다섯 위험은 Task 2의 플랫폼·확대·오류 요구사항과 Task 3의 화면 크기·결과 없음·실패 수용 기준으로 검증한다.
