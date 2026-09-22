# 의사결정 이력 INDEX

중요한 제품·기술 결정의 맥락, 대안, 이유, trade-off와 재검토 조건을
기록한다. 현재 제품 동작이나 구현 구조는 각각 `docs/product/`와
`docs/architecture/`에서 확인한다.

## 기록 양식

```text
# 결정 제목

> 상태: 제안 | 확정 | 대체됨 · 날짜: YYYY-MM-DD · 영역: 제품 | 프론트엔드 | 프로젝트 공통

## 맥락
## 선택지
## 결정
## 이유와 trade-off
## 재검토 조건
```

## 결정 목록

- [ADR-001: 프로젝트 문서와 학습·결정 이력을 작업 중 함께 기록한다](ADR-001-documentation-recording.md)
- [ADR-002: NAVER Maps 기반 Vite SPA로 데스크톱 웹을 먼저 개발한다](ADR-002-frontend-foundation.md)
- [ADR-003: 지도 프론트엔드 상태와 API 계약을 URL·OpenAPI 중심으로 관리한다](ADR-003-map-frontend-state-and-contract.md)
