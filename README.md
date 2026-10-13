# 급지도 프론트엔드

React·TypeScript·Vite 기반 데스크톱·모바일 웹 프로젝트입니다.

## 시작하기

Node 24.15.0(또는 지원되는 Node 26 이상), pnpm 11.13.0을 사용합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

기본 개발 주소는 `http://localhost:5173`입니다. `/api` 요청은 로컬 백엔드
`http://localhost:8080`으로 전달됩니다. 초기 앱은 API·지도 키 없이 실행됩니다.
지도 연동 시 `.env.example`을 참고해 `.env.local`에 공개 Client ID만 설정합니다.

## 검사와 빌드

```sh
pnpm check
pnpm exec playwright install chromium webkit
pnpm test:e2e
pnpm build
pnpm preview
```

`pnpm test:watch`는 단위·컴포넌트 테스트를 계속 실행합니다.
브라우저 테스트는 데스크톱 Chromium, 모바일 Chromium·WebKit의 smoke 환경이며
정식 모바일 지원 브라우저·최소 화면 확정을 대신하지 않습니다.

## 문서

- [문서 안내](docs/INDEX.md)
- [프로젝트 초기화](docs/architecture/project-initialization.md)
- [플랫폼 지원 범위](docs/product/platform-support.md)
- [디자인 핸드오프 기준](docs/product/design-handoff.md)
