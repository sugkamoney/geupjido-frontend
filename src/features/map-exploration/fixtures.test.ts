import { describe, expect, it } from 'vitest';
import { fixtures } from './fixtures';
import type { LatLng } from './types';

const inside = (p: LatLng, polygon: LatLng[]) => {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!,
      b = polygon[j]!;
    if (
      a.lat > p.lat !== b.lat > p.lat &&
      p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng
    )
      result = !result;
  }
  return result;
};
const SEOUL_GU = [
  '강남구',
  '서초구',
  '송파구',
  '강동구',
  '관악구',
  '동작구',
  '영등포구',
  '금천구',
  '구로구',
  '강서구',
  '양천구',
  '마포구',
  '서대문구',
  '은평구',
  '노원구',
  '도봉구',
  '강북구',
  '성북구',
  '중랑구',
  '동대문구',
  '광진구',
  '성동구',
  '용산구',
  '중구',
  '종로구',
];
const GROUPS = [
  '성남·위례',
  '수원',
  '용인',
  '화성',
  '광명',
  '하남',
  '안양',
  '과천',
  '의왕',
  '인천',
];

describe('review fixture coverage', () => {
  const { districts, zones, apartments, overview } = fixtures;
  it('has 25 Seoul gu and 10 Gyeonggi/Incheon groups with 163 zones', () => {
    expect(districts.map((d) => d.name).sort()).toEqual(
      [...SEOUL_GU, ...GROUPS].sort(),
    );
    expect(districts).toHaveLength(35);
    expect(zones).toHaveLength(163);
    expect(zones.filter((z) => SEOUL_GU.includes(z.district!))).toHaveLength(
      132,
    );
  });
  it('lists the requested zones under their district', () => {
    const by = (name: string) =>
      zones.filter((z) => z.district === name).map((z) => z.name);
    expect(by('송파구')).toContain('거여·마천');
    expect(by('은평구')).toContain('갈현');
    expect(by('과천')).toContain('갈현·문원');
    expect(by('성남·위례')).toHaveLength(8);
    expect(by('강남구')).toHaveLength(12);
    expect(by('종로구')).toEqual(['평창', '사직', '창신·숭인']);
  });
  it('keeps ids unique and every zone under an existing district', () => {
    const ids = [...districts, ...zones, ...apartments].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = new Set(districts.map((d) => d.name));
    for (const z of zones) expect(names.has(z.district!)).toBe(true);
  });
  it('places every apartment inside its zone polygon and the overview', () => {
    const byId = new Map(zones.map((z) => [z.id, z]));
    for (const a of apartments) {
      const z = byId.get(a.zoneId)!;
      expect(z, a.id).toBeDefined();
      expect(a.point.lat).toBeGreaterThanOrEqual(z.bounds.sw.lat);
      expect(a.point.lat).toBeLessThanOrEqual(z.bounds.ne.lat);
      expect(a.point.lng).toBeGreaterThanOrEqual(z.bounds.sw.lng);
      expect(a.point.lng).toBeLessThanOrEqual(z.bounds.ne.lng);
      expect(inside(a.point, z.polygon), a.id).toBe(true);
    }
    for (const z of zones) {
      expect(z.point.lat).toBeGreaterThan(overview.sw.lat);
      expect(z.point.lat).toBeLessThan(overview.ne.lat);
      expect(z.point.lng).toBeGreaterThan(overview.sw.lng);
      expect(z.point.lng).toBeLessThan(overview.ne.lng);
    }
  });
  it('keeps polygons of different zones from overlapping', () => {
    const box = (z: (typeof zones)[number]) => ({
      s: Math.min(...z.polygon.map((p) => p.lat)),
      n: Math.max(...z.polygon.map((p) => p.lat)),
      w: Math.min(...z.polygon.map((p) => p.lng)),
      e: Math.max(...z.polygon.map((p) => p.lng)),
    });
    const boxes = zones.map(box);
    for (let i = 0; i < zones.length; i++)
      for (let j = i + 1; j < zones.length; j++) {
        const a = boxes[i]!,
          b = boxes[j]!;
        const overlap = a.n > b.s && b.n > a.s && a.e > b.w && b.e > a.w;
        expect(overlap, `${zones[i]!.id}/${zones[j]!.id}`).toBe(false);
      }
  });
  it('keeps the original three districts, four zones and 19 apartments', () => {
    expect(districts.slice(0, 3).map((d) => d.id)).toEqual([
      'gangnam',
      'seongdong',
      'seocho',
    ]);
    expect(zones.slice(0, 4).map((z) => z.id)).toEqual([
      'apgujeong',
      'cheongdam',
      'seongsu',
      'banpo',
    ]);
    expect(apartments.filter((a) => a.zoneId === 'apgujeong')).toHaveLength(18);
    expect(apartments.filter((a) => a.zoneId === 'cheongdam')[0]).toMatchObject(
      { id: 'cheongdam-apt', households: 900 },
    );
  });
});
