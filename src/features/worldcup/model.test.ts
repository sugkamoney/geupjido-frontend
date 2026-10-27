import { describe, expect, it } from 'vitest';
import { describeApartment, objectParticle, progressDelay } from './model';
import type { Apartment } from '../map-exploration/types';
const apt = (
  id: string,
  households: number,
  year: number,
  priceManwon: number,
): Apartment => ({
  id,
  zoneId: 'a',
  name: id,
  point: { lat: 37.5, lng: 127 },
  households,
  year,
  priceManwon,
});
describe('worldcup presentation', () => {
  it('uses unique maxima in priority order and ignores tied extrema', () => {
    const a = apt('a', 100, 2000, 10000);
    const b = apt('b', 200, 2020, 20000);
    const c = apt('c', 100, 1990, 30000);
    expect(describeApartment(b, [a, b, c], '권역', 2026)).toBe(
      '권역에서 세대수 가장 많은 단지',
    );
    expect(describeApartment(a, [a, b, c], '권역', 2026)).toBe(
      '권역 단지 3곳 중 거래가 3번째',
    );
    expect(describeApartment(c, [a, b, c], '권역', 2026)).toBe(
      '권역에서 거래가 가장 높은 단지',
    );
    expect(
      describeApartment(
        a,
        [a, { ...b, households: 100 }, { ...c, households: 100, year: 2000 }],
        '권역',
        2026,
      ),
    ).toBe('권역 단지 3곳 중 거래가 3번째');
    expect(describeApartment(a, [a], '권역', 2026)).toBe('지은 지 26년');
    expect(
      describeApartment(
        { ...a, year: undefined },
        [{ ...a, year: undefined }],
        '권역',
        2026,
      ),
    ).toBe('단지 정보를 준비하고 있어요');
  });
  it('prioritizes newest then highest transaction then oldest and preserves tied-price ranks', () => {
    const a = apt('a', 100, 2000, 10000),
      b = apt('b', 100, 2020, 20000),
      c = apt('c', 100, 1990, 30000);
    expect(describeApartment(b, [a, b, c], '권역', 2026)).toBe(
      '권역에서 가장 최근에 지은 단지',
    );
    expect(describeApartment(c, [a, b, c], '권역', 2026)).toBe(
      '권역에서 거래가 가장 높은 단지',
    );
    expect(
      describeApartment(
        a,
        [a, { ...b, year: 2000 }, { ...c, priceManwon: 30000 }],
        '권역',
        2026,
      ),
    ).toBe('권역 단지 3곳 중 거래가 3번째');
    const low = { ...c, priceManwon: 10000 };
    expect(describeApartment(low, [a, b, low], '권역', 2026)).toBe(
      '권역에서 가장 오래된 단지',
    );
    expect(
      describeApartment(
        a,
        [a, { ...b, year: 2000 }, { ...c, year: 2000, priceManwon: 10000 }],
        '권역',
        2026,
      ),
    ).toBe('권역 단지 3곳 중 거래가 2번째');
  });
  it('does not infer ratios or use a public disclosure threshold', () => {
    expect(progressDelay({ kind: 'visible', values: [53, 47] }, false)).toBe(
      1100,
    );
    expect(progressDelay({ kind: 'hidden' }, false)).toBe(600);
    expect(progressDelay({ kind: 'unavailable' }, false)).toBe(600);
    expect(progressDelay({ kind: 'visible', values: [53, 47] }, true)).toBe(
      600,
    );
    expect(objectParticle('압구정')).toBe('을');
    expect(objectParticle('청라')).toBe('를');
  });
});
