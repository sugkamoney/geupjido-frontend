# 디자인 시스템 코드 기반

> 상태: 구현·로컬 검증 완료 · 버전: 1.1 · 갱신: 2026-10-13

## 목적과 경계

사용자가 구현 착수를 요청한 공통 UI 기반이다. 제품 SDD 사이클을 추가로 시작하지
않으며 지도 탐색 SDD와 API·NAVER SDK·투표 계산을 분리한다. 통합 기준은 develop이다.
React·TS strict·Vite·Tailwind의 기존 구성을 유지한다.

## 구현 순서

1. Figma 변수와 스타일을 읽고 원래 이름과 별칭을 보존한다.
   `src/styles/figma-tokens.json`은 2026-10-13 원본 읽기 스냅샷,
   `tokens.css`는 CSS 변수와 타이포 utility로 연결한다.
2. 현재 범위에서 쓰는 24/16 아이콘 및 왕관·집 그림을 로컬 자산으로 보존한다.
   Pretendard 1.3.9의 전체 400/500/600/700을 로컬 제공한다.
3. `src/components/ui/`에 Button, GradeChip, GradeStage, GradeCard,
   SearchField, CloseButton, PanelHandle, MapControl을 구현한다.
   native button/input의 속성·ref·이벤트를 유지하며 상태는 브라우저에서 유도한다.
4. `/design-system` 카탈로그에서 variant와 키보드·터치·작은 화면을 검증한다.
   홈 제품 흐름은 초기화 상태를 유지한다.
5. RTL 상호작용, 운영 빌드 Playwright, Figma 시각 대조 후 문서·커밋을 정리한다.

## 원본 확인

Foundations(`81:3`)는 현재 비어 있다. 파일의 로컬 변수 91개, 글자 스타일 21개,
effect 스타일 8개를 읽었다. Components(`82:4`)는 인스턴스 모음이다.
작업공간의 원본 세트와 Screens의 권역 상세(`594:21005`)를 확인했다.
작업공간 전체 화면을 확정 제품 화면으로 해석하지 않는다.

| 원본 | 코드 범위 | 상태 |
|---|---|---|
| Button `460:898` | Gradient / Primary / Outline / Subtle, Crown | Default/Hover/Pressed는 실제 CSS 상태. 원본은 Gradient·Outline·Subtle Pressed variant가 없음 |
| Grade Chip `453:947` | Grade 1~5, Value | 색 구간을 숫자에서 계산하지 않음 |
| Grade Stage `432:846` | Collecting / Provisional / Confirmed | 횟수 임계값 없이 명시된 Stage만 표시 |
| Grade Card `453:1026` | Grade 1~5, 외부 값·순위 문구 | 집 그림과 급지 그라데이션 |
| Search/Field `454:921` | Default / Focused / Filled | 입력·지우기만, 검색 결과·정렬은 후속 범위 |
| Close Button `459:855` | Default / Hover / Pressed | 접근 가능한 이름 필수 |
| Panel Handle `460:938` | Collapse / Expand, Default / Hover | 방향과 expanded 상태는 호출자가 제공 |
| Map Control `460:1022` | Plus / Minus / Expand, Default / Hover / Pressed | SDK 동작은 호출자 소유 |

Grade Card 5의 원본 색은 `#8AA8F5`, 칩의 `map/grade-5`는 `#94B2FF`이다.
카드 색은 컴포넌트 semantic 확장으로 보존한다. 원본 Stage의 지난 막대
`#40454C`도 semantic 확장으로 연결한다. MD의 map/land·map/water는 현재
파일 변수에 없으므로 MD 출처를 표시한 별도 semantic 값으로 둔다.

## 검증 계획과 미정 사항

