import type { LatLng, Point } from './types';

const TILE_SIZE = 256;
const worldSize = (zoom: number) => TILE_SIZE * 2 ** zoom;

/** WGS84 좌표를 256px 타일 Web Mercator 세계 pixel로 바꾼다. */
export function worldPixel(point: LatLng, zoom: number): Point {
  const size = worldSize(zoom);
  const sin = Math.sin((point.lat * Math.PI) / 180);
  return {
    x: ((point.lng + 180) / 360) * size,
    y: (0.5 - Math.atanh(sin) / (2 * Math.PI)) * size,
  };
}

/** `worldPixel`의 역변환. */
export function fromWorldPixel(point: Point, zoom: number): LatLng {
  const size = worldSize(zoom);
  return {
    lat:
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * point.y) / size))) * 180) /
      Math.PI,
    lng: (point.x / size) * 360 - 180,
  };
}
