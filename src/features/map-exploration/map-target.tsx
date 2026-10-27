import { useRef, type ComponentPropsWithoutRef } from 'react';

/** Touch/pen selection happens on release, including platforms without synthetic click. */
export function MapTarget({
  onActivate,
  canActivate,
  capture = true,
  ...props
}: ComponentPropsWithoutRef<'button'> & {
  onActivate: () => void;
  canActivate: () => boolean;
  /**
   * fixture 입력은 대상에서 pointer를 capture한다. NAVER는 false로 넘겨 대상 위에서
   * 시작한 드래그·핀치가 SDK 지도 이동으로 이어지게 한다.
   */
  capture?: boolean;
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
        if (capture) event.currentTarget.setPointerCapture?.(event.pointerId);
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
      // Layout can place another control under the released finger in WebKit.
      // Touch activation already happened on pointerup; suppress its retargeted click.
      onTouchEnd={(event) => event.preventDefault()}
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
