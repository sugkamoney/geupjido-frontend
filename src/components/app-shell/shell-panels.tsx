import { useRef, type RefObject, type ReactNode } from 'react';
import { Button, CloseButton } from '../ui';
import type { ShellDetail } from './types';

export function TimelinePanel({
  content,
  panelRef,
}: {
  content?: ReactNode;
  panelRef: RefObject<HTMLElement | null>;
}) {
  return (
    <section
      ref={panelRef}
      id="shell-timeline"
      className="shell-left-panel"
      aria-label="월드컵 타임라인 패널"
      data-layout-region
    >
      <header className="shell-timeline-intro">
        <h2>아파트 월드컵</h2>
        <p>
          두 곳 중 더 살고 싶은 곳을 골라 보세요.
          <br />
          고른 결과가 모여 민심급지가 만들어집니다!
        </p>
        <img src="/assets/images/worldcup-intro.png" alt="" />
        <Button variant="Gradient" className="w-full" disabled>
          월드컵 시작
        </Button>
      </header>
      <header className="shell-list-title shell-timeline-title">
        <h3>월드컵 타임라인</h3>
        <p>다른 사람들은 어떤 지역을 골랐는지 확인해 보세요.</p>
      </header>
      <div className="shell-panel-list" tabIndex={0} aria-label="타임라인 목록">
        {content ?? <p className="shell-empty">월드컵을 준비하고 있어요.</p>}
      </div>
    </section>
  );
}

export function DetailPanel({
  detail,
  compact,
  expanded,
  onExpandedChange,
  onClose,
  closeRef,
  panelRef,
}: {
  detail: ShellDetail;
  compact: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onClose: () => void;
  closeRef: RefObject<HTMLButtonElement | null>;
  panelRef: RefObject<HTMLElement | null>;
}) {
  const skipClick = useRef(false);
  const drag = useRef<{ id: number; y: number } | null>(null);
  return (
    <section
      ref={panelRef}
      className="shell-detail"
      aria-labelledby="shell-detail-title"
      data-expanded={expanded}
      data-layout-region
    >
      {compact && (
        <button
          className="shell-sheet-handle"
          aria-label={expanded ? '상세 접기' : '상세 펼치기'}
          aria-expanded={expanded}
          aria-controls="shell-detail-body"
          onClick={() => {
            if (skipClick.current) {
              skipClick.current = false;
              return;
            }
            onExpandedChange(!expanded);
          }}
          onKeyDown={() => {
            skipClick.current = false;
          }}
          onPointerDown={(event) => {
            skipClick.current = false;
            if (event.pointerType === 'mouse') return;
            drag.current = { id: event.pointerId, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            const start = drag.current;
            drag.current = null;
            if (!start || start.id !== event.pointerId) return;
            const delta = event.clientY - start.y;
            if (Math.abs(delta) > 24) {
              onExpandedChange(delta < 0);
              skipClick.current = true;
            }
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <span />
        </button>
      )}
      <header className="shell-detail-header">
        <div>
          <h2 id="shell-detail-title">{detail.title}</h2>
          <p>{detail.location}</p>
        </div>
        <CloseButton ref={closeRef} label="권역 상세 닫기" onClick={onClose} />
      </header>
      <div className="shell-detail-body" id="shell-detail-body">
        <div className="shell-detail-summary">
          {detail.summary ?? (
            <p className="shell-empty">권역 정보를 준비하고 있어요.</p>
          )}
          {(!compact || expanded) && detail.expandedSummary}
          {detail.actions}
        </div>
        <header className="shell-list-title">
          {detail.listTitle ?? (
            <>
              <h3>권역 안 단지 순위</h3>
              <p>단지 정보를 준비하고 있어요.</p>
            </>
          )}
        </header>
        <div
          className="shell-panel-list"
          tabIndex={0}
          aria-label="권역 단지 목록"
        >
          {detail.content}
        </div>
      </div>
    </section>
  );
}
