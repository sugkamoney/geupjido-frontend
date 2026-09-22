# 지도 API·운영 기준 설계

> 상태: **확정** · 날짜: 2026-09-22

## 목적

급지도 프론트엔드는 NAVER Maps 기반의 데스크톱 Vite SPA로 시작한다. 이 문서는
지도 데이터 API, 배포 경계, 지도 SDK의 실행 기준과 플랫폼 품질 기준을 정해
프론트엔드와 Spring Boot 백엔드가 같은 계약으로 구현하도록 한다.

초기 제품의 지도 탐색은 시·권역 경계를 표시하고, 충분히 확대한 뒤 아파트
단지를 탐색하는 흐름을 제공한다. 모바일 웹은 정식 지원과 품질 보증 범위에서
제외한다.

## 범위와 제약

- 운영 웹과 API는 동일 origin에서 제공하며 API의 공개 경로는 `/api`다.
- 로컬 개발에서만 Vite 개발 서버의 `/api` 프록시를 사용한다.
- 지도 경계는 GeoJSON으로, 단지의 현재 화면 조회 결과는 경량 JSON으로 제공한다.
- OpenAPI 문서는 백엔드가 생성한 결과가 단일 기준이며, 프론트 저장소에는 그
  버전 고정 사본을 커밋한다.
- 최소 지원 viewport는 1280×720 CSS px이며, Chrome·Edge·Safari의 최신 안정
  버전을 지원한다.
- 브라우저에 지도 Client ID만 둘 수 있으며, Client Secret이나 NAVER REST API
  인증 정보는 둘 수 없다.

## API 계약

### 좌표와 식별자 공통 규칙

- 모든 지도 좌표는 WGS 84(SRID 4326)이며 GeoJSON 좌표 순서는
  `[longitude, latitude]`다.
- 지도에서 재사용하는 엔티티에는 문자열 `id`를 제공한다. GeoJSON `Feature.id`와
  `properties.id`는 같은 값을 사용한다.
- `city:{city.id}`, `zone:{zone.id}`, `complex:{complex.id}`가 공개 API 식별자다.
  중괄호 안의 값은 백엔드 각 테이블의 불변 문자열 primary key이며, 프론트는
  prefix를 제거하거나 DB 내부 식별자로 대체하지 않는다.
- 지도용 응답은 DB 엔티티나 JTS 객체를 노출하지 않는 별도 DTO다.
- 지도용 응답에는 렌더링과 선택에 필요한 경량 필드만 넣는다. 상세 정보는 별도
  endpoint에서 조회한다.

### 권역 경계

