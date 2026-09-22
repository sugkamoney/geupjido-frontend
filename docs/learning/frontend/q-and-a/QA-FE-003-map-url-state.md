# QA-FE-003: 지도 서비스는 URL 상태를 어떻게 관리하는가?

## 질문

지도를 사용하는 범용적인 서비스들은 공유·새로고침·뒤로가기 대응을 위해 URL 상태를
어떻게 관리하는가?

## 핵심 답변

일반적인 지도 서비스는 공유·복원할 가치가 있는 지도 중심, zoom, 선택한 장소나
대상의 안정적인 ID, 활성 필터를 URL에 넣는다. 검색 입력 중 값, hover, 로딩 상태,
임시 cluster처럼 일시적이거나 재현할 수 없는 상태는 넣지 않는다.

연속적인 지도 이동은 현재 history 항목을 교체해 뒤로가기 기록이 과도하게 늘지 않게
한다. 사용자가 검색 결과나 장소를 명시적으로 선택한 경우에만 새 history 항목을
추가한다. Google Maps URL은 중심·zoom·장소 식별자를 URL parameter로 표현하고,
Mapbox GL JS는 지도 카메라 상태를 URL hash와 동기화할 수 있다.

## 급지도 적용

급지도는 권역 또는 단지의 공개 ID, 지도 중심 좌표, zoom과 활성 필터를 URL에 저장한다.
cluster ID와 일시적 UI 상태는 저장하지 않는다. 지도 조작 종료 후에는 history를
교체하고, 검색 결과·권역·단지 선택 후에는 새 history 항목을 만든다.

## 관련 문서

- [프론트엔드 기반 기술 구조](../../../architecture/frontend-foundation.md)
- [지도 탐색 표시 단계](../../../product/map-exploration.md)
- [ADR-003](../../../history/ADR-003-map-frontend-state-and-contract.md)
- [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)
- [Mapbox Map API](https://docs.mapbox.com/mapbox-gl-js/api/map/)
