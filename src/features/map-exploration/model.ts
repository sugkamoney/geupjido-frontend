import type {
  Apartment,
  ExplorationData,
  MapLabel,
  Point,
  Size,
} from './types';

export function visibleLabels(
  data: ExplorationData,
  zoom: number,
  selected?: string,
): MapLabel[] {
  const labels: MapLabel[] =
    zoom < 12.5 ? [...data.districts] : [...data.zones];
  const zone = data.zones.find((x) => x.id === selected);
  if (zone && !labels.some((x) => x.id === zone.id)) labels.push(zone);
  return labels;
}
export function visibleApartments(
  data: ExplorationData,
  zoom: number,
  selected?: string,
) {
  return [
    ...new Map(
      data.apartments
        .filter((x) => zoom >= 14.5 || x.id === selected)
        .map((x) => [x.id, x]),
    ).values(),
  ];
}
export function polygonOpacity(zoom: number) {
  return zoom < 12.5 ? 0 : 0.3 - Math.max(0, Math.min(1, zoom - 13.5)) * 0.2;
}
type Rect = { x: number; y: number; width: number; height: number };
const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;
const labelRect = (p: Point): Rect => ({
  x: p.x - 43,
  y: p.y - 53,
  width: 86,
  height: 53,
});
const pinRect = (p: Point): Rect => ({
  x: p.x - 14,
  y: p.y - 33,
  width: 28,
  height: 33,
});
const inView = (p: Point, s: Size) =>
  p.x >= 0 && p.y >= 0 && p.x <= s.width && p.y <= s.height;
export function layoutOverlays(
  labels: MapLabel[],
  apartments: Apartment[],
  project: (p: Point) => Point,
  size: Size,
  selectedZone?: string,
  selectedApartment?: string,
) {
  const reserved: Rect[] = [];
  const placedLabels = [...new Map(labels.map((x) => [x.id, x])).values()]
    .sort(
      (a, b) =>
        Number(b.id === selectedZone) - Number(a.id === selectedZone) ||
        b.area - a.area,
    )
    .map((item) => {
      const point = project(item.point),
        rect = labelRect(point);
      const showLabel =
        item.id === selectedZone || !reserved.some((x) => intersects(x, rect));
      if (showLabel && inView(point, size)) reserved.push(rect);
      return { item, point, showLabel };
    })
    .filter((x) => inView(x.point, size));
  const pins = [...new Map(apartments.map((x) => [x.id, x])).values()]
    .map((item) => ({ item, point: project(item.point), showName: false }))
    .filter((x) => inView(x.point, size));
  for (const pin of pins.sort(
    (a, b) =>
      Number(b.item.id === selectedApartment) -
        Number(a.item.id === selectedApartment) ||
      b.item.households - a.item.households,
  )) {
    const fullWidth = pin.item.name.length * 12 + 16;
    const width =
      pin.item.id === selectedApartment ? fullWidth : Math.min(150, fullWidth);
    const name = {
      x: pin.point.x - width / 2,
      y: pin.point.y - 59,
      width,
      height: 22,
    };
    pin.showName =
      pin.item.id === selectedApartment ||
      (!reserved.some((x) => intersects(x, name)) &&
        !pins.some((x) => x !== pin && intersects(pinRect(x.point), name)));
    if (pin.showName) reserved.push(name);
  }
  return { labels: placedLabels, pins };
}
export function formatPrice(value?: number) {
  return value === undefined ? '—' : `${(value / 10000).toFixed(2)}억`;
}
export function formatArea(value?: number) {
  return value === undefined ? '—' : `${Math.round(value)}㎡`;
}
