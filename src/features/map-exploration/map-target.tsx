import { useRef, type ComponentPropsWithoutRef } from 'react';

/** Touch/pen selection happens on release, including platforms without synthetic click. */
export function MapTarget({
  onActivate,
  canActivate,
  ...props
}: ComponentPropsWithoutRef<'button'> & {
  onActivate: () => void;
  canActivate: () => boolean;
}) {
  const touch = useRef(false);
  const start = useRef<{ id: number; x: number; y: number } | undefined>(
    undefined,
  );
  return (
    <button
      {...props}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        touch.current =
          event.pointerType === 'touch' || event.pointerType === 'pen';
        if (touch.current)
          start.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
          };
      }}
      onPointerUp={(event) => {
        const origin = start.current;
        start.current = undefined;
        if (
          origin &&
          origin.id === event.pointerId &&
          Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 6 &&
          canActivate()
        )
          onActivate();
      }}
      onPointerCancel={() => {
        start.current = undefined;
      }}
      onClick={(event) => {
        if (event.detail !== 0 && touch.current) return;
        if (canActivate() || event.detail === 0) onActivate();
      }}
    />
  );
}
