import { describe, expect, it } from 'vitest';
import { fromWorldPixel, worldPixel } from './mercator';

const apgujeong = { lat: 37.527, lng: 127.0286 };

describe('web mercator', () => {
  it('round-trips WGS84 coordinates through world pixels', () => {
    for (const zoom of [0, 9.5, 12.9, 17]) {
      const back = fromWorldPixel(worldPixel(apgujeong, zoom), zoom);
      expect(Math.abs(back.lat - apgujeong.lat)).toBeLessThan(1e-9);
      expect(Math.abs(back.lng - apgujeong.lng)).toBeLessThan(1e-9);
    }
  });
  it('doubles pixel distances for every zoom level', () => {
    const other = { lat: 37.523, lng: 127.049 };
    const distance = (zoom: number) => {
      const a = worldPixel(apgujeong, zoom);
      const b = worldPixel(other, zoom);
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    expect(distance(15) / distance(14)).toBeCloseTo(2, 9);
  });
  it('uses a 256px world at zoom 0 with the equator and prime meridian centered', () => {
    const origin = worldPixel({ lat: 0, lng: 0 }, 0);
    expect(origin.x).toBeCloseTo(128, 9);
    expect(origin.y).toBeCloseTo(128, 9);
  });
});
