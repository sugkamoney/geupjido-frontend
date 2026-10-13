import {
  useEffect,
  useEffectEvent,
  useRef,
  useLayoutEffect,
  useState,
  type RefObject,
} from 'react';
import type { MapFrame } from './types';

export function useCompactLayout(onChange: (compact: boolean) => void) {
  const [compact, setCompact] = useState(
    () => window.matchMedia?.('(max-width: 767px)').matches ?? false,
  );
  const current = useRef(compact);
  const notifyChange = useEffectEvent(onChange);
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 767px)');
    if (!media) return;
    const update = () => {
      if (current.current === media.matches) return;
      current.current = media.matches;
      notifyChange(media.matches);
      setCompact(media.matches);
    };
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, []);
  return compact;
}

export function useShellViewport(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      root.current?.style.setProperty(
        '--shell-viewport-height',
        `${viewport.height}px`,
      );
      root.current?.style.setProperty(
        '--shell-viewport-top',
        `${viewport.offsetTop}px`,
      );
    };
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    update();
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [root]);
}

export function useMapFrame(
  root: RefObject<HTMLElement | null>,
  map: RefObject<HTMLDivElement | null>,
  compact: boolean,
  panelOpen: boolean,
  detailId: string | undefined,
  sheetExpanded: boolean,
  searchHasContent: boolean,
) {
  const [frame, setFrame] = useState<MapFrame>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  useLayoutEffect(() => {
    const app = root.current;
    const mapNode = map.current;
    if (!app || !mapNode || !window.ResizeObserver) return;
    const measure = () => {
      const bounds = mapNode.getBoundingClientRect();
      let left = bounds.left;
      let top = bounds.top;
      let right = bounds.right;
      let bottom = bounds.bottom;
      const rect = (selector: string) => {
        const element = app.querySelector<HTMLElement>(selector);
        return element && !element.hidden && element.getClientRects().length
          ? element.getBoundingClientRect()
          : null;
      };
      // Panels occlude the left edge on desktop and the bottom edge on mobile.
      for (const selector of [
        '.shell-navigation',
        '.shell-left-panel',
        '.shell-detail',
      ]) {
        const box = rect(selector);
        if (!box) continue;
        if (compact) bottom = Math.min(bottom, box.top);
        else left = Math.max(left, box.right + 8);
      }
      // Narrow-desktop search can sit wholly inside a detail's occluded strip.
      for (const selector of ['.shell-search-row', '.shell-search-results']) {
        const box = rect(selector);
        if (box && box.right > left && box.left < right)
          top = Math.max(top, box.bottom + 8);
      }
      const controls = rect('.shell-map-controls');
      if (
        controls &&
        controls.top < bottom &&
        controls.bottom > top &&
        controls.right > left
      )
        right = Math.min(right, controls.left - 8);
      const next = {
        x: Math.max(0, left - bounds.left),
        y: Math.max(0, top - bounds.top),
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
      setFrame((previous) =>
        Object.keys(next).every(
          (key) =>
            next[key as keyof MapFrame] === previous[key as keyof MapFrame],
        )
          ? previous
          : next,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(app);
    for (const child of app.querySelectorAll<HTMLElement>(
      '[data-layout-region]',
    ))
      observer.observe(child);
    measure();
    return () => observer.disconnect();
  }, [
    root,
    map,
    compact,
    panelOpen,
    detailId,
    sheetExpanded,
    searchHasContent,
  ]);
  return frame;
}
