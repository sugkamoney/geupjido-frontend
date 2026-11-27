import { describe, expect, it } from 'vitest';
import { placeMapStatus } from './map-status-placement';

const box = (left: number, top: number, right: number, bottom: number) => ({
  left,
  top,
  right,
  bottom,
});

describe('desktop map status placement', () => {
  it('keeps the Figma anchor across desktop panel configurations', () => {
    for (const left of [64, 432, 826]) {
      expect(
        placeMapStatus(box(left, 0, 1920, 1080), [
          box(left + 12, 16, left + 472, 60),
          box(1860, 960, 1904, 1064),
        ]),
      ).toEqual({ right: 1904, top: 16, width: 440, height: 458 });
    }
  });

  it('finds room below search and alerts while leaving zoom controls reachable', () => {
    expect(
      placeMapStatus(box(826, 0, 1280, 720), [
        box(838, 16, 1264, 60),
        box(838, 68, 1178, 250),
        box(838, 258, 1178, 300),
        box(1220, 604, 1264, 704),
      ]),
    ).toEqual({ right: 1212, top: 308, width: 370, height: 396 });
  });

  it('uses the space beside search results when it fits the trigger', () => {
    expect(
      placeMapStatus(box(620, 0, 1280, 720), [box(630, 16, 990, 650)]),
    ).toEqual({ right: 1264, top: 16, width: 266, height: 458 });
  });

  it('returns no interactive slot when the trigger cannot fit', () => {
    expect(
      placeMapStatus(box(826, 0, 1280, 420), [box(830, 16, 1250, 314)]),
    ).toBeUndefined();
  });
});
