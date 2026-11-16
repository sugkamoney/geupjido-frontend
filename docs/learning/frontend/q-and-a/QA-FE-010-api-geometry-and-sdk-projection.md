# QA-FE-010: 경계 데이터 오류와 지도 렌더링 오류를 어떻게 구별하는가?

> 상태: 실제 지도 대조 기록 · 버전: 0.1 · 갱신: 2026-11-15

## 질문

압구정 선택 면이 한강을 덮을 때 FE가 잘못 그린 것인지 원본 경계가 그런 것인지 어떻게 확인하는가?

## 답변

API 원본의 polygon/ring/좌표 개수와 화면 path를 비교하고, 같은 지도 카메라·크기에서
독립적인 SDK projection으로 원본을 재투영해 모든 점을 대조한다.
도형 안팎의 대조점을 정해 원본 geometry의 점 포함 검사와 실제 SVG 채움도 비교한다.
그 뒤 데이터의 수집·가공·응답 경로를 추적한다. 스크린샷만 보고 원본이나 FE를 원인으로 단정하지 않는다.

## 급지도에서의 적용

압구정 API의 좌표 200개와 SVG 200개는 독립 NAVER GL 지도의 공개 projection과
0 CSS px 차이로 일치했다. 한강 표본이 원본과 SVG에 모두 포함되고 BE에 수면 차감이 없어
표시 geometry의 보완이 필요함을 확인했다. FE에서 강 위치를 추정해 경계를 잘라내지 않는다.

처음에는 검토용 adapter의 256px 타일 Web Mercator 수식을 기준으로 비교했지만 실제 SDK와
픽셀 스케일이 달라 큰 차이가 났다. 실제 SDK용 adapter는 이미 SDK projection을 사용하고 있었다.
기준 projection을 실제 SDK로 바꾸자 일치했다. 이 최초 검사 실패는 FE 제품 결함이 아니며,
위경도 자체가 같아도 zoom 숫자만으로 서로 다른 지도 SDK의 픽셀 단위를 같다고 가정하면 안 된다.

원본의 점 포함 검사가 맞아도 원천 좌표·GIS 위상·수면 정책이 맞다는 뜻은 아니다.
API→SVG 일치와 제품 요구사항의 지리 정확성을 서로 다른 검증으로 관리해야 한다.

## 관련 자료

- [경계·모바일 검증 기록](../../../architecture/map-boundary-mobile-validation.md)
- `src/features/map-exploration/naver/naver-adapter.ts`의 `sdkProject`
- `src/features/map-exploration/map-surface.tsx`의 모든 ring path·evenodd 채움
