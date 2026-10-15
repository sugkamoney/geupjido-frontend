import type { RefObject } from 'react';

export function ShellNavigation({
  panelOpen,
  review,
  onMap,
  onWorldcup,
  mapButtonRef,
}: {
  panelOpen: boolean;
  review: boolean;
  onMap: () => void;
  onWorldcup: (origin: HTMLElement) => void;
  mapButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <nav className="shell-navigation" aria-label="주 메뉴" data-layout-region>
      <div className="shell-logo">
        <img src="/assets/images/shell-symbol.svg" alt="급지도" />
      </div>
      <div className="shell-menu-items">
        <button
          ref={mapButtonRef}
          className="shell-nav-item"
          aria-pressed={!panelOpen}
          onClick={onMap}
        >
          <span className="shell-nav-icon shell-nav-map" aria-hidden="true" />
          <span>지도</span>
        </button>
        <button
          className="shell-nav-item"
          aria-pressed={panelOpen}
          onClick={(event) => onWorldcup(event.currentTarget)}
        >
          <span
            className="shell-nav-icon shell-nav-versus"
            aria-hidden="true"
          />
          <span>월드컵</span>
        </button>
        {review && (
          <>
            <button
              className="shell-nav-item"
              disabled
              aria-label="랭킹 · 노출 미정"
            >
              <img src="/assets/icons/shell-ranking.svg" alt="" />
              <span>랭킹</span>
            </button>
            <button
              className="shell-nav-item"
              disabled
              aria-label="리포트 · 노출 미정"
            >
              <img src="/assets/icons/shell-report.svg" alt="" />
              <span>리포트</span>
            </button>
          </>
        )}
      </div>
      <span className="shell-avatar" aria-label="익명 사용자">
        익
      </span>
    </nav>
  );
}
