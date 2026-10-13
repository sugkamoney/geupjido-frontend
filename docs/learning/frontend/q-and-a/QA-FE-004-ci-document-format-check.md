# QA-FE-004: 문서 변경만 병합했는데 Frontend CI가 왜 실패했나?

> 날짜: 2026-10-13

## 질문

PR #2에서 develop의 PR 템플릿을 병합하고 문서 INDEX 충돌만 해소했는데
Frontend CI가 실패한 이유는 무엇인가?

## 핵심 답변

CI는 앱 코드뿐 아니라 품질 명령의 검사 대상 파일도 확인한다.
이 프로젝트의 `pnpm check`는 Prettier 검사를 포함하고,
`pnpm format:check`는 `prettier --check .`로 실행한다.
문서라는 이유만으로 검사에서 제외되지 않으며 실제 제외 경로는
`.prettierignore`가 정한다.

## 급지도 프로젝트에 적용

develop에서 추가된 `.github/pull_request_template.md`의 빈 테스트 표가
저장소 Prettier 포맷과 달라 workflow 38349903736이 exit code 1로 실패했다.
토큰·타입·lint는 통과했지만 format에서 중단돼 이후 테스트·빌드는 실행되지 않았다.
로컬 `pnpm format:check`에서도 동일하게 재현했다.

`docs/`와 `AGENTS.md`는 제외되지만 `.github/`는 검사 대상이다.
따라서 이 병합은 앱 코드를 바꾸지 않았어도 새로운 포맷 검사 대상을 추가했다.
이전 코드 검증 결과만으로 병합 후 CI 통과를 판단할 수 없다.
템플릿을 `pnpm exec prettier --write .github/pull_request_template.md`로 정리했다.
사용자가 이어서 실행한 `pnpm check`는 포맷·테스트 8개·운영 빌드까지 통과했다.
원격 CI 결과는 수정 커밋을 push한 뒤 별도로 확인한다.

## 관련 파일과 근거

- [Frontend CI](../../../../.github/workflows/ci.yml)
- [포맷 검사 제외 설정](../../../../.prettierignore)
- [실패 workflow 로그](https://github.com/sugkamoney/geupjido-frontend/actions/runs/38349903736/job/115139680319)
