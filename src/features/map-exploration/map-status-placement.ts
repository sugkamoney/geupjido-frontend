type Box = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>;

const inset = 16;
const gap = 8;
const triggerWidth = 256;
const triggerHeight = 124;
const expandedWidth = 440;
const expandedHeight = triggerHeight + gap + 326;

export function placeMapStatus(map: Box, obstacles: Box[]) {
  const left = map.left + inset;
  const right = map.right - inset;
  const top = map.top + inset;
  const bottom = map.bottom - inset;
  const rightEdges = [right, ...obstacles.map((box) => box.left - gap)]
    .filter((edge) => edge <= right && edge - left >= triggerWidth)
    .sort((a, b) => b - a);
  const topEdges = [top, ...obstacles.map((box) => box.bottom + gap)]
    .filter((edge) => edge >= top && bottom - edge >= triggerHeight)
    .sort((a, b) => a - b);
  const leftEdges = [left, ...obstacles.map((box) => box.right + gap)];
  let best:
    { right: number; top: number; width: number; height: number } | undefined;
  let bestArea = 0;

  for (const x of rightEdges) {
    for (const y of topEdges) {
      for (const start of leftEdges) {
        const width = Math.min(expandedWidth, x - Math.max(left, start));
        if (width < triggerWidth) continue;
        let end = Math.min(bottom, y + expandedHeight);
        for (const box of obstacles) {
          if (
            box.right + gap <= x - width ||
            box.left - gap >= x ||
            box.bottom + gap <= y
          )
            continue;
          end = Math.min(end, box.top - gap);
        }
        const height = end - y;
        const area = width * height;
        if (height < triggerHeight || area <= bestArea) continue;
        best = { right: x, top: y, width, height };
        bestArea = area;
        if (width === expandedWidth && height === expandedHeight) return best;
      }
    }
  }
  return best;
}
