import type { Apartment } from '../map-exploration/types';
export type Ratio =
  | { kind: 'visible'; values: readonly [number, number] }
  | { kind: 'hidden' | 'unavailable' };
export function progressDelay(ratio: Ratio, reduced: boolean) {
  return ratio.kind === 'visible' && !reduced ? 1100 : 600;
}
export function objectParticle(name: string) {
  const code = name.charCodeAt(name.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0
    ? '을'
    : '를';
}
export function describeApartment(
  item: Apartment,
  peers: Apartment[],
  zone: string,
  currentYear: number,
) {
  const fallback = '단지 정보를 준비하고 있어요';
  if (peers.length === 1)
    return item.year === undefined
      ? fallback
      : `지은 지 ${Math.max(0, currentYear - item.year)}년`;
  const unique = (
    key: 'households' | 'year' | 'priceManwon',
    highest = true,
  ) => {
    const values = peers.map((x) => x[key]);
    if (values.some((x) => x === undefined) || item[key] === undefined)
      return false;
    const extreme = (highest ? Math.max : Math.min)(...(values as number[]));
    return (
      item[key] === extreme && values.filter((x) => x === extreme).length === 1
    );
  };
  if (unique('households')) return `${zone}에서 세대수 가장 많은 단지`;
  if (unique('year')) return `${zone}에서 가장 최근에 지은 단지`;
  if (unique('priceManwon')) return `${zone}에서 거래가 가장 높은 단지`;
  if (unique('year', false)) return `${zone}에서 가장 오래된 단지`;
  if (
    item.priceManwon === undefined ||
    peers.some((x) => x.priceManwon === undefined)
  )
    return fallback;
  const rank =
    peers.filter((x) => x.priceManwon! > item.priceManwon!).length + 1;
  return `${zone} 단지 ${peers.length}곳 중 거래가 ${rank}번째`;
}
