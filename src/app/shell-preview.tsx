import { useState } from 'react';
import { AppShell } from '../components/app-shell/app-shell';
import { Button } from '../components/ui';
import type { ShellDetail } from '../components/app-shell/types';

function PreviewList({ kind }: { kind: '단지' | '대진' }) {
  return (
    <div className="shell-fixture-list">
      {Array.from({ length: 24 }, (_, index) => (
        <div key={index} className="shell-fixture-row">
          <span>
            검토용 {kind} 자리 {index + 1}
          </span>
          <p>실제 데이터가 아닌 스크롤 검증용 콘텐츠입니다.</p>
        </div>
      ))}
    </div>
  );
}

export function ShellPreview() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(false);
  const [longText, setLongText] = useState(false);
  const detail: ShellDetail | undefined = selected
    ? {
        id: 'layout-fixture',
        title: longText
          ? '아주 긴 권역 이름을 넣어 줄바꿈과 닫기 조작을 검토하는 화면'
          : '검토용 권역',
        location: '검토 위치 · 실제 지역 정보 아님',
        summary: (
          <div className="shell-fixture-summary">
            급지 표시 영역<p>미정 수치와 순위는 표시하지 않습니다.</p>
          </div>
        ),
        expandedSummary: (
          <div className="shell-fixture-stage">
            단계 표시 영역<p>단계 정책과 데이터 연결 후 표시합니다.</p>
          </div>
        ),
        actions: (
          <Button variant="Outline" className="w-full" disabled>
            이 권역 단지 비교하기
          </Button>
        ),
        listTitle: (
          <>
            <h3>권역 안 단지 순위</h3>
            <p>검토용 목록 · 실제 순위와 수치 없음</p>
          </>
        ),
        content: <PreviewList kind="단지" />,
      }
    : undefined;
  return (
    <AppShell
      review
      detail={detail}
      onDetailClose={() => setSelected(false)}
      timeline={<PreviewList kind="대진" />}
      search={{ value: query, onValueChange: setQuery }}
      map={({ frame }) => (
        <div
          className="shell-map-placeholder"
          style={{
            left: frame.x,
            top: frame.y,
            width: frame.width,
            height: frame.height,
          }}
        >
          <div>
            <h1>급지도</h1>
            <p>검토용 화면 · 실제 지도와 데이터가 아닙니다.</p>
            <div className="shell-preview-actions">
              <Button variant="Outline" onClick={() => setSelected(true)}>
                검토 상세 열기
              </Button>
              <button
                className="shell-text-button"
                aria-pressed={longText}
                onClick={() => setLongText((value) => !value)}
              >
                긴 문구 검토
              </button>
            </div>
          </div>
        </div>
      )}
    />
  );
}