`GET /api/map/boundaries?level=city|zone`은 다음 형태의 GeoJSON
`FeatureCollection`을 반환한다.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "zone:123",
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": []
      },
      "properties": {
        "id": "zone:123",
        "entityType": "zone",
        "cityId": "city:11",
        "name": "예시 권역"
      }
    }
  ]
}
```

- `level=city`의 `properties`는 `id`, `entityType: "city"`, `name`을 포함한다.
- `level=zone`의 `properties`는 `id`, `entityType: "zone"`, `cityId`, `name`을
  포함한다.
- geometry는 `Polygon` 또는 `MultiPolygon`만 사용한다.
- 응답 geometry는 지도 표시용으로 단순화한 경계다. 법적·원본 경계가 필요한
  기능은 이 endpoint에 추가하지 않는다.
- 응답은 `ETag`와 `Cache-Control: public, max-age=300, stale-while-revalidate=86400`을
  제공한다. ETag는 `level`과 경계 데이터 revision을 기반으로 만들며, 조건부 요청은
  변경이 없을 때 304를 반환한다.

### 단지 viewport 조회

`GET /api/map/complexes`는 `west`, `south`, `east`, `north`, `zoom`을 필수 query
parameter로 받는다. 선택 필터는 명시된 값만 추가한다.

- `west`와 `east`는 -180 이상 180 이하, `south`와 `north`는 -90 이상 90 이하다.
  모든 값은 유한한 10진수여야 하며 `west < east`, `south < north`를 만족해야 한다.
- `zoom`은 정수 0~21이다. 프론트는 SDK의 zoom 값을 `Math.round`로 정수화해 보낸다.
- bbox의 폭과 높이는 각각 2도 이하이고, 폭×높이는 2 제곱도 이하여야 한다. 이보다
  넓은 viewport에서는 프론트가 단지 API를 호출하지 않는다.
- 서버는 활성 region에 속한 city polygon들의 합집합인 현재 서비스 지역과 bbox를
  교차시킨 뒤 조회한다. 교차 영역이 없으면 `items: []`를 반환한다. 서비스 지역은
  수도권이며, 지역 확장은 API 버전 변경 없이 가능한 데이터 변경으로 취급한다.
- 형식·범위·면적 제한을 위반한 요청은 400을 반환한다.

응답은 현재 화면에서 표시할 항목만 담으며, `items`는 최대 500개다. 결과가 이
상한을 넘는 경우 서버는 항목을 임의로 잘라 반환하지 않는다. cluster 구간에서는
  cluster를 더 큰 격자로 합쳐 500개 이하로 만들고, complex 구간에서는
`MAP_RESULT_LIMIT` 오류를 반환한다.

`MAP_RESULT_LIMIT` 이후의 사용자 경험은 아직 제품 결정이 필요하다. 확대 안내,
cluster 재전환, 목록 제공 중 어떤 행동을 제공할지는
[지도 탐색 제품 결정](../../product/specs/map-exploration/decisions.md)에서 확정한 뒤
이 문서와 OpenAPI 계약을 함께 갱신한다. 결정 전에도 프론트는 현재 경계 탐색을
유지한다.

```json
{
  "items": [
    {
      "kind": "cluster",
      "id": "cluster:12:v1:123:456",
      "longitude": 127.0,
      "latitude": 37.5,
      "count": 42
    },
    {
      "kind": "complex",
      "id": "complex:789",
      "longitude": 127.01,
      "latitude": 37.51,
      "name": "예시 단지"
    }
  ]
}
```

- `kind=cluster`는 화면을 더 확대하도록 유도하는 집계 결과이며 상세 조회 대상이
  아니다.
- cluster ID는 `cluster:{zoom}:{gridVersion}:{cellX}:{cellY}` 형식의 임시 ID다.
  viewport, zoom, 집계 격자 revision 또는 필터가 바뀌면 같은 단지 집합도 다른
  cluster ID를 받을 수 있으므로 선택 상태나 URL에 저장하지 않는다.
- cluster 좌표는 해당 cluster에 포함된, 현재 필터를 통과한 단지 위치의 산술 평균
  중심점이고 `count`는 그 단지 수다.
- `kind=complex`만 `GET /api/complexes/{id}`의 상세 조회 대상이다.
- 상세 요청은 prefix를 포함한 `complex:{complex.id}`를 경로 parameter로 그대로
  전달한다.
- `GET /api/complexes/{id}`의 상세 응답은 지도 목록·마커에 필요 없는 가격,
  세대수 등 추가 정보를 제공한다. 상세 필드는 OpenAPI에서 확정한다.
- OpenAPI는 `kind`를 discriminator로 하는 `oneOf`로 `ClusterMapItem`과
  `ComplexMapItem`을 표현한다.

## 지도 로딩과 수명주기

### 표시·조회 규칙

- 시·권역 경계는 앱 진입 후 한 번 가져와 GeoJSON Data Layer에 표시한다.
  query cache는 경계 level별로 구분한다.
- `zoom` 0~9에서는 단지 API를 호출하지 않는다. 10~13에서는 단지 API를 호출하고
  cluster 항목만 표시한다. 14~21에서는 단지 API를 호출하고 complex 항목만 표시한다.
- query key의 zoom bucket은 `10~13`에서는 `cluster:{zoom}`, `14~21`에서는
  `complex`다. 0~9에는 단지 query key가 없다.
- 정규화 bounds는 `west`·`south`를 소수점 넷째 자리에서 내림하고 `east`·`north`를
  소수점 넷째 자리에서 올림한 값이다. 프론트는 이 정규화한 bounds를 요청과 query
  key 모두에 사용한다.
- 지도 이동이 끝난 뒤 250ms 동안 추가 이동이 없을 때만 단지 조회를 시작한다.
- 새 bounds·zoom·filter 요청이 시작되면 이전 단지 요청은 `AbortSignal`로 취소한다.
- 단지 query key는 `complexes`, 정규화한 bounds, zoom bucket, filter를 모두
  포함한다.
- 응답은 요청 당시의 query key가 렌더 시점의 현재 query key와 일치할 때만 지도에
  반영한다. 취소 전에 완료된 이전 응답도 key가 다르면 버린다.
- GeoJSON을 추가할 때 어댑터는 `addGeoJson`이 반환한 SDK Feature를
  `Map<앱 Feature ID, SDK Feature>`에 보관한다. 갱신·해제할 때 이 Map에서 찾은
  SDK Feature를 `removeFeature`에 전달하고, 제거한 항목은 Map에서도 삭제한다.
  같은 데이터를 Data Layer에 누적하지 않는다.
- 경계 geometry의 단순화 정도, 단지 cluster 기준과 zoom 14 기준은 실제 데이터
  수와 브라우저 성능을 측정해 조정할 수 있다. 변경 시 이 문서와 OpenAPI 계약을
  함께 갱신한다.

### NAVER Maps 어댑터

- SDK loader는 문서 전체에서 하나의 Promise로 `ncpKeyId`를 포함한 SDK 스크립트를
  한 번만 삽입한다.
- script를 삽입하기 전에 `window.navermap_authFailure`를 등록해 NAVER 키·도메인
  인증 실패를 감지한다.
- loader 상태는 `idle`, `loading`, `ready`, `network-error`, `auth-error`로 구분한다.
  네트워크 오류는 재시도 버튼을 제공하고, 인증 오류는 재시도 대신 운영자에게
  Client ID와 허용 도메인 설정 확인을 요청하는 안내를 표시한다.
- React 컴포넌트는 지도 인스턴스, Data Layer Feature, SDK event listener를
  소유하지 않는다. 지도 어댑터가 생성과 해제를 담당한다.
- 화면이 사라질 때 어댑터는 등록한 listener를 해제하고 지도 관련 참조를 제거한다.
- `VITE_NAVER_MAP_CLIENT_ID`만 빌드 시 주입한다. Vite의 `VITE_` 환경 변수는
  브라우저에 공개되므로 Secret을 넣지 않는다.
- 지도 허용 도메인은 NAVER Cloud Platform에 운영·스테이징 도메인별로 등록한다.
- Content Security Policy를 적용하는 배포에서는 NAVER SDK 스크립트와 지도 타일에
  실제로 요청되는 도메인만 허용한다. 허용 목록은 실제 브라우저 smoke test의
  네트워크 요청으로 확인해 배포 설정에 기록한다.

## 배포와 OpenAPI 연동

### origin과 라우팅

- 운영에서는 CDN 또는 reverse proxy가 정적 SPA와 `/api/*`를 같은 origin으로
  제공한다. 이는 SSR이나 BFF 런타임을 추가하는 결정이 아니다.
- 정적 호스팅은 React Router의 비정적 경로를 `index.html`로 fallback해야 한다.
- 로컬 개발 서버는 `/api`를 Spring Boot `localhost:8080`으로 프록시한다.
- 운영에서 별도 origin이 불가피하면, 백엔드는 환경별 프론트 origin allowlist로
  CORS를 제한한다. `*`와 credential을 함께 사용하지 않는다.

### OpenAPI 스키마와 타입 생성

1. 백엔드 CI가 Springdoc OpenAPI JSON을 생성한다.
2. 생성 파일에는 백엔드 commit SHA 또는 릴리스 버전을 기록하고, 프론트는 검토된
   버전을 `contracts/openapi/geupjido-api.json`에 커밋한다.
3. 프론트 CI는 이 로컬 파일로 `openapi-typescript` 타입을 생성한다.
4. 생성 타입이 저장소의 결과와 다르면 CI를 실패시킨다.
5. 로컬 실행 백엔드와 운영 `/v3/api-docs`는 타입 생성의 입력이 아니다.

`openapi-typescript`는 컴파일 시점 타입만 제공한다. 신뢰 경계에서 런타임 응답
검증이 필요해지면 별도 validator를 도입하고, 그 시점에 도입 범위를 결정한다.

## 플랫폼과 접근성

- 정식 지원·QA 대상은 viewport 1280×720 CSS px 이상인 데스크톱 Chrome, Edge,
  Safari 최신 안정 버전이다. Safari 지원은 실제 Safari에서 smoke test한다.
- 검색, 필터, 목록, 상세 패널, 모달 등 앱 UI는 키보드로 조작 가능하고 visible
  focus를 제공한다.
- 지도 캔버스의 고급 키보드 조작은 NAVER SDK의 기본 동작 범위로 제한한다.
- viewport가 1280 CSS px보다 좁으면 앱은 차단하지 않고 “데스크톱 화면에서의
  사용을 권장합니다”라는 안내를 표시한다. 이 화면 크기는 모바일 정식 QA 대상이
  아니며 레이아웃과 지도 조작을 보장하지 않는다.

## 성공 기준

- 프론트와 백엔드가 FeatureCollection·좌표 순서·지도 식별자·단지 viewport
  요청의 같은 계약을 사용한다.
- 운영 API 요청은 브라우저 CORS 설정에 의존하지 않고 동일 origin `/api`로
  전달된다.
- 단지 수가 많아도 지도 이동마다 전체 단지 데이터를 내려받거나 Data Layer에
  중복 누적하지 않는다.
- 지도 SDK 로딩 실패와 컴포넌트 해제 후에도 오류 상태와 리소스 정리가 일관된다.
- QA 담당자가 지원 브라우저와 최소 화면 크기, 모바일의 제한 범위를 문서만 보고
  판단할 수 있다.
