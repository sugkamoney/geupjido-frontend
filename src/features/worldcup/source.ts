import { fixtures } from '../map-exploration/fixtures';
import type { Apartment, Zone } from '../map-exploration/types';
import { describeApartment, type Ratio } from './model';
export type MatchCard = {
  zone: Zone;
  apartment: Apartment;
  description: string;
};
export type Match = {
  id: string;
  kind: 'zone' | 'apartment';
  cards: readonly [MatchCard, MatchCard];
  cursor: number;
};
export type Choice = 0 | 1 | 'skip';
export type TimelineEntry = {
  id: string;
  match: Match;
  picked: 0 | 1;
  author: string;
  time: string;
};
/** Frontend presentation boundary. Not a generated or agreed server contract. */
export type WorldcupSource = {
  label: string;
  timeline: { visible: boolean; entries: TimelineEntry[] };
  loadMatch: (
    zone: Zone | undefined,
    cursor: number,
    signal: AbortSignal,
  ) => Promise<Match | null>;
  submit: (
    match: Match,
    choice: Choice,
    signal: AbortSignal,
  ) => Promise<{ ratio: Ratio }>;
};
export type FixtureScenario =
  | 'mixed'
  | 'hidden'
  | 'unavailable'
  | 'failure'
  | 'pending'
  | 'sparse'
  | 'long';
function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
export function createFixtureWorldcupSource(
  scenario: FixtureScenario = 'mixed',
): WorldcupSource {
  let failNext = scenario === 'failure';
  const apartments = fixtures.apartments.map((a, i) => ({
    ...a,
    year: 1980 + i,
    priceManwon: 34000 - i * 650,
    areaM2: 85,
  }));
  const card = (zone: Zone, index: number): MatchCard => {
    const peers = apartments.filter((a) => a.zoneId === zone.id);
    const apartment = peers[index % peers.length]!;
    return {
      zone,
      apartment:
        scenario === 'long'
          ? {
              ...apartment,
              name: apartment.name + ' 아주 긴 이름과 추가 설명이 있는 아파트',
            }
          : apartment,
      description: describeApartment(apartment, peers, zone.name, 2026),
    };
  };
  const make = (scope: Zone | undefined, cursor: number): Match | null => {
    const zone = scope ?? fixtures.zones[0]!;
    const peers = apartments.filter((a) => a.zoneId === zone.id);
    if (peers.length < 2) return null;
    const same = !!scope || cursor % 2 === 1;
    return {
      id: `fixture-${zone.id}-${cursor}`,
      cursor,
      kind: same ? 'apartment' : 'zone',
      cards: [
        card(zone, cursor),
        same ? card(zone, cursor + 1) : card(fixtures.zones[1]!, 0),
      ],
    };
  };
  return {
    label: '검토용 예시 · 실제 투표·급지 반영 없음 · 기록은 새로고침 시 초기화',
    timeline: {
      visible: scenario !== 'sparse',
      entries: Array.from({ length: 16 }, (_, i) => ({
        id: `example-${i}`,
        match: make(undefined, i)!,
        picked: (i % 2) as 0 | 1,
        author: '검토용 예시 · 익명의 소나무',
        time: '예시',
      })),
    },
    async loadMatch(zone, cursor, signal) {
      await pause(60, signal);
      return make(zone, cursor);
    },
    async submit(match, _choice, signal) {
      await pause(scenario === 'pending' ? 5000 : 140, signal);
      if (failNext) {
        failNext = false;
        throw new Error('Fixture submission failure');
      }
      const ratio: Ratio =
        scenario === 'hidden'
          ? { kind: 'hidden' }
          : scenario === 'unavailable'
            ? { kind: 'unavailable' }
            : scenario === 'mixed' && match.cursor % 3 === 1
              ? { kind: 'hidden' }
              : { kind: 'visible', values: [53, 47] };
      return { ratio };
    },
  };
}
export const fixtureWorldcupSource = createFixtureWorldcupSource();
