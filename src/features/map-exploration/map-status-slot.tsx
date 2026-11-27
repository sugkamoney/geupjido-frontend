import { useLayoutEffect, useRef, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mapStatusQueryOptions } from '../map-status/query';
import type { MapStatus } from '../map-status/validation';
import { placeMapStatus } from './map-status-placement';

export type MapStatusCardProps = {
  basis: 'initial' | 'vote';
  data?: MapStatus;
  phase: 'loading' | 'ready' | 'error' | 'refreshing' | 'refresh-error';
  onRetry: () => void;
};

const obstacleSelector = [
  '.shell-navigation',
  '.shell-left-panel',
  '.shell-panel-handle',
  '.shell-detail',
  '.shell-search-input-row',
  '.shell-level-toggle',
  '.shell-search-results',
  '.shell-map-controls',
  '.exploration-data-state',
  '.exploration-map-status',
  '.exploration-fixture-notice',
].join(', ');

export function MapStatusSlot({
  renderer: Renderer,
}: {
  renderer: ComponentType<MapStatusCardProps>;
}) {
  const { data, isFetching, isError, refetch } = useQuery(
    mapStatusQueryOptions(),
  );
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const slot = ref.current;
    const shell = slot?.closest('.app-shell');
    const map = slot?.parentElement;
    const content = contentRef.current;
    if (!slot || !shell || !map || !content || !window.ResizeObserver) return;

    const updateScrolling = () => {
      slot.toggleAttribute(
        'data-scrollable',
        slot.scrollHeight > slot.clientHeight ||
          slot.scrollWidth > slot.clientWidth,
      );
    };

    let obstacles = new Set<Element>();
    const measure = () => {
      const bounds = map.getBoundingClientRect();
      const boxes = [...obstacles]
        .filter((node) => node.getClientRects().length > 0)
        .map((node) => node.getBoundingClientRect());
      const placement = placeMapStatus(bounds, boxes);
      slot.hidden = !placement;
      slot.inert = !placement;
      if (!placement) return;

      slot.style.right = `${bounds.right - placement.right}px`;
      slot.style.top = `${placement.top - bounds.top}px`;
      slot.style.maxWidth = `${placement.width}px`;
      slot.style.maxHeight = `${placement.height}px`;
      updateScrolling();
    };
    const sizes = new ResizeObserver(measure);
    sizes.observe(map);
    const contentSize = new ResizeObserver(updateScrolling);
    contentSize.observe(content);
    const observeObstacles = () => {
      const next = new Set(shell.querySelectorAll(obstacleSelector));
      for (const node of obstacles) {
        if (!next.has(node)) sizes.unobserve(node);
      }
      for (const node of next) {
        if (obstacles.has(node)) continue;
        sizes.observe(node);
        // The map frame can reposition a notice without changing its size.
        changes.observe(node, {
          attributes: true,
          attributeFilter: ['style', 'hidden'],
        });
      }
      obstacles = next;
      measure();
    };
    const affectsPlacement = (node: Node) =>
      node instanceof Element &&
      (node.matches(obstacleSelector) ||
        !!node.querySelector(obstacleSelector));
    const changes = new MutationObserver((records) => {
      if (
        records.some(({ type, target, addedNodes, removedNodes }) =>
          type === 'attributes'
            ? target === shell || obstacles.has(target as Element)
            : [...addedNodes, ...removedNodes].some(affectsPlacement),
        )
      )
        observeObstacles();
    });
    changes.observe(shell, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'hidden',
        'data-panel-open',
        'data-detail-open',
        'data-active-panel',
      ],
    });
    observeObstacles();
    return () => {
      changes.disconnect();
      sizes.disconnect();
      contentSize.disconnect();
    };
  }, []);

  const phase = data
    ? isFetching
      ? 'refreshing'
      : isError
        ? 'refresh-error'
        : 'ready'
    : isError && !isFetching
      ? 'error'
      : 'loading';

  return (
    <div className="exploration-status-card-slot" ref={ref} hidden inert>
      <div ref={contentRef}>
        <Renderer
          basis="initial"
          data={data}
          phase={phase}
          onRetry={() => void refetch({ cancelRefetch: false })}
        />
      </div>
    </div>
  );
}
