# 권역 랭킹 조회

[백엔드 랭킹 계약](https://github.com/sugkamoney/geupjido-backend/blob/main/docs/architecture/ranking-tab-api.md)과 [고정 OpenAPI](api/openapi-2026-11-20.json)를 기준으로 같은 출처의 `GET /api/v1/rankings/zones`를 호출한다. 데스크톱과 모바일 웹에 같은 읽기 계층을 사용한다.

- 기본 필터는 `ALL / GRADE_1 / CURRENT`다. `COLLECTING`의 요청과 쿼리 키에는 항상 `CURRENT`를 적용한다. 필터 UI도 탭 전환 시 선택 상태를 `CURRENT`로 갱신한다.
- 런타임 검증은 생성 타입에서 선택 필드로 표시한 응답 필드의 존재와 타입을 확인한다. 두 발행 시각과 권역의 `tier`, `rank`, `previousTier`, `tierDelta`는 명시적인 `null`을 허용한다. 소수 급지와 발행 시각 원문을 보존한다.
- 권역명과 배열 순서, 지역 범위의 `rank`와 `rankTotal`은 서버 값을 사용한다. 탭 또는 정렬을 변경해도 목록 길이로 순위 분모를 다시 계산하지 않는다. 유효표, 참여자, 교차 권역 투표 집계는 마지막 발행 기준이다.
- 브라우저 요청은 `no-store`를 사용한다. TanStack Query는 적용한 세 필터를 키에 포함하고 필터별 응답을 관리한다. 조회 함수에 취소 신호를 전달하며 앞선 요청이 늦게 끝나도 현재 필터 결과에 반영되지 않는다.
- 빈 배열은 정상 결과다. HTTP 실패는 `RankingApiError`, 응답 계약 위반은 `RankingContractError`로 구분한다. 훅은 오류를 즉시 노출하고 `refetch()`로 재시도한다.

## 연결

컨테이너에서 기존 `QueryClientProvider` 아래 `useRankingZones(filters, isRankingOpen)`을 호출한다. 조회 결과의 `data`, `isPending` 또는 `isFetching`, `isError`, `refetch`를 패널 상태에 연결한다. 권역 선택 시 패널의 `onSelectZone(zoneId)`를 기존 지도 선택 흐름에 연결한다.
