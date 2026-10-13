# ADR-005: 제품 API 연결 전 지도 탐색의 검토 데이터 경계

> 상태: 채택 · 날짜: 2026-10-14

## 배경

최신 Figma/MD는 라벨·핀·실수 zoom·선택 상세를 요구한다. 백엔드 develop `dfb7cc4`에는 수집 기반만 있으며 제품 지도/상세 계약이 없다. 사용자는 이 상태에서도 명시적인 fixture와 공급자 대체 adapter로 선택·상세 흐름부터 구현하도록 요청했다.

## 결정

검토 화면은 가상 평면 지도와 고지된 예시 데이터를 사용한다. 지도 camera/projection과 상세 source는 UI 선택 흐름에서 분리한다. 실제 NAVER projection 및 공개 API가 준비되면 adapter/source를 교체하며 좌표계·한강 제외 geometry·표시값·목록 정렬을 확인한다. 수기 UI 타입은 잠정 계약이고 backend-generated OpenAPI 사본으로 부르지 않는다.

급지 예시 색/값은 fixture가 명시적으로 공급한다. 단계·가격·투표 집계를 산출하지 않고 미연결 상태로 표시한다. 전체 기능의 실제 연결 완료와 fixture 상호작용 검증 완료를 별도로 기록한다.

## 대안과 비용

SDK/API 계약 확정 후 UI를 시작하면 실제 지도 근거로 검증할 수 있지만 현재 선택·시트/목록·focus 검증도 지연된다. 이번 단계에서 검토 adapter를 사용하면 credentials 없이 회귀를 유지할 수 있고, 운영 adapter를 연결하는 추가 작업이 필요하다. 정적인 지도 캡처는 실제 pan/zoom·좌표·gesture 검증을 제공하지 않으므로 구현 자산으로 사용하지 않았다.

## 다음 검토

제품 API/OpenAPI와 공개 NAVER key·GL 스타일 metadata·검증된 CRS가 준비될 때 UI 계약을 실제 스키마와 대조한다. viewport 조회·캐시·debounce 및 운영 오류 분기는 그 계약에 따라 구현하고 실제 SDK smoke 결과를 별도로 남긴다.

[현재 구조·검증](../architecture/map-exploration.md), [제품 SDD](../product/specs/map-exploration/README.md)를 따른다.
