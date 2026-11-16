# 실제 지도 경계와 모바일 SDK/API 결합 검증

> 상태: 경계 원인·모바일 브라우저 검증 완료, BE 경계 보완·실기기·시작 지연 관찰 별도 · 버전: 0.1 · 갱신: 2026-11-15

## 범위와 결론

사용자가 이 브랜치의 남은 경계 확인과 모바일 검증을 요청했다.
실제 NAVER GL과 개발 API를 사용했고 BE·상위 checkout·제품 코드는 변경하지 않았다.
키 값과 인증 query string을 로그·문서에 기록하지 않았다.

압구정의 한강 포함은 FE가 외곽선을 잘못 연결하거나 hole을 버려 생긴 현상이 아니다.
실제 API geometry가 수면 표본을 포함하며, FE는 해당 geometry를 그대로 그린다.
현재 제품 요구사항의 한강 제외는 미충족이고 BE 표시 경계 보완이 필요하다.
모바일의 검사 결과와 미검증 범위는 아래에서 브라우저 엔진·입력 종류별로 구별한다.

## 경계 대조

### 실제 응답과 SVG

대상은 `GET /api/v1/map/zones/gangnam-apgujeong`이다.
압구정 응답은 MultiPolygon 1개, ring 1개(외곽 1·hole 0), 좌표 200개였다.
화면의 SVG path도 점 200개·subpath 1개이며 `fill-rule=evenodd`다.

카메라 이동이 멈춘 zoom 15에서, 별도로 만든 NAVER GL 지도의 공개
`Map.getProjection()`으로 원본 좌표를 재투영해 표시 path의 모든 점과 비교했다.
**최대 차이는 0 CSS px**였다. 화면 geometry의 좌표 순서·개수·projection을 대조한 결과이며
모든 서비스 권역의 GIS 위상이나 원천 데이터 정확성을 검증했다는 뜻은 아니다.

또한 원본 좌표에 독립적인 점 포함 검사를 수행하고 SVG의 `isPointInFill`과 비교했다.

| 표본 | 경도·위도 | API 도형 포함 | SVG 채움 포함 | 지도 확인 |
| --- | --- | --- | --- | --- |
| 한강 표본 river-D | 127.040000, 37.532000 | true | true | 실제 NAVER 바탕에서 수면 위에 보이는 표본 |
| 선택 단지 대조점 | 127.0404997, 37.5298469 | true | true | 실제 단지 핀 위치 |
| 북쪽 외부 대조점 | 127.025000, 37.540000 | false | false | 도형 바깥 대조점. 해당 캡처 viewport 밖 |

추가 좌표 세 점도 API·SVG 포함 판정이 일치했다. 이 가운데 강변과 겹쳐 보이는 표본이나
패널 뒤에 가려지는 표본은 수면 판정의 근거로 사용하지 않았다.
수면 판정은 실제 지도 육안 대조이며 공인 수계 레이어의 교차 면적 계산은 아직 하지 않았다.

### BE 생성 경로

BE 읽기 전용 사본과 원격 develop은 모두 `a3e7a28e8a68a9ee1a7f7f60b5dc41c7122b356c`였다.
실제 배포 빌드 SHA나 DB 적재 이력까지 확인한 것은 아니다.

| BE 파일 | 확인 내용 |
| --- | --- |
| `data/location/mapping/location-mapping.json:336` | 압구정은 법정동 `1168011000` 한 개를 사용 |
| `scripts/location/download_boundaries.py:103` | VWorld `LT_C_ADEMD_INFO`, `emd_cd=11680110`, EPSG:4326으로 수집 |
| `src/main/java/com/geupjido/batch/location/reader/LegalDongBoundaryReader.java:90` | Polygon/MultiPolygon을 확인하고 geometry JSON을 전달 |
| `src/main/java/com/geupjido/batch/location/repository/LegalDongBoundaryRepository.java:22` | SRID 4326 지정·MakeValid·polygon 추출·Multi 변환. 수면 차감 없음 |
| `src/main/java/com/geupjido/batch/location/repository/LocationDataImportRepository.java:75` | 지정 법정동의 ST_Union을 zone.polygon에 저장. 수면 차감 없음 |
| `src/main/java/com/geupjido/map/repository/MapQueryRepository.java:144` | 저장 경계를 ST_AsGeoJSON(polygon, 6)으로 반환 |

압구정 전용 경계 override도 사본에서 찾지 못했다. 원본 GeoJSON은 사본에 없으며 수집 스크립트는
체크포인트를 재사용할 수 있어, 실제 적재 원본의 날짜와 현재 VWorld 원본 동일성은 확인할 수 없다.

확인한 사실을 종합하면 **서비스의 법정동 기반 geometry에 수면 제외 처리가 없는 문제**로 판단한다.
FE에서 임의의 위도선으로 자르거나 경계를 축소하지 않는다.
[BE 추가 요청 초안](map-boundary-backend-followup.md)에 적재 원본 확인·수면 제외·표시 경계 계약을 정리했다.
이 추가 요청은 아직 발송하지 않았다.

