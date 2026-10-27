import { afterEach, describe, expect, it, vi } from 'vitest';
import { FixtureMapAdapter } from './fixture-adapter';
import type { LatLng } from './types';

const origin: LatLng = { lat: 37.5, lng: 127 };
const target: LatLng = { lat: 37.5069, lng: 127.0123 };
const other: LatLng = { lat: 37.5, lng: 127.0246 };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(reduced = false) {
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  let clock = 0;
  vi.spyOn(window.performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++next, callback);
    return next;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
  const map = new FixtureMapAdapter();
  map.setViewport(
    { width: 1000, height: 800 },
    { x: 0, y: 0, width: 1000, height: 800 },
  );
  map.center(origin, 12);
  const tick = (time: number) => {
    clock = time;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((f) => f(time));
  };
  return { map, frames, tick };
}
describe('click camera motion', () => {
  it('progressively interpolates zoom and center, ending at the requested target', () => {
    const { map, tick } = setup();
    map.center(target, 15, true);
    expect(map.getSnapshot().zoom).toBe(12);
    tick(100);
    expect(map.getSnapshot().zoom).toBeGreaterThan(12);
    expect(map.getSnapshot().zoom).toBeLessThan(15);
    expect(map.getSnapshot().center.lng).toBeGreaterThan(origin.lng);
    expect(map.getSnapshot().center.lng).toBeLessThan(target.lng);
    expect(map.getSnapshot().center.lat).toBeGreaterThan(origin.lat);
    expect(map.getSnapshot().center.lat).toBeLessThan(target.lat);
    tick(300);
    expect(map.getSnapshot().zoom).toBe(15);
    expect(map.getSnapshot().center.lat).toBeCloseTo(target.lat, 9);
    expect(map.getSnapshot().center.lng).toBeCloseTo(target.lng, 9);
  });
  it('retargets the final zoom inside a changed unobscured rectangle', () => {
    const { map, tick } = setup();
    map.center(target, 15, true);
    tick(100);
    map.setViewport(
      { width: 1000, height: 800 },
      { x: 400, y: 0, width: 600, height: 800 },
    );
    tick(400);
    expect(map.getSnapshot().zoom).toBe(15);
    const projected = map.project(target);
    expect(projected.x).toBeCloseTo(700, 6);
    expect(projected.y).toBeCloseTo(400, 6);
  });
  it('accumulates rapid zoom clicks and cancels old frames when direct manipulation starts', () => {
    const { map, tick, frames } = setup();
    map.zoom(1, undefined, true);
    map.zoom(1, undefined, true);
    tick(300);
    expect(map.getSnapshot().zoom).toBe(14);
    map.center(target, 15, true);
    tick(100);
    map.pan({ x: 20, y: 0 });
    const stopped = map.getSnapshot();
    tick(300);
    expect(map.getSnapshot()).toBe(stopped);
    expect(frames.size).toBe(0);
  });
  it('honors reduced motion and clears queued work when the pin releases the anchor or the adapter is destroyed', () => {
    const reduced = setup(true);
    reduced.map.center(target, 15, true);
    expect(reduced.map.getSnapshot().zoom).toBe(15);
    expect(reduced.frames.size).toBe(0);
    const { map, tick, frames } = setup();
    map.center(target, 15, true);
    map.releaseAnchor();
    expect(frames.size).toBe(0);
    map.center(other, 16, true);
    map.destroy();
    const final = map.getSnapshot();
    tick(300);
    expect(map.getSnapshot()).toBe(final);
    expect(frames.size).toBe(0);
  });
});

it('direct zoom interrupts from the displayed zoom rather than the pending click destination', () => {
  const { map, tick } = setup();
  map.center(target, 15, true);
  tick(30);
  const before = map.getSnapshot().zoom;
  map.zoom(-0.25);
  expect(map.getSnapshot().zoom).toBeCloseTo(before - 0.25);
  tick(400);
  expect(map.getSnapshot().zoom).toBeCloseTo(before - 0.25);
});
