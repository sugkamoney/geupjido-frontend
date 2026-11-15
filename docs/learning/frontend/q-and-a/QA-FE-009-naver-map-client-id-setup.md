# QA-FE-009: NAVER 지도 Client ID는 어디서 발급하고 어떻게 설정하는가?

> 상태: 공식 가이드·프로젝트 코드·실제 인증 확인 · 버전: 0.3 · 갱신: 2026-11-15

## 질문

실제 데이터가 연결된 급지도 웹에서 NAVER 지도 바탕을 사용하려면 어떤 키와 설정이 필요한가?

## 답변

NAVER Cloud 콘솔의 VPC 환경에서 Application Services → Maps → Application으로 이동한다.
Maps 이용 신청을 완료하고 Application을 등록하며 API는 Dynamic Map을 선택한다.
웹으로 사용할 주소를 서비스 환경의 Web 서비스 URL에 등록한다.
등록한 Application의 인증 정보에서 Client ID를 확인한다.

Client ID는 브라우저 SDK 인증에 사용하는 식별자이며 Client Secret과 구별한다.
등록한 웹 주소와 실제 접속 환경이 다르면 인증에 실패할 수 있다.
로컬·배포 환경별로 허용 주소를 관리하고 실제 키나 민감한 설정은 문서에 저장하지 않는다.
개발 원본에 `.env` 파일이 Git 제외돼 있으면 새 workspace에 키가 자동 복사되지 않는다.

## 급지도에서의 적용

현재 웹 SDK loader는 `ncpKeyId`에 `VITE_NAVER_MAP_CLIENT_ID`를 전달한다.
현재 로컬 브라우저 접속 주소는 `http://127.0.0.1:5173`이지만, 공식 인증 문제 해결 가이드는
Web 서비스 URL에서 포트와 경로를 제외하도록 안내한다. 콘솔에는 `http://127.0.0.1`과
`http://localhost`를 등록한다. 브라우저에서는 계속 5173 포트를 사용한다.
배포 URL이 정해지면 해당 호스트도 등록해야 한다. 최초 포트를 포함한 등록 안내는 이 기준으로 정정한다.

이 workspace의 `.env.local`에서 다음 두 항목을 설정한다. 기존 API 프록시 대상 설정은 유지한다.

```dotenv
VITE_NAVER_MAP_CLIENT_ID=발급한_Client_ID
VITE_MAP_PROVIDER=naver
```

Client Secret은 FE에 넣지 않는다. 지도 Client ID와 지도 조회 BE의 프록시 대상은 서로 다른 설정이다.
환경 설정 후 개발 서버를 재시작하고 등록한 주소에서 지도가 표시되는지 확인한다.
SDK는 이미 GL 초기화를 지원하며 예시 바탕을 실제 지도 타일로 전환한 뒤 API 데이터와 위치를 대조한다.

## 근거

- [NAVER Cloud Application 등록·인증 정보](https://guide.ncloud-docs.com/docs/application-maps-app-vpc)
- [Maps 이용 순서](https://guide.ncloud-docs.com/docs/application-maps-procedure)
- [Maps 인증 오류: 서비스 URL의 포트·경로 제외](https://guide.ncloud-docs.com/docs/application-maps-troubleshoot)
- `src/features/map-exploration/naver/loader.ts`, `map-provider.ts`
- [실제 API 화면 연결](../../../architecture/map-api-ui-integration.md)

## 확인 기록

2026-11-15 사용자가 키를 설정한 뒤 키 내용 없이 설정 여부·NAVER 모드·프록시 설정을
확인하고 개발 서버를 재시작했다. 첫 실제 SDK 검증은 인증 실패 UI와 SDK 진단의
`500 / Internal Server Error`를 표시했다. 재확인한 실제 `/v3/auth` HTTP 응답은 401이었다.
SDK 메시지 코드와 실제 HTTP 상태를 구분하며 등록 주소 오류나 잘못된 키로 단정하지 않는다.
사용자 재확인 요청 뒤 실제 인증 HTTP 200과 GL canvas 표시를 확인했다.
desktop 실제 GPU 기반 Chromium에서 실제 API의 구 선택·권역 검색·단지 선택·드래그를 확인했다.
외부 콘솔에서 사용자가 수정한 정확한 항목은 확인하지 않았으므로 실패 원인을 포트나 키로 확정하지 않는다.
키 값과 인증 요청의 query string은 로그·문서에 남기지 않았다.

## 변경 이력

| 버전 | 날짜 | 변경 |
| --- | --- | --- |
| 0.3 | 2026-11-15 | 재확인에서 인증 200·실제 GL 지도와 API 결합 확인 |
| 0.2 | 2026-11-15 | 공식 인증 문제 해결 기준으로 등록 URL의 포트 제외 정정, 키 적용 후 SDK 오류 기록 |
| 0.1 | 2026-11-15 | Application 발급과 workspace 환경 설정 안내 |
