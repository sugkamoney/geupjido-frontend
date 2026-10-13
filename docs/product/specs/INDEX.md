# SDD 기능 명세 INDEX

기능별 제품 요구사항의 현재 기준은 이 디렉터리에서 관리한다. 각 기능은
해당 폴더의 `README.md`에서 시작한다.

## 작성 규칙

- `_templates/`는 기능 문서를 시작할 때 복사하는 형식이며 활성 기능 목록에는
  포함하지 않는다.
- 기능 폴더는 SDD 작업을 시작할 때만 만든다. 빈 미래 기능 폴더는 만들지 않는다.
- 기능의 네 문서가 준비되고 `README.md`가 현재 기준을 설명할 수 있을 때 이
  INDEX의 활성 기능 목록에 등록한다.

## 활성 기능

- [앱 화면 틀](app-shell/README.md) · develop 통합 완료 (PR #3) · v0.3

- [지도 탐색](map-exploration/README.md) · 검토 UI 구현·검증 완료, 실제 연동 대기 · v0.4
  - 최신 Figma·MD의 라벨/핀·선택 상세를 구현하며 실제 지도·API 연결은 별도 추적

## 문서 템플릿

- [_templates/README.template.md](_templates/README.template.md)
- [_templates/requirements.template.md](_templates/requirements.template.md)
- [_templates/acceptance-criteria.template.md](_templates/acceptance-criteria.template.md)
- [_templates/decisions.template.md](_templates/decisions.template.md)