native 키보드 활성화·disabled·폼 type, 검색 controlled 입력·한글 composition·지우기 후
focus, Stage 현재 단계 전달, SVG/이미지 로드, 터치 hit area, 긴 문구·좁은 폭을 확인한다.
모바일 전체 레이아웃·최소 viewport·브라우저 버전은 확정하지 않는다.
급지 범위·색 경계·단계 임계값·투표·비율 공개 정책은 구현하지 않는다.
잔여 패널/목록/지도 라벨/월드컵 컴포넌트는 실제 기능 SDD에서 검토한다.

## 토큰 대응과 변경 방법

CSS 이름은 Figma의 slash·공백을 하이픈으로, 대소문자를 소문자로 치환한다.
예: `text/primary → --text-primary`, `radius/12 → --radius-12`,
`Shadow/Float 2 → --shadow-float-2`, `Body/15 SemiBold → --type-body-15-semibold`.
색의 primitive→semantic 별칭은 CSS 변수 참조로 보존한다.
화면·컴포넌트에서는 semantic 색만 사용한다. 크기·간격·모서리·타이포·effect는
원본 이름에 대응하는 토큰을 사용하며, 44px 검색/버튼·328px 카드 같은 컴포넌트
고유 치수는 CSS에 둔다. 원본의 font weight 변수는 문자열 스타일 이름이므로
CSS font-weight에 직접 넣지 않고 생성된 `--type-*`의 400/500/600/700을 사용한다.

`semantic-extensions.css`는 원본 fill이나 MD에만 있는 값 및 접근성 확장을 둔다.
`--stage-past`, `--grade-card-5`, `--grade-card-3-end`는 원본 component fill 출처다.
`--map-land`·`--map-water`는 MD 출처다. 터치 목표 크기 44px,
disabled 글자색과 누락된 Pressed 스타일은 구현 보완이며 Figma variant라고 표시하지 않는다.

```sh
pnpm tokens:generate # JSON 스냅샷에서 CSS 재생성
pnpm tokens:check    # 생성물 일치 확인 (pnpm check에 포함)
```

Figma가 바뀌면 먼저 원본 변수·스타일을 다시 확인하고 JSON을 갱신한다.
CSS 생성물을 직접 편집하지 않는다. Tailwind에서는
`bg-surface text-primary border-divider rounded-card shadow-floating`과
`type-body-15-semibold` 등의 utility를 사용할 수 있다.

## 컴포넌트 사용

```tsx
import { Button, GradeChip, GradeStage, SearchField, PanelHandle } from '../components/ui';

<Button variant="Outline" onClick={openComparison}>이 권역 단지 비교하기</Button>
<GradeChip grade={appearanceGrade} value={displayValue} />
<GradeStage stage={stage} />
<SearchField label="지역 검색" value={query} onValueChange={setQuery} onKeyDown={handleSearchKey} />
<PanelHandle expanded={open} aria-controls="timeline" onClick={togglePanel} />
```

Button의 `variant`는 Figma Type, native `type`은 HTML 폼 type이다.
기본 `type="button"`으로 우발적 submit을 막고 필요하면 `type="submit"`을 명시한다.
모든 버튼은 native disabled·ref·이벤트·ARIA를 전달한다. Crown은 장식 이미지다.
CloseButton의 label과 SearchField의 label은 필수다. 아이콘은 장식이며 동작 이름은
버튼에서 제공한다. Icon은 현재 쓰는 24 세트 6개와 16 세트 3개를 제공한다.

### 스타일 레이어와 className

`global.css`에서 Tailwind의 레이어 순서를 선언한 뒤 카탈로그와 공통 UI CSS를
`layer(components)`로 import한다. 기본 페이지·타이포 규칙은 `base`에 둔다.
카탈로그 CSS도 global 진입점에서 가져와 먼저 레이어를 생성하는 별도 side-effect
import가 없도록 한다. 기본 타이포 → 공통 UI → 사용처 유틸리티 순으로 적용한다.

