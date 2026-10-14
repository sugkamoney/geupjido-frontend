import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MapControl, PanelHandle } from '../ui';
import { ShellNavigation } from './shell-navigation';
import { DetailPanel, TimelinePanel } from './shell-panels';
import { ShellSearchRow } from './shell-search';
import {
  useCompactLayout,
  useMapFrame,
  useShellViewport,
} from './use-shell-layout';
import type { AppShellProps, DisplayLevel } from './types';

export function AppShell({
  map,
  timeline,
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
  const [panelOpen, setPanelOpen] = useState(false);
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
    // CSS may hide a list before the media change callback runs.
    const active =
      document.activeElement === document.body
        ? lastFocused.current
        : document.activeElement;
    if (
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
  const editing = compact && searchEditing;
  useShellViewport(rootRef);
  const frame = useMapFrame(
    rootRef,
    mapRef,
    compact,
    panelOpen,
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
  const collapse = () => {
    handleRef.current?.focus({ preventScroll: true });
    setPanelOpen((open) => !open);
  };
  const worldcup = () => {
    if (compact) setMobileNotice(true);
    else setPanelOpen(true);
  };

  return (
    <main
      ref={rootRef}
      className="app-shell"
      data-panel-open={panelOpen}
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
        inert={editing}
        data-layout-region
      >
        {map({ frame, level: detail ? 'zone' : level })}
      </div>
      <div inert={editing}>
        <ShellNavigation
          panelOpen={!compact && panelOpen}
          review={review}
          mapButtonRef={mapButtonRef}
          onMap={() => {
            setPanelOpen(false);
            setMobileNotice(false);
          }}
          onWorldcup={worldcup}
        />
        {!compact && panelOpen && (
          <TimelinePanel panelRef={panelRef} content={timeline} />
        )}
        {!compact && (
          <PanelHandle
            ref={handleRef}
            className="shell-panel-handle"
            expanded={panelOpen}
            aria-controls="shell-timeline"
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
