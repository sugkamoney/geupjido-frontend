# QA-FE-005: 로컬 터치 검사는 통과했는데 Linux CI는 왜 실패했나?

> 날짜: 2026-10-13

## 질문

PR #3의 앱 화면 틀을 macOS에서 검증했는데 Frontend CI가 다시 실패한 이유는 무엇인가?

## 핵심 답변

포인터 이벤트와 호환 click은 별개다. 터치·펜의 드래그와 탭을 pointer 이벤트로
추적하면서 탭 완료만 click에 맡기면, 브라우저가 그 click을 생성하지 않는 입력 순서에서
조작이 빠진다. 테스트가 로컬에서 통과해도 다른 OS의 입력 합성 결과까지 보장하지 않는다.

## 급지도 프로젝트에 적용

최초 CI의 품질 검사는 통과했다. 모바일 Chromium에서 손잡이를 위로 끌어 펼친 뒤
탭으로 접는 시나리오만 최초·재시도 2회 모두 실패했다. macOS는 CI 옵션으로 5회 통과했다.
같은 Playwright 1.64.0 Ubuntu arm64 컨테이너에 운영 빌드를 넣어 10회 모두 실패시켰다.
실제 이벤트 로그는 다음 탭에서 pointerdown과 pointerup을 보냈지만 click은 보내지 않았다.

손잡이는 터치·펜 pointerup에서 이동량에 따라 드래그/탭을 한 번 처리하도록 수정했다.
이후 오는 호환 click은 무시해 이중 전환을 막는다. 마우스 click과 detail=0인
키보드/접근성 활성화는 유지한다. click이 없는 탭도 상태를 바꾸는 회귀 2개를
실패→성공으로 확인했고, 수정된 운영 빌드의 Linux 재현은 10회 통과했다.
이는 실제 모바일 기기·VoiceOver 검증을 대체하지 않는다. GitHub runner는 amd64이므로
수정 push 뒤 원격 CI 결과도 확인한다.

## 관련 파일과 근거

- [시트 입력 처리](../../../../src/components/app-shell/shell-panels.tsx)
- [클릭 누락 회귀 검사](../../../../src/components/app-shell/shell-panels.test.tsx)
- [터치 브라우저 검사](../../../../e2e/app-shell.spec.ts)
- [첫 실패 CI](https://github.com/sugkamoney/geupjido-frontend/actions/runs/38356143404)
- [현재 PR 검사](https://github.com/sugkamoney/geupjido-frontend/pull/3/checks)