공통 UI의 root className에 `hidden`, `hidden md:block`, `w-full`을 넣으면
utilities 레이어가 기본 display·폭을 덮어쓴다. SearchField의 className은 입력을
감싸는 root에 적용된다. 컴포넌트 CSS를 레이어 없이 import하면 specificity와 무관하게
layered utility보다 우선하므로 금지한다. 토큰 변수 정의와 폰트 선언은 이 규칙의
대상인 컴포넌트 시각 스타일과 구분한다.

SearchField는 controlled 입력만 담당한다. 조합 중 입력도 전달하고 지우기 후
입력으로 focus를 돌린다. 화살표/Enter/Escape 결과 탐색, combobox 역할·listbox 연결,
결과 데이터·선택 및 외부 focus 복귀는 검색 기능의 책임이다. role을 과장하지 않고
native search input을 사용한다. 원본 Focused는 입력 focus일 때 유도하고,
Filled는 focus 없이 value가 있을 때다. 빈 값에서는 불필요한 지우기 버튼을 숨긴다.
readOnly이면 입력과 지우기를 모두 막고 지우기 버튼을 숨긴다.
GradeChip/Card는 숫자에서 급지 색을 계산하지 않고 명시적 `grade`와 표시 문자열을 받는다.
GradeStage는 `stage`만 받아 문구와 `aria-current="step"`을 표시한다.

## 자산과 시각 검증

`public/assets/`의 SVG는 원본을 수정하거나 path를 재작성하지 않았다.
download_assets의 일부 벡터는 24/16 전체 그리드가 아닌 도형 경계로 export된다.
Icon은 자연 크기를 원래 그리드 가운데 놓고 24 그리드 전체를 20으로 줄인다.
검색·닫기·패널·Gradient 버튼은 해당 원본 인스턴스의 18/20/16/14/18px export를
그대로 쓴다. 16 아이콘을 24의 축소본으로 대체하지 않는다.
MapControl은 20px 인스턴스 export를 사용하며 원본 기본 Plus는 text/secondary다.
Components의 Plus 인스턴스는 text/primary override가 있어 원본 기본을 기준으로 유지한다.
현재 SVG 색은 원본 export 색이며 임의 색상 override API는 제공하지 않는다.
다른 semantic 색이 필요한 슬롯은 해당 Figma 인스턴스 자산을 확인해 추가한다.

