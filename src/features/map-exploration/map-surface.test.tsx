import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapSurface } from './map-surface';
import { FixtureMapAdapter } from './fixture-adapter';
import { fixtures } from './fixtures';

function setup() {
  const adapter = new FixtureMapAdapter();
  const frame = { x: 0, y: 0, width: 1000, height: 800 };
  adapter.setViewport({ width: 1000, height: 800 }, frame);
  adapter.center({ x: 0, y: 0 }, 12.9);
  const onLabel = vi.fn(),
    onApartment = vi.fn();
  const view = render(
    <MapSurface
      adapter={adapter}
      frame={frame}
      data={fixtures}
      onLabel={onLabel}
      onApartment={onApartment}
    />,
  );
  return { adapter, onLabel, ...view };
}
function pointer(
  node: HTMLElement,
  type: string,
  x = 100,
  y = 100,
  pointerType = 'touch',
  id = 1,
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    button: 0,
  });
  Object.defineProperties(event, {
    pointerType: { value: pointerType },
    pointerId: { value: id },
  });
  fireEvent(node, event);
}
afterEach(() => vi.useRealTimers());
describe('map hover and input isolation', () => {
  it('uses 100ms entry, immediate hover transfer and 120ms exit, and cancels pending hover on camera movement', () => {
    vi.useFakeTimers();
    const { adapter } = setup();
    const first = screen.getByRole('button', { name: '권역 압구정' }),
      second = screen.getByRole('button', { name: '권역 청담' });
    pointer(first, 'pointerover', 0, 0, 'mouse');
    act(() => vi.advanceTimersByTime(99));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('tooltip')).toHaveTextContent('압구정');
    pointer(first, 'pointerout', 0, 0, 'mouse');
    pointer(second, 'pointerover', 0, 0, 'mouse');
    expect(screen.getByRole('tooltip')).toHaveTextContent('청담');
    pointer(second, 'pointerout', 0, 0, 'mouse');
    act(() => vi.advanceTimersByTime(119));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    pointer(first, 'pointerover', 0, 0, 'mouse');
    act(() => adapter.pan({ x: 10, y: 0 }));
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('allows jittering taps without moving the camera or losing selection', () => {
    const { adapter, onLabel } = setup(),
      label = screen.getByRole('button', { name: '권역 압구정' });
    const before = adapter.getSnapshot();
    pointer(label, 'pointerdown');
    pointer(label, 'pointermove', 102, 102);
    pointer(label, 'pointerup', 102, 102);
    expect(adapter.getSnapshot().center).toEqual(before.center);
    expect(onLabel).toHaveBeenCalledOnce();
  });
  it('double tap zooms once even if a browser emits compatibility dblclick', () => {
    const { adapter } = setup(),
      node = screen.getByRole('region', { name: '검토용 지도' });
    pointer(node, 'pointerdown');
    pointer(node, 'pointerup');
    pointer(node, 'pointerdown');
    pointer(node, 'pointerup');
    fireEvent.doubleClick(node, { clientX: 100, clientY: 100 });
    expect(adapter.getSnapshot().zoom).toBeCloseTo(13.9);
  });
  it('pinch zoom cannot select a label and pointercancel releases the gesture', () => {
    const { adapter, onLabel } = setup(),
      label = screen.getByRole('button', { name: '권역 압구정' });
    pointer(label, 'pointerdown', 100, 100, 'touch', 1);
    pointer(label, 'pointerdown', 200, 100, 'touch', 2);
    pointer(label, 'pointermove', 300, 100, 'touch', 2);
    pointer(label, 'pointerup', 100, 100, 'touch', 1);
    pointer(label, 'pointercancel', 300, 100, 'touch', 2);
    expect(adapter.getSnapshot().zoom).toBeCloseTo(13.9);
    expect(onLabel).not.toHaveBeenCalled();
    pointer(label, 'pointerdown');
    pointer(label, 'pointerup');
    expect(onLabel).toHaveBeenCalledOnce();
  });
  it('cleans hover timers on unmount', () => {
    vi.useFakeTimers();
    const { unmount } = setup();
    pointer(
      screen.getByRole('button', { name: '권역 압구정' }),
      'pointerover',
      0,
      0,
      'mouse',
    );
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
