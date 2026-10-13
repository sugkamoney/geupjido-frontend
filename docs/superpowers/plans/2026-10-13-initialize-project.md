# 프로젝트 초기화 구현 계획

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 데스크톱·모바일 웹 개발을 시작할 수 있는 실행·검증 기반을 마련한다.
**Architecture:** React·TypeScript·Vite SPA. Router·Query provider와 테스트 경계만 구성한다.
**Tech Stack:** pnpm, React, TypeScript, Vite, Tailwind, ESLint, Prettier, Vitest, RTL, MSW, Playwright.
**Spec:** `docs/architecture/project-initialization.md`, 기존 `frontend-foundation.md`.

## Global Constraints

- `feature/initialize-project`와 Orca workspace에서 수행한다.
- workspace 생성에는 --yolo가 지원되지 않으므로 Codex 터미널에 적용한다.
- 모바일 웹도 지원·QA 범위에 포함한다.
- API 계약·지도·검색·월드컵 화면은 후속 구현이다.

## Review Focus

- lockfile 재설치와 peer/engine 호환성
- 직접 URL 진입과 홈 복귀
- 모바일 가로 overflow와 실행 오류
- node/test/브라우저 코드의 타입 경계
- 실제 API/지도 SDK 없이 초기 앱이 시작되는지

## Task 1: 작업 환경과 도구 구성

- [x] Orca workspace·브랜치·Codex --yolo 터미널 준비
- [x] 버전·package·TS·Vite·ESLint·Prettier 구성과 의존성 설치

## Task 2: 앱 진입점과 라우트

- [x] 홈 진입·없는 경로에서 홈 복귀 테스트를 먼저 실행하고 실패 확인
- [x] provider·앱·진입점과 작은 화면에서도 가로 overflow 없는 기본 스타일 구현
- [x] Vitest 테스트 통과 확인

## Task 3: 재현 가능한 검증

- [x] 데스크톱/모바일 Chromium·모바일 WebKit의 운영 빌드 smoke test 실행
- [x] frozen lockfile 재설치, pnpm check, CI 구성과 개발 문서 검증
- [x] 현황·INDEX 갱신
- [x] 변경 리뷰
- [x] feature 브랜치 커밋
