import { useEffect, useRef, type RefObject } from 'react';
import type { DOMAttributes } from 'react';
import type { MapAdapter, Point } from './types';

/**
 * 지도 region 입력.
 * - `drive`(fixture): pointer·wheel·dblclick·키보드가 adapter 카메라를 움직인다.
 * - `observe`(NAVER): 카메라는 SDK가 움직인다. 이 계층은 드래그·핀치·취소를 관찰만 해
 *   `canActivate`(선택 억제)를 지키고, 조작 시작을 `adapter.noteUserGesture`로 알린다.
 *   키보드(화살표·`+/-`)는 두 모드 모두 adapter로 보낸다.
 */
export function useMapInput(
  adapter: MapAdapter,
  root: RefObject<HTMLDivElement | null>,
  onInteraction: () => void,
  mode: 'drive' | 'observe' = 'drive',
) {
  const observe = mode === 'observe';
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{
    moved: boolean;
    lastTap: number;
    distance: number;
    start?: Point;
    tapPoint?: Point;
    touch: boolean;
  }>({ moved: false, lastTap: 0, distance: 0, touch: false });
  const latest = useRef({ adapter, observe });
  useEffect(() => {
    latest.current = { adapter, observe };
  });
  /** 진행 중 입력을 지도 조작으로 확정한다. observe에서는 확정 순간 SDK 조작을 알린다. */
  const markMoved = () => {
    const first = !gesture.current.moved;
    gesture.current.moved = true;
    gesture.current.lastTap = 0;
    if (first && latest.current.observe)
      latest.current.adapter.noteUserGesture?.();
  };
  useEffect(() => {
    const cancelOutsidePointer = (event: PointerEvent) => {
      // Removed capture owners deliver termination to document, outside the map tree.
      if (event.target instanceof Node && root.current?.contains(event.target))
        return;
      if (!pointers.current.delete(event.pointerId)) return;
      markMoved();
    };
    const cancelAll = (notify: boolean) => {
      const active = pointers.current.size > 0;
      pointers.current.clear();
      if (notify && active) markMoved();
      else {
        gesture.current.moved = true;
        gesture.current.lastTap = 0;
      }
    };
    const blur = () => cancelAll(true);
    const events = [
      'pointerup',
      'pointercancel',
      'lostpointercapture',
    ] as const;
    for (const event of events)
      document.addEventListener(event, cancelOutsidePointer, true);
    window.addEventListener('blur', blur);
    return () => {
      for (const event of events)
        document.removeEventListener(event, cancelOutsidePointer, true);
      window.removeEventListener('blur', blur);
      cancelAll(false);
    };
  }, [root]);
  const pixel = (x: number, y: number): Point => {
    const bounds = root.current?.getBoundingClientRect();
    return { x: x - (bounds?.left ?? 0), y: y - (bounds?.top ?? 0) };
  };
  const handlers: DOMAttributes<HTMLDivElement> = {
    onWheel: (event) => {
      if (observe) {
        adapter.noteUserGesture?.();
        return;
      }
      adapter.zoom(
        event.deltaY < 0 ? 0.25 : -0.25,
        pixel(event.clientX, event.clientY),
      );
    },
    onDoubleClick: (event) => {
      if (gesture.current.touch) return;
      // observe: 빈 지도 위 더블클릭은 SDK가 줌한다. 라벨·핀(button) 위 더블클릭은
      // overlay host가 SDK로 전달하지 않으므로 사용자 조작으로 보지 않는다.
      const onButton =
        event.target instanceof Element && !!event.target.closest('button');
      if (observe) {
        if (!onButton) adapter.noteUserGesture?.();
        return;
      }
      if (onButton) return;
      adapter.zoom(1, pixel(event.clientX, event.clientY));
    },
    onKeyDown: (event) => {
      // region 자신 또는 SDK canvas처럼 region 안의 비-조작 요소에서만 처리한다.
      // 라벨·핀(button) 등 상호작용 요소는 자체 키 동작을 유지한다.
      if (
        event.target !== event.currentTarget &&
        (!(event.target instanceof Element) ||
          event.target.closest(
            'button, a, input, textarea, select, [contenteditable]',
          ))
      )
        return;
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
        markMoved();
      }
      // observe에서는 capture하지 않는다: pointer는 SDK 입력 요소에 남아야 한다.
      if (
        !observe &&
        !(event.target instanceof Element && event.target.closest('button'))
      )
        event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event) => {
      const previous = pointers.current.get(event.pointerId);
      if (!previous) return;
      const point = pixel(event.clientX, event.clientY);
      pointers.current.set(event.pointerId, point);
      if (observe) {
        const start = gesture.current.start ?? previous;
        if (
          pointers.current.size >= 2 ||
          Math.hypot(point.x - start.x, point.y - start.y) >= 6
        )
          markMoved();
        return;
      }
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
          if (observe) adapter.noteUserGesture?.();
          else adapter.zoom(1, point);
          gesture.current.lastTap = 0;
        } else {
          gesture.current.lastTap = now;
          gesture.current.tapPoint = point;
        }
      }
    },
    onPointerCancel: (event) => {
      const tracked = pointers.current.delete(event.pointerId);
      if (tracked || !observe) markMoved();
    },
    onLostPointerCapture: (event) => {
      // pointerup 뒤의 암묵적 capture 해제는 이미 정리된 pointer라 무시된다.
      if (pointers.current.delete(event.pointerId) && observe) markMoved();
    },
  };
  return { handlers, canActivate: () => !gesture.current.moved };
}