집 그림은 Grade Card 컨텍스트 자산(1024×325), 왕관은 Button의 이미지 fill
(1254×1254를 16×16으로 표시)이다. 집 그림은 카드 전체 cover·screen·88%로 합성한다.
Figma의 필터는 exposure −0.52, contrast 1, highlights +0.18이다.
컨텍스트 자산을 사용한 실제 screen 합성이 원본 export와 시각적으로 대응함을 확인했다.
screen 합성이 주변 surface를 읽도록 격리하지 않는다. 카드의 설계 사용처는 흰 surface다.
카드 2·5의 원본 crop transform 차이는 현재 컨텍스트와 같은 공통 cover로 표현한다.
제공 HTML의 embedded font는 제한된 글자만 포함하므로 전체 Pretendard 1.3.9를
사용한다. [원본 프로젝트](https://github.com/orioncactus/pretendard/tree/v1.3.9)와
OFL 저작권·라이선스를 `public/assets/fonts/OFL.txt`에 보존했다.
현재 범위의 파일 목록·슬롯은 [자산 안내](../../public/assets/README.md)에 기록한다.
로고·월드컵 설명 그림은 아직 사용할 화면이 없으므로 후속 범위다.

## 반응형·접근성

원본 기준 폭은 Button 220/328/349, SearchField 340, GradeCard/Stage 328이다.
모두 부모 폭의 100%를 넘지 않으며 Button·Stage 문구와 순위 문구는 줄바꿈한다.
고정 높이를 강제하지 않아 글자 확대와 긴 문구를 담는다. GradeChip은 색만이 아니라
값과 접근 가능한 급지 이름을 제공하고 단계는 색뿐 아니라 현재 단계 정보를 제공한다.
Figma 지정 급지 1·4·5의 흰 글자는 명도 대비 개선 승인이 필요한 디자인 제약이다.
임의로 색을 바꾸지 않았고 색상만으로 의미를 전달하지 않는다.
12px 급지 칩의 흰 글자 대비는 약 2.91:1 / 2.01:1 / 2.09:1,
Primary의 15px 흰 글자는 약 4.11:1이다. 일반 텍스트 4.5:1에 못 미치며
Gradient·GradeCard의 밝은 영역도 개선 검토가 필요하다. 현재 색상으로 WCAG 대비
준수를 주장하지 않는다. 제품 화면 적용 전에 디자이너와 접근 가능한 foreground/
background 변경을 검토한다. 근거는 [ADR-005](../history/ADR-005-design-system-source-and-boundaries.md).

coarse pointer에서는 닫기·패널·지도·검색 지우기 hit area를 최소 44px로 늘린다.
작은 아이콘 원본 크기는 유지한다. 검색 글자만 coarse pointer에서 16px로 늘려
모바일 Safari 입력 확대를 방지하며 desktop 15px를 유지한다.
visible focus와 native 키보드 활성화를 제공하고 hover는 hover 가능한 기기에 한정한다.
애니메이션·자동 진행을 추가하지 않아 reduced motion에서도 추가 움직임이 없다.
카탈로그 480px breakpoint는 검토 페이지의 padding 조절일 뿐 제품 모바일 정책이 아니다.

## 로컬 검증

- frozen 설치, 초기 pnpm check(2개 테스트)와 기존 브라우저 6개 통과.
- pnpm check: 토큰 생성 일치·strict 타입·lint·format·RTL 8개·운영 빌드 통과.
- 브라우저: desktop Chromium / Pixel 7 Chromium / iPhone 13 WebKit.
  기존 6개와 공통 UI 12개를 포함한 18개 시나리오를 검증한다.
- 검증 내용: 실제 Tab·Enter·터치, focus 복귀, disabled, ARIA 상태, 이미지 로딩,
  hover/pressed와 원본 치수, 320px 좁은 화면·긴 문구·200% 글자 크기 시뮬레이션.
  320px는 스트레스 테스트이며 지원 최소 폭을 확정한 값이 아니다.
- 레이어 회귀 검사: 공통 UI 8종의 `hidden`, 640/1024px에서 `hidden md:block`,
  200px block 부모에서 `w-full`을 운영 빌드로 검증한다. 원본 치수·focus·hover와
  Stage 글자 크기도 기존 검사로 유지한다. 테스트 폭은 지원 정책이 아니다.
- Figma Button/Chip/Stage/Search/Close/Handle/Map Control과 Grade Card export를
  운영 빌드·개발 브라우저 캡처에 대조했다. 숫자·순위는 카탈로그 예시다.
- macOS WebKit의 버튼 Tab 탐색은 Option+Tab으로 검사한다. 자동화는 실제 iOS
  외장 키보드·VoiceOver·브라우저 지원 버전 검증을 대체하지 않는다.
- 내장 브라우저 연결은 환경 오류로 열리지 않아 프로젝트 Playwright로 검증했다.
  개발 서버는 `http://127.0.0.1:5174/design-system`에서 실행하며 5173은 사용하지 않는다.

실제 기기·운영 호스팅·CI 실행은 후속 검증이다. push·PR·merge는 이번 요청에 없다.
별도 읽기 전용 코드 리뷰에서 readOnly 지우기 문제를 확인해 실패 테스트 후 수정했고,
긴 라벨의 200% 글자 확대 검사도 보완했다. 색상 대비 제약은 원본 디자인 재검토로 남긴다.

## 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| 1.0 | 2026-10-13 | 공통 UI 구현·토큰·원본 대응·사용법·검증과 후속 범위 기록 |
| 1.1 | 2026-10-13 | 공통 UI를 components 레이어로 import하고 기본 스타일을 base로 정리, 유틸리티·반응형 회귀 검사 추가 |
