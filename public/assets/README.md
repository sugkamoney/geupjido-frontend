# 디자인 시스템 자산

원본: 급지도 Figma 작업공간. 생김새는 해당 인스턴스 export를 보존한다.
임시 다운로드 URL은 코드·문서에 저장하지 않는다. SVG path나 root 크기를 수정하지 않는다.

| 파일                           | 원본 노드                      | 사용처 / 표시                             |
| ------------------------------ | ------------------------------ | ----------------------------------------- |
| icons/search.svg               | 154:249                        | Icon/Search · 24 그리드를 20으로          |
| icons/plus.svg                 | 154:256                        | Icon/Plus · MapControl                    |
| icons/minus.svg                | 154:262                        | Icon/Minus · MapControl                   |
| icons/expand.svg               | 154:269                        | Icon/Expand · MapControl                  |
| icons/close.svg                | 154:316                        | Icon/Close · CloseButton hover/pressed    |
| icons/versus.svg               | 154:284                        | Icon/Versus                               |
| icons/chevron-left-16.svg      | 423:82                         | Icon/16/ChevronLeft · 16 그리드           |
| icons/chevron-right-16.svg     | 423:76                         | Icon/16/ChevronRight · 16 그리드          |
| icons/apartment-16.svg         | 423:97                         | Icon/16/Apartment · 16 그리드             |
| icons/plus-control.svg         | 460:1022 기본 variant          | MapControl 확대 · 20×20 · text/secondary  |
| icons/minus-control.svg        | 455:1042                       | MapControl 축소 · 20×20                   |
| icons/expand-control.svg       | 455:1046                       | MapControl 전체 보기 · 20×20              |
| icons/search-field.svg         | 454:921                        | SearchField 왼쪽 · 18×18                  |
| icons/close-field.svg          | 454:921                        | SearchField 지우기 · 16×16                |
| icons/close-secondary.svg      | 459:855                        | CloseButton 기본 · 20×20                  |
| icons/versus-button.svg        | 460:898                        | Gradient Button · 18×18                   |
| icons/chevron-left-handle.svg  | 460:938                        | PanelHandle Collapse · 14×14              |
| icons/chevron-right-handle.svg | 460:938                        | PanelHandle Expand · 14×14                |
| images/crown.png               | Button Crown 507:3358          | 이미지 원본 1254×1254 · 16×16             |
| images/house-screen.png        | Grade Card 453:1026 image fill | 컨텍스트 자산 1024×325 · cover/screen/88% |

Icon 원본 SVG는 도형의 경계로 crop되어 있다. 자연 치수를 유지하고 24/16 그리드에
중앙 정렬한다. 자세한 구현은 [디자인 시스템](../../docs/architecture/design-system.md)을 따른다.
왕관은 SVG Icon/Crown을 사용하지 않는다.

fonts/Pretendard-400/500/600/700.woff2는 [Pretendard v1.3.9](https://github.com/orioncactus/pretendard/tree/v1.3.9)
원본 전체 폰트이며, [OFL.txt](fonts/OFL.txt)에 라이선스·저작권을 포함한다.
제공 HTML의 subset font나 운영 CDN에 의존하지 않는다.

## 앱 화면 틀 자산

| 파일                            | 원본 노드 | 표시                          |
| ------------------------------- | --------- | ----------------------------- |
| images/shell-symbol.svg         | 594:21249 | 레일 28×30, 모바일 검색 22×24 |
| images/worldcup-intro.png       | 594:21264 | 타임라인 시작 구역 349×128    |
| icons/shell-map.svg             | 594:21252 | 레일 지도 20×20               |
| icons/shell-versus-selected.svg | 594:21253 | 레일 월드컵 20×20             |
| icons/shell-ranking.svg         | 594:21254 | 검토용 비활성 메뉴 20×20      |
| icons/shell-report.svg          | 594:21255 | 검토용 비활성 메뉴 20×20      |

SVG/PNG 원본 바이트를 보존한다. 지도·월드컵 nav의 SVG는 mask로 원본 path를
유지하고 Rail/Item 설명(`460:905`)의 text/tertiary·선택 text/brand 상태 색을 적용한다.
기존 공통 Icon 컴포넌트의 색상 API를 변경하지 않는다.

## 지도 탐색 자산

Figma `187:273` Map/Label, `490:2113` Map/Apartment Pin의 context에서 원본 SVG를 받았다. 지도 바탕 스크린샷·실제 경계는 자산으로 사용하지 않는다.

| 파일                      | 원본 노드                        | 자연 크기 / 표시                                    |
| ------------------------- | -------------------------------- | --------------------------------------------------- |
| map/label-house.svg       | 244:665 vector fill              | 86×40.6943, 기본 집 배경                            |
| map/label-selected.svg    | 272:1210 vector fill             | 88×42.6943, 흰 테두리 포함 선택 배경                |
| map/dot-1.svg ~ dot-5.svg | 244:671, 272:1185/1193/1201/1209 | 8×8, 급지별 중심 점                                 |
| map/apartment-white.svg   | 490:2102, Icon/16/Apartment      | 16×16, 28×28 몸통 안 원본 흰 아이콘                 |
| map/pin-tail.svg          | 490:2104                         | 12.4142×6.20711, 원본 inset을 10×5 꼬리 slot에 적용 |

root width/height와 path를 보존한다. `MapSurface`의 해당 slot에서 사용하며 temporary URL은 저장하지 않는다. hover 점은 원본을 담은 wrapper를 1.25배 확대한다. 공통 GradeChip/Card·지도 컨트롤·레일 자산은 기존 것을 재사용한다.

## 검색 결과 자산

`icons/search-apartment.svg`는 Figma Search/Result Row `595:6566`의 원본16×16 단지 아이콘이다. 검색 인스턴스는 text/tertiary (#9AA0A8) override를 사용하므로 text/primary 기본 `apartment-16.svg`와 구분한다. 원본 width/height를 유지하고 30×20 슬롯의 가운데에 놓는다. 검색창 search-field/close-field와 GradeChip은 기존 공통 자산·토큰을 재사용한다.
