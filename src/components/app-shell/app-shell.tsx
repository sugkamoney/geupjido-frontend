import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MapControl, PanelHandle } from '../ui';
import { ShellNavigation } from './shell-navigation';
import { DetailPanel, RankingPanel, TimelinePanel } from './shell-panels';
import { ShellSearchRow } from './shell-search';
import {
  useCompactLayout,
  useMapFrame,
  useShellViewport,
} from './use-shell-layout';
import type { AppShellProps, DisplayLevel } from './types';

export function AppShell({
  map,
  desktopMapOverlay,
  ranking,
  timeline,
  timelineHeader,
  timelineVisible = true,
  onWorldcupStart,
  detail,
  onDetailClose,
  search,
  onLevelChange,
  displayLevel,
  sheetExpanded: controlledSheetExpanded,
  onSheetExpandedChange,
  onMapCommand,
  review = false,
}: AppShellProps) {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [rankingSession, setRankingSession] = useState<AbortController | null>(
    null,
  );
  const activeRanking =
    ranking && !rankingSession?.signal.aborted ? rankingSession : null;
  const [lastPanel, setLastPanel] = useState<'timeline' | 'ranking'>(
    'timeline',
  );
  const rankingReturnFocus = useRef<'menu' | 'detail' | null>(null);
  const rankingButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeRanking = (focus: typeof rankingReturnFocus.current = null) => {
    if (!activeRanking) return;
    rankingReturnFocus.current = focus;
    activeRanking.abort();
    setRankingSession(null);
  };
  useLayoutEffect(() => () => activeRanking?.abort(), [activeRanking]);
  const [localLevel, setLevel] = useState<DisplayLevel>('zone');
  const [localSheetExpanded, setLocalSheetExpanded] = useState(false);
  const level = displayLevel ?? localLevel;
  const sheetExpanded = controlledSheetExpanded ?? localSheetExpanded;
  const setSheetExpanded = (expanded: boolean) => {
    setLocalSheetExpanded(expanded);
    onSheetExpandedChange?.(expanded);
  };
  const [searchEditing, setSearchEditing] = useState(false);
  const [mobileNotice, setMobileNotice] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapButtonRef = useRef<HTMLButtonElement | null>(null);
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const detailOrigin = useRef<HTMLElement | null>(null);
  const restoreDetailFocus = useRef(false);
  const previousDetail = useRef<string | undefined>(undefined);
  const interactionOrigin = useRef<HTMLElement | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const compact = useCompactLayout((next) => {
    closeRanking('menu');
    // CSS may hide a list before the media change callback runs.
    const active =
      document.activeElement === document.body
        ? lastFocused.current
        : document.activeElement;
    if (
      !activeRanking &&
      next &&
      (panelRef.current?.contains(active) || active === handleRef.current)
    )
      mapButtonRef.current?.focus({ preventScroll: true });
    if (detailRef.current?.contains(active))
      closeRef.current?.focus({ preventScroll: true });
    if (searchEditing) inputRef.current?.focus({ preventScroll: true });
    search.onResultsOpenChange?.(false);
    setSearchEditing(false);
    setMobileNotice(false);
  });
  const mobileRanking = compact && !!activeRanking;
  const editing = compact && searchEditing;
  const panelOpen = !compact && (timelineOpen || !!activeRanking);
  const activePanel = activeRanking ? 'ranking' : panelOpen ? 'timeline' : null;
  useLayoutEffect(() => {
    if (activeRanking || !rankingReturnFocus.current) return;
    const target =
      rankingReturnFocus.current === 'detail'
        ? (closeRef.current ?? rankingButtonRef.current)
        : rankingButtonRef.current;
    rankingReturnFocus.current = null;
    target?.focus({ preventScroll: true });
  }, [activeRanking, detail]);
  useShellViewport(rootRef);
  const frame = useMapFrame(
    rootRef,
    mapRef,
    compact,
    activePanel,
    detail?.id,
    sheetExpanded,
    (search.resultsOpen ?? !!search.value) || editing,
  );

  useEffect(() => {
    if (detail && previousDetail.current !== detail.id) {
      if (!previousDetail.current)
        detailOrigin.current =
          interactionOrigin.current ??
          (document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null);
      closeRef.current?.focus({ preventScroll: true });
    }
    previousDetail.current = detail?.id;
  }, [detail]);

  // Restore after selection overlays have been removed from the committed tree.
  useLayoutEffect(() => {
    if (detail || !restoreDetailFocus.current) return;
    restoreDetailFocus.current = false;
    const origin = detailOrigin.current;
    if (
      origin?.isConnected &&
      !origin.closest('[inert], [hidden]') &&
      !hasHiddenAncestor(origin)
    )
      origin.focus({ preventScroll: true });
    else mapButtonRef.current?.focus({ preventScroll: true });
  }, [detail]);

  useLayoutEffect(() => {
    if (!detail || !compact || sheetExpanded) return;
    const active =
      document.activeElement === document.body
        ? lastFocused.current
        : document.activeElement;
    if (
      active instanceof HTMLElement &&
      detailRef.current?.contains(active) &&
      hasHiddenAncestor(active)
    ) {
      const selection = detailRef.current.querySelector<HTMLElement>(
        '.shell-detail-selection button, .shell-detail-selection a',
      );
      (selection ?? closeRef.current)?.focus({ preventScroll: true });
    }
  }, [detail, compact, sheetExpanded]);

  const closeDetail = (restoreFocus = true) => {
    setSheetExpanded(false);
    restoreDetailFocus.current = restoreFocus;
    onDetailClose?.();
  };
  const changeLevel = (next: DisplayLevel) => {
    setLevel(next);
    if (next === 'gu' && detail) closeDetail(false);
    onLevelChange?.(next);
  };
  const openRanking = () => {
    if (activeRanking) return;
    setLastPanel('ranking');
    setTimelineOpen(false);
    setMobileNotice(false);
    setRankingSession(new AbortController());
  };
  const collapse = () => {
    if (activeRanking) {
      closeRanking('menu');
      return;
    }
    handleRef.current?.focus({ preventScroll: true });
    if (!timelineOpen && ranking && lastPanel === 'ranking') openRanking();
    else setTimelineOpen((open) => !open);
  };
  const worldcup = (origin: HTMLElement) => {
    closeRanking();
    setLastPanel('timeline');
    if (compact && onWorldcupStart) onWorldcupStart(origin);
    else if (compact) setMobileNotice(true);
    else setTimelineOpen(true);
  };

  return (
    <main
      ref={rootRef}
      className="app-shell"
      data-panel-open={panelOpen}
      data-active-panel={activePanel ?? undefined}
      data-detail-open={!!detail}
      data-compact={compact}
      onFocusCapture={(event) => {
        lastFocused.current = event.target;
        if (!detail && event.target instanceof HTMLElement)
          interactionOrigin.current = event.target;
      }}
      onPointerDownCapture={(event) => {
        if (!detail && event.target instanceof Element)
          interactionOrigin.current = event.target.closest('.shell-search-row')
            ? inputRef.current
            : event.target.closest<HTMLElement>('button, a, input, [tabindex]');
      }}
    >
      <div
        ref={mapRef}
        className="shell-map-slot"
        inert={editing || mobileRanking}
        data-layout-region
      >
        {map({ frame, level: detail ? 'zone' : level })}
        {!compact && desktopMapOverlay}
      </div>
      <div inert={editing || mobileRanking}>
        <ShellNavigation
          activePanel={activePanel}
          onRanking={ranking ? openRanking : undefined}
          rankingButtonRef={rankingButtonRef}
          review={review}
          mapButtonRef={mapButtonRef}
          onMap={() => {
            closeRanking();
            setTimelineOpen(false);
            setMobileNotice(false);
          }}
          onWorldcup={worldcup}
        />
        {activePanel === 'timeline' && (
          <TimelinePanel
            panelRef={panelRef}
            content={timeline}
            header={timelineHeader}
            visible={timelineVisible}
            onStart={onWorldcupStart}
          />
        )}
        {!compact && (
          <PanelHandle
            ref={handleRef}
            className="shell-panel-handle"
            expanded={panelOpen}
            aria-controls={
              activePanel === 'ranking' ||
              (!panelOpen && ranking && lastPanel === 'ranking')
                ? 'shell-ranking'
                : 'shell-timeline'
            }
            onClick={collapse}
          />
        )}
        {detail && (
          <DetailPanel
            key={detail.id}
            panelRef={detailRef}
            detail={detail}
            compact={compact}
            expanded={sheetExpanded}
            onExpandedChange={setSheetExpanded}
            onClose={() => closeDetail()}
            closeRef={closeRef}
          />
        )}
        <div
          className="shell-map-controls"
          data-layout-region
          aria-label="지도 조작"
        >
          <div className="shell-zoom-controls">
            <MapControl
              icon="Plus"
              disabled={!onMapCommand}
              onClick={() => onMapCommand?.('zoom-in')}
            />
            <MapControl
              icon="Minus"
              disabled={!onMapCommand}
              onClick={() => onMapCommand?.('zoom-out')}
            />
          </div>
          <MapControl
            icon="Expand"
            disabled={!onMapCommand}
            onClick={() => onMapCommand?.('fit')}
          />
        </div>
        {compact && mobileNotice && (
          <div className="shell-mobile-notice" role="status">
            <p>월드컵을 준비하고 있어요.</p>
            <button onClick={() => setMobileNotice(false)}>안내 닫기</button>
          </div>
        )}
      </div>
      <div inert={mobileRanking}>
        <ShellSearchRow
          search={search}
          compact={compact}
          editing={editing}
          onEditingChange={setSearchEditing}
          onSelection={() => {
            detailOrigin.current = inputRef.current;
            interactionOrigin.current = inputRef.current;
          }}
          level={detail ? 'zone' : level}
          onLevelChange={changeLevel}
          inputRef={inputRef}
        />
      </div>
      {activeRanking && ranking && (
        <RankingPanel
          compact={compact}
          onClose={() => closeRanking('menu')}
          content={ranking}
          signal={activeRanking.signal}
          onZoneSelected={() => {
            if (activeRanking.signal.aborted) return;
            interactionOrigin.current = rankingButtonRef.current;
            detailOrigin.current = rankingButtonRef.current;
            if (compact) closeRanking('detail');
            else closeRef.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </main>
  );
}

function hasHiddenAncestor(element: HTMLElement) {
  let node: HTMLElement | null = element;
  while (node) {
    if (
      getComputedStyle(node).display === 'none' ||
      getComputedStyle(node).visibility === 'hidden'
    )
      return true;
    node = node.parentElement;
  }
  return false;
}
