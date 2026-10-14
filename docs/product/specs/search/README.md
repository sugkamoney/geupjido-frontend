# 검색

> 상태: 검토용 구현·검증 완료, 실제 연동 대기 · 버전: 0.3 · 갱신: 2026-10-14

지도 사용자가 화면 밖 권역·구·단지를 이름으로 찾아 지도와 상세에 진입한다. 데스크톱과 모바일 웹을 지원한다. 월드컵·투표·급지/단계 정책은 범위 밖이다.

동작 근거는 Downloads 00-README/05-search와 03-map/04-zone-detail/08-mobile이다. 시각 근거는 [Figma](https://www.figma.com/design/VB4hekcKLXEAyuFPu4zhVU?node-id=594-21211)와 [결과 없음](https://www.figma.com/design/VB4hekcKLXEAyuFPu4zhVU?node-id=594-21154)이다. 관련 Notion 문서는 이번 핸드오프에 제공되지 않았다.

[요구사항](requirements.md) · [인수 기준](acceptance-criteria.md) · [결정](decisions.md) · [검색 구조·실행 계획](../../../architecture/search.md) · [지도 구조](../../../architecture/map-exploration.md).

## 변경 이력

| 버전 | 날짜       | 변경                                                                      |
| ---- | ---------- | ------------------------------------------------------------------------- |
| 0.3  | 2026-10-14 | 지도 PR #4의 develop 통합 후 검색·최신 상세 표시 회귀 검증                |
| 0.2  | 2026-10-14 | 추가 독립 리뷰의 모바일 재진입·상세 복귀 focus·동일 검색어 응답 경합 보완 |
| 0.1  | 2026-10-14 | 검색 SDD·검토용 구현·검증, 핸드오프 기준과 빈 검색어 정책 기록            |
