import { useEffect, useRef, type RefObject } from 'react';
import type { DOMAttributes } from 'react';
import type { MapAdapter, Point } from './types';

export function useMapInput(
  adapter: MapAdapter,
  root: RefObject<HTMLDivElement | null>,
  onInteraction: () => void,
) {
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{
    moved: boolean;
    lastTap: number;
    distance: number;
    start?: Point;
    tapPoint?: Point;
    touch: boolean;
  }>({ moved: false, lastTap: 0, distance: 0, touch: false });
  useEffect(() => {
    const cancelOutsidePointer = (event: PointerEvent) => {
      // Removed capture owners deliver termination to document, outside the map tree.
      if (event.target instanceof Node && root.current?.contains(event.target))
        return;
      if (!pointers.current.delete(event.pointerId)) return;
      gesture.current.moved = true;
      gesture.current.lastTap = 0;
    };
    const cancelAll = () => {
      pointers.current.clear();
      gesture.current.moved = true;
      gesture.current.lastTap = 0;
    };
    const events = [
      'pointerup',
      'pointercancel',
      'lostpointercapture',
    ] as const;
    for (const event of events)
      document.addEventListener(event, cancelOutsidePointer, true);
    window.addEventListener('blur', cancelAll);
    return () => {
      for (const event of events)
        document.removeEventListener(event, cancelOutsidePointer, true);
      window.removeEventListener('blur', cancelAll);
      cancelAll();
    };
  }, [root]);
  const pixel = (x: number, y: number): Point => {
    const bounds = root.current?.getBoundingClientRect();
    return { x: x - (bounds?.left ?? 0), y: y - (bounds?.top ?? 0) };
  };
  const handlers: DOMAttributes<HTMLDivElement> = {
    onWheel: (event) => {
      adapter.zoom(
        event.deltaY < 0 ? 0.25 : -0.25,
        pixel(event.clientX, event.clientY),
      );
    },
    onDoubleClick: (event) => {
      if (
        gesture.current.touch ||
        (event.target instanceof Element && event.target.closest('button'))
      )
        return;
      adapter.zoom(1, pixel(event.clientX, event.clientY));
    },
    onKeyDown: (event) => {
      if (event.target !== event.currentTarget) return;
      const deltas: Record<string, Point> = {
        ArrowLeft: { x: 50, y: 0 },
        ArrowRight: { x: -50, y: 0 },
        ArrowUp: { x: 0, y: 50 },
        ArrowDown: { x: 0, y: -50 },
      };
      if (deltas[event.key]) {
        event.preventDefault();
        adapter.pan(deltas[event.key]!);
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        adapter.zoom(1);
      }
      if (event.key === '-') {
        event.preventDefault();
        adapter.zoom(-1);
      }
    },
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      const point = pixel(event.clientX, event.clientY);
      if (!pointers.current.size) {
        gesture.current.moved = false;
        gesture.current.start = point;
        gesture.current.touch = event.pointerType === 'touch';
      }
      pointers.current.set(event.pointerId, point);
      onInteraction();
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        gesture.current.distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        gesture.current.moved = true;
        gesture.current.lastTap = 0;
      }
      if (!(event.target instanceof Element && event.target.closest('button')))
        event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event) => {
      const previous = pointers.current.get(event.pointerId);
      if (!previous) return;
      const point = pixel(event.clientX, event.clientY);
      pointers.current.set(event.pointerId, point);
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (gesture.current.distance > 0 && distance > 0)
          adapter.zoom(Math.log2(distance / gesture.current.distance), {
            x: (a!.x + b!.x) / 2,
            y: (a!.y + b!.y) / 2,
          });
        gesture.current.distance = distance;
        gesture.current.moved = true;
      } else {
        const origin = gesture.current.moved
          ? previous
          : (gesture.current.start ?? previous);
        const delta = { x: point.x - origin.x, y: point.y - origin.y };
        if (gesture.current.moved || Math.hypot(delta.x, delta.y) >= 6) {
          adapter.pan(delta);
          gesture.current.moved = true;
          gesture.current.lastTap = 0;
        }
      }
    },
    onPointerUp: (event) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.delete(event.pointerId);
      const overlay =
        event.target instanceof Element && event.target.closest('button');
      if (!overlay && !gesture.current.moved && event.pointerType === 'touch') {
        const now = Date.now(),
          point = pixel(event.clientX, event.clientY),
          previous = gesture.current.tapPoint;
        if (
          now - gesture.current.lastTap < 300 &&
          previous &&
          Math.hypot(point.x - previous.x, point.y - previous.y) < 24
        ) {
          adapter.zoom(1, point);
          gesture.current.lastTap = 0;
        } else {
          gesture.current.lastTap = now;
          gesture.current.tapPoint = point;
        }
      }
    },
    onPointerCancel: (event) => {
      pointers.current.delete(event.pointerId);
      gesture.current.moved = true;
      gesture.current.lastTap = 0;
    },
    onLostPointerCapture: (event) => {
      pointers.current.delete(event.pointerId);
    },
  };
  return { handlers, canActivate: () => !gesture.current.moved };
}
