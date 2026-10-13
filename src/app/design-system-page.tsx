import { useState } from 'react';
import {
  Button,
  CloseButton,
  GradeCard,
  GradeChip,
  GradeStage,
  Icon,
  iconNames,
  MapControl,
  PanelHandle,
  SearchField,
  type Grade,
} from '../components/ui';

const grades: Grade[] = [1, 2, 3, 4, 5];
export function DesignSystemPage() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [zoom, setZoom] = useState(0);
  return (
    <main className="ds-page">
      <header>
        <h1>디자인 시스템</h1>
        <p>공통 UI 검토용 카탈로그 · 아래 급지와 순위는 표시 예시입니다.</p>
      </header>
      <section className="ds-section" aria-labelledby="buttons-title">
        <h2 id="buttons-title">Button</h2>
        <div className="ds-buttons">
          <Button variant="Gradient">월드컵 시작</Button>
          <Button>시작하기</Button>
          <Button variant="Outline">이 권역 단지 비교하기</Button>
          <Button variant="Subtle">선택</Button>
          <Button crown>선택했어요</Button>
          <Button disabled>비활성 버튼</Button>
        </div>
      </section>
      <section className="ds-section" aria-labelledby="grade-title">
        <h2 id="grade-title">Grade Chip / Card / Stage</h2>
        <div className="ds-row">
          {grades.map((grade) => (
            <GradeChip key={grade} grade={grade} value={`${grade}.3`} />
          ))}
        </div>
        <div className="ds-grid">
          {grades.map((grade) => (
            <GradeCard
              key={grade}
              grade={grade}
              value={`${grade}.3`}
              rankText="162개 권역 중 94위"
            />
          ))}
        </div>
        <div className="ds-grid">
          <GradeStage stage="Collecting" />
          <GradeStage stage="Provisional" />
          <GradeStage stage="Confirmed" />
        </div>
      </section>
      <section className="ds-section" aria-labelledby="search-title">
        <h2 id="search-title">Search / Field</h2>
        <SearchField
          label="카탈로그 지역 검색"
          value={query}
          onValueChange={setQuery}
        />
      </section>
      <section className="ds-section" aria-labelledby="controls-title">
        <h2 id="controls-title">Close / Panel / Map Control</h2>
        <div className="ds-row">
          <CloseButton
            label="예제 초기화"
            onClick={() => {
              setZoom(0);
              setExpanded(true);
            }}
          />
          <PanelHandle
            expanded={expanded}
            aria-controls="example-panel"
            onClick={() => setExpanded(!expanded)}
          />
          <MapControl icon="Plus" onClick={() => setZoom(zoom + 1)} />
          <MapControl icon="Minus" onClick={() => setZoom(zoom - 1)} />
          <MapControl icon="Expand" onClick={() => setZoom(0)} />
        </div>
        <p role="status">
          확대 {zoom} · 패널 {expanded ? '열림' : '닫힘'}
        </p>
        <div id="example-panel" hidden={!expanded}>
          패널 표시 예시
        </div>
      </section>
      <section className="ds-section" aria-labelledby="icons-title">
        <h2 id="icons-title">Icons · 24 / 16</h2>
        <div className="ds-row">
          {iconNames.map((name) => (
            <span key={name} className="ds-icon-sample">
              <Icon name={name} />
              {name}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
