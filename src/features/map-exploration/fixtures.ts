import type { ExplorationData, ExplorationSource, Zone } from './types';

const zone = (
  id: string,
  name: string,
  district: string,
  x: number,
  y: number,
  area: number,
  grade: Zone['grade'],
): Zone => ({
  id,
  kind: 'zone',
  name,
  district,
  point: { x, y },
  area,
  grade,
  value: `${grade}.0`,
  detail: '검토용 예시 · 순위 미연결',
  bounds: { min: { x: x - 70, y: y - 60 }, max: { x: x + 70, y: y + 60 } },
  polygon: [
    { x: x - 70, y: y - 40 },
    { x: x - 20, y: y - 60 },
    { x: x + 70, y: y - 10 },
    { x: x + 40, y: y + 60 },
    { x: x - 60, y: y + 40 },
  ],
});
/** Invented local geometry/households. Not cadastral, NAVER, trades or voting data. */
export const fixtures: ExplorationData = {
  overview: { min: { x: -750, y: -500 }, max: { x: 750, y: 500 } },
  districts: [
    {
      id: 'gangnam',
      kind: 'gu',
      name: '강남구',
      point: { x: 0, y: 0 },
      area: 200,
      grade: 1,
      value: '1.0',
      detail: '검토용 평균 · 실제 값 미연결',
      bounds: { min: { x: -180, y: -100 }, max: { x: 220, y: 180 } },
    },
    {
      id: 'seongdong',
      kind: 'gu',
      name: '성동구',
      point: { x: 180, y: -220 },
      area: 160,
      grade: 2,
      value: '2.0',
      detail: '검토용 평균 · 실제 값 미연결',
      bounds: { min: { x: 80, y: -330 }, max: { x: 320, y: -100 } },
    },
    {
      id: 'seocho',
      kind: 'gu',
      name: '서초구',
      point: { x: -330, y: 180 },
      area: 250,
      grade: 3,
      value: '3.0',
      detail: '검토용 평균 · 실제 값 미연결',
      bounds: { min: { x: -500, y: 80 }, max: { x: -160, y: 320 } },
    },
  ],
  zones: [
    zone('apgujeong', '압구정', '강남구', 0, 0, 100, 1),
    zone('cheongdam', '청담', '강남구', 180, 70, 80, 2),
    zone('seongsu', '성수', '성동구', 180, -220, 120, 3),
    zone('banpo', '반포', '서초구', -330, 180, 160, 4),
  ],
  apartments: Array.from({ length: 18 }, (_, i) => ({
    id: `apt-${i + 1}`,
    zoneId: 'apgujeong',
    name: i === 0 ? '압구정 검토 단지 1' : `압구정 검토 단지 ${i + 1}`,
    point: { x: ((i % 5) - 2) * 22, y: Math.floor(i / 5) * 22 - 35 },
    households: 1800 - i * 50,
  })).concat([
    {
      id: 'cheongdam-apt',
      zoneId: 'cheongdam',
      name: '청담 검토 단지',
      point: { x: 185, y: 75 },
      households: 900,
    },
  ]),
};
export const fixtureSource: ExplorationSource = {
  async loadZone(id, signal) {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const cancel = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', cancel);
        resolve();
      }, 60);
      signal.addEventListener('abort', cancel, { once: true });
    });
    const found = fixtures.zones.find((x) => x.id === id);
    if (!found) throw new Error('Unknown fixture zone');
    return {
      zone: found,
      apartments: fixtures.apartments.filter((x) => x.zoneId === id),
    };
  },
};