## 모바일 검증

NAVER 인증 HTTP 200·실제 GL canvas와 실제 개발 API를 확인했다.
Chrome은 macOS의 실제 GPU를 사용하는 headless Chromium + Pixel 7 에뮬레이션,
WebKit은 iPhone 13 에뮬레이션이다. 물리 Android/iPhone 결과가 아니다.
검단의 실제 단지 115개 목록으로 긴 목록도 확인했다.

| 시나리오 | Chromium 최종 결과 | WebKit 결과 |
| --- | --- | --- |
| GL 바탕·실제 API·검색 결과 탭·권역 상세 | 통과 | 통과 |
| 권역 라벨에서 시작하는 터치 드래그 | CDP trusted touch로 카메라 이동·선택 유지 | 물리 스와이프 미검증 |
| 두 손가락 핀치 | zoom 12.5→13.474004791467054 | 물리 핀치 미검증 |
| 빈 지도 두 번 탭 | zoom 13.474004791467054→14.474004791467054, 다른 권역 선택 없음 | 미검증 |
| 목록 탭→단지 선택·zoom≥15·시트 접힘 | 통과 | 통과 |
| 선택 핀 몸통에서 시작하는 드래그 | 카메라 이동·선택 유지 | 물리 스와이프 미검증 |
| 14.5 아래로 핀치 축소 | zoom 15→14.074000581443777, 선택 핀 유지 | 미검증 |
| 긴 목록 스크롤과 지도 분리 | trusted touch 스크롤, 지도 카메라 불변 | 키보드 End 스크롤 확인. 물리 스와이프와 구별 |
| 390×568에서 상세 닫기·가로 넘침 | 닫기 접근 가능·가로 넘침 없음 | 통과 |
| JS pageerror | 없음 | 없음 |

Chromium 최종 실행에서는 SDK·인증과 완료된 제품 API GET이 모두 200이었다.
시작 시 cities 요청 1건의 `ERR_ABORTED` 뒤 새 요청은 88ms에 200으로 완료됐으며,
개발 StrictMode의 요청 취소와 실제 실패를 구별했다.

### 추가 실행에서 관찰한 시작 지연

최초 두 엔진의 핵심 흐름은 통과했으나, 검사 범위를 넓힌 중간 실행에서 다음을 관찰했다.

- Chromium: 30초 뒤에도 서비스 지역 로딩 상태여서 GL 검사에 진입하지 못했다.
- WebKit: 검색·상세까지 진행한 뒤 목록 이동 검사에서 SDK 네트워크/시간 초과 안내가 나타났다.

당시 요청별 시간 기록이 없어 외부 API·SDK·브라우저 환경 중 원인을 확정하지 않았다.
제품 timeout·테스트 timeout·자동 재시도 횟수를 늘려 통과시키지 않았다.
이후 요청별 상태·시간을 수집해 엔진을 단독 실행했고 Chromium 확장 검사와 WebKit 탭·목록 검사는 모두 통과했다.
WebKit 최종 실행도 SDK·인증·완료된 제품 API GET이 모두 200이었고 cities 재요청은 148ms에 완료됐다.
시작 지연은 삭제하지 않고 재발 관찰 항목으로 남긴다.

## 재현과 증거

이번 점검 스크립트는 Git에서 제외되는 `.superpowers/manual-review/`에 둔다.
읽기 GET과 독립 브라우저만 사용하며 서버 투표·게임 시작은 실행하지 않는다.

```sh
node .superpowers/manual-review/verify-boundary.mjs
node .superpowers/manual-review/verify-mobile-sdk.mjs mobile-chromium
node .superpowers/manual-review/verify-mobile-sdk.mjs mobile-webkit
```

이 스크립트와 `/private/tmp/geupjido-*-audit-20261115.json`, PNG는 현재 workspace/기기의
임시 증거이며 새 checkout에 자동 전달되지 않는다. 이 문서에 방법·관측값·제약을 보존한다.
인증 query string이나 Client ID를 포함하는 trace/HAR는 저장하지 않았다.

## 다음 확인

- BE 표시 경계에서 한강 수면 제외. 단지 배정용 경계까지 변경할지는 BE 설계에서 구분한다.
- 실제 적재 원본·공인 수계와의 비교 및 다른 강변 권역 확인.
- 모바일 시작 지연 재발 여부와 요청 단계별 시간 수집.
- 물리 기기의 soft keyboard·VoiceOver·WebKit 스와이프/핀치 및 장시간 사용 검증.

## 변경 이력

| 버전 | 날짜 | 변경 |
| --- | --- | --- |
| 0.1 | 2026-11-15 | 실제 API/SVG 경계 대조, BE 원인 경로, 실제 모바일 GL/API 검증과 시작 지연 기록 |
