# 프로젝트 초기화

> 날짜: 2026-10-13 · 범위: 개발·검증 실행 기반

## 범위와 작업 환경

React·TypeScript strict·Vite SPA를 pnpm으로 구성한다. React Router와 TanStack Query
provider를 앱 진입점에 두고, Tailwind Vite plugin을 연결한다. 초기 화면은 실행 확인용
홈과 없는 경로 안내뿐이다. 지도·검색·월드컵 제품 UI는 후속 작업이다.

작업 브랜치는 `feature/initialize-project`이고 Orca workspace는
`/Users/user/orca/workspaces/geupjido-frontend/feature-initialize-project`다.
Orca가 이름에 붙인 사용자 prefix는 Git 브랜치를 변경해 제거했다.
현재 Orca CLI는 `worktree create --yolo`를 거절하므로 workspace 생성 후
`codex --yolo` 터미널을 별도로 준비했다. 해당 터미널에는 구현 프롬프트를 보내지 않았다.

## 버전과 의존성

`.node-version`은 Node 24.15.0, `packageManager`는 pnpm 11.13.0을 지정한다.
패키지 직접 버전과 lockfile을 고정한다. TypeScript는 typescript-eslint와
OpenAPI 도구의 공통 호환 범위인 5.9.3을 사용한다. Node 26.3.0에서도 로컬 검증한다.
설치 시 peer 충돌을 숨기지 않도록 strict peer 검사와 engine 검사를 사용한다.

Radix는 실제 UI가 필요할 때 추가한다. NAVER SDK·타입과 OpenAPI 생성 도구도
지도 구현 및 검토된 계약 도입 시 추가한다. 백엔드 생성 계약이 없으므로 임의
OpenAPI JSON, 생성 타입, 가짜 제품 API client는 만들지 않는다.

## 코드 경계

- `src/main.tsx`: StrictMode, 브라우저 라우터, 앱 provider를 연결한다.
- `src/app/`: 라우트와 QueryClient provider를 관리한다.
- `src/styles/`: 기본 전역 스타일을 둔다. 전체 Figma 토큰은 후속 작업이다.
- `src/test/`: RTL cleanup과 MSW 서버 도구를 둔다. 제품 handler는 아직 없다.
- `e2e/`: 운영 빌드의 라우트·모바일 실행 smoke test를 둔다.

로컬 `/api`는 `localhost:8080`으로 프록시한다. 운영에서는 동일 origin `/api`와
SPA deep-link fallback이 필요하며 실제 호스팅 설정은 아직 구성하지 않는다.
`.env.example`에는 공개 지도 Client ID 자리만 둔다. `VITE_` 변수에는 Secret을 넣지 않는다.

## 검증

`pnpm check`는 타입·lint·format·Vitest·빌드를 실행한다. 기존 Markdown 문서는
포맷 검사에서 제외해 초기화 작업이 기존 문서 전체를 재포맷하지 않도록 한다.
`pnpm test:e2e`는 운영 빌드를 preview로 띄우고 데스크톱 Chromium, 모바일 Chromium,
모바일 WebKit에서 진입·없는 경로 복귀·가로 overflow·JS 오류를 검증한다.
WebKit 자동화는 실제 iOS Safari 검증을 대체하지 않는다. 모바일 최소 지원 기준은
아직 확정하지 않았으며 테스트 기기는 초기 smoke 환경이다.

CI는 frozen lockfile 설치 뒤 같은 검사를 수행한다. 실제 GitHub CI 실행 결과는
브랜치를 push하고 workflow를 실행한 뒤 확인해야 한다.

## 실행 환경 변수

현재 세션은 `NODE_ENV=production`을 상속했다. React 테스트용 `act`가 없는
production 배포본을 로드해 RTL 테스트가 실패하는 것을 확인했다. cross-env로
dev는 development, test는 test, build는 production을 명시한다. 외부 쉘 설정과
운영 빌드의 모드를 분리해 같은 명령의 실행 결과를 재현한다.

## 로컬 검증 결과 (2026-10-13)

- `pnpm install --frozen-lockfile`: 통과
- `pnpm check`: 타입·lint·format, 컴포넌트 테스트 2개, 운영 빌드 통과
- `pnpm test:e2e`: 데스크톱 Chromium·모바일 Chromium·모바일 WebKit에서 6개 통과
- 브라우저 테스트 로그의 NO_COLOR/FORCE_COLOR 안내는 출력 색 설정 충돌이며
  테스트 실패나 앱 오류가 아니다.

사용 중인 Node 26.3.0에서 실행한 결과다. GitHub CI와 실제 모바일 기기 검증은
아직 실행하지 않았다.

개발 서버는 Orca의 `Frontend dev` 터미널에서 `pnpm dev --host 127.0.0.1
--port 5173 --strictPort`로 실행하고 HTML 응답을 확인했다. 별도 읽기 전용 코드
리뷰에서 초기화 범위의 주요 문제는 발견되지 않았다. Node 24.15는 패키지 engine
범위를 만족하지만 해당 런타임으로 직접 실행한 검증은 아직 없다.
