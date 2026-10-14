import { describe, expect, it } from 'vitest';
import { fixtures } from '../map-exploration/fixtures';
import { highlightParts, matchCatalog } from './model';

describe('search matching', () => {
  it('matches zone name or district plus zone and maps a spanning match to both original fields', () => {
    const groups = matchCatalog(fixtures, '강 남 구 압');
    expect(groups.map((x) => x.kind)).toEqual(['zone']);
    const result = groups[0]!.results[0]!;
    expect(result.name).toBe('압구정');
    expect(result.nameParts).toEqual([
      { text: '압', match: true },
      { text: '구정', match: false },
    ]);
    expect(result.contextParts).toEqual([{ text: '강남구', match: true }]);
    expect(
      matchCatalog(fixtures, '남구')[0]!.results.map((x) => x.name),
    ).toEqual(['청담', '압구정']);
  });
  it('ignores case and whitespace while preserving original displayed text and offsets', () => {
    expect(highlightParts('Ra e MIAN', 'r a e m')).toEqual([
      { text: 'Ra e M', match: true },
      { text: 'IAN', match: false },
    ]);
    expect(highlightParts('İ A', 'i\u0307a')).toEqual([
      { text: 'İ A', match: true },
    ]);
    expect(highlightParts('😀 A B', 'ab')).toEqual([
      { text: '😀 ', match: false },
      { text: 'A B', match: true },
    ]);
  });
  it('matches districts with terminal suffix and sorts by position then shorter original name then ID', () => {
    const data = {
      ...fixtures,
      zones: [],
      apartments: [],
      districts: [
        { ...fixtures.districts[0]!, id: 'z', name: '강나시' },
        { ...fixtures.districts[0]!, id: 'b', name: '강남구' },
        { ...fixtures.districts[0]!, id: 'a', name: '강남구' },
        { ...fixtures.districts[0]!, id: 'c', name: '앞강구' },
        { ...fixtures.districts[0]!, id: 'd', name: '강긴이름구' },
      ],
    };
    expect(matchCatalog(data, '강')[0]!.results.map((x) => x.id)).toEqual([
      'a',
      'b',
      'z',
    ]);
    expect(matchCatalog(data, '강남')[0]!.results).toHaveLength(2);
    expect(matchCatalog(data, '강나시')[0]!.results[0]!.name).toBe('강나시');
  });
  it('groups zones, districts and apartments with limits 5/3/6, independent of camera', () => {
    const data = {
      ...fixtures,
      zones: Array.from({ length: 8 }, (_, i) => ({
        ...fixtures.zones[0]!,
        id: i === 0 ? 'apgujeong' : `z${i}`,
        name: `검색 권역 ${i}`,
      })),
      districts: Array.from({ length: 5 }, (_, i) => ({
        ...fixtures.districts[0]!,
        id: `d${i}`,
        name: `검색구${i}`,
      })),
      apartments: Array.from({ length: 9 }, (_, i) => ({
        ...fixtures.apartments[0]!,
        id: `a${i}`,
        name: `검색 단지 ${i}`,
        point: { x: 100000, y: 100000 },
      })),
    };
    const groups = matchCatalog(data, '검색');
    expect(groups.map((x) => [x.kind, x.results.length])).toEqual([
      ['zone', 5],
      ['gu', 3],
      ['apartment', 6],
    ]);
    expect(groups[2]!.results[0]!.target.kind).toBe('apartment');
  });
  it('hides empty groups, has no results for empty/whitespace or unmatched queries, and does not search apartment context', () => {
    for (const query of ['', ' \t\n', '없는검색'])
      expect(matchCatalog(fixtures, query)).toEqual([]);
    expect(matchCatalog(fixtures, '청담').map((x) => x.kind)).toEqual([
      'zone',
      'apartment',
    ]);
    expect(matchCatalog(fixtures, '강남구').map((x) => x.kind)).toEqual([
      'zone',
      'gu',
    ]);
  });
});
