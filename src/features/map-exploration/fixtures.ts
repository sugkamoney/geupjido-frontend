import type { ExplorationData, ExplorationSource, Zone } from './types';

const zone = (
  id: string,
  name: string,
  district: string,
  lat: number,
  lng: number,
  area: number,
  grade: Zone['grade'],
  /** 한강 방향으로 polygon이 넘어가지 않도록 중심 기준 북/남쪽 한계(lat)를 조정한다. */
  limit: { north?: number; south?: number } = {},
): Zone => {
  const north = limit.north ?? 0.005,
    south = limit.south ?? 0.005;
  return {
    id,
    kind: 'zone',
    name,
    district,
    point: { lat, lng },
    area,
    grade,
    value: `${grade}.0`,
    detail: '검토용 예시 · 순위 미연결',
    bounds: {
      sw: { lat: lat - 0.005, lng: lng - 0.009 },
      ne: { lat: lat + 0.005, lng: lng + 0.009 },
    },
    polygon: [
      { lat: lat + 0.0033 * (north / 0.005), lng: lng - 0.009 },
      { lat: lat + 0.005 * (north / 0.005), lng: lng - 0.0026 },
      { lat: lat + 0.0008 * (north / 0.005), lng: lng + 0.009 },
      { lat: lat - 0.005 * (south / 0.005), lng: lng + 0.0051 },
      { lat: lat - 0.0033 * (south / 0.005), lng: lng - 0.0077 },
    ],
  };
};
/** 실제 지도 기준 대략 위치의 검토용 WGS84 좌표. 경계·지적·NAVER·거래·투표 자료 아님. */
export const fixtures: ExplorationData = {
  overview: {
    sw: { lat: 37.43, lng: 126.98 },
    ne: { lat: 37.575, lng: 127.125 },
  },
  districts: [
    {
      id: 'gangnam',
      kind: 'gu',
      name: '강남구',
      point: { lat: 37.4959, lng: 127.0664 },
      area: 200,
      grade: 1,
      value: '1.0',
      detail: '검토용 평균 · 실제 값 미연결',
      bounds: {
        sw: { lat: 37.46, lng: 127.015 },
        ne: { lat: 37.535, lng: 127.125 },
      },
    },
    {
      id: 'seongdong',
      kind: 'gu',
      name: '성동구',
      point: { lat: 37.5506, lng: 127.0409 },
      area: 160,
      grade: 2,
      value: '2.0',
      detail: '검토용 평균 · 실제 값 미연결',
      bounds: {
        sw: { lat: 37.535, lng: 127.01 },
        ne: { lat: 37.572, lng: 127.075 },
      },
    },
    {
      id: 'seocho',
      kind: 'gu',
      name: '서초구',
      point: { lat: 37.4769, lng: 127.0378 },
      area: 250,
      grade: 3,
      value: '3.0',
      detail: '검토용 평균 · 실제 값 미연결',
      bounds: {
        sw: { lat: 37.43, lng: 126.98 },
        ne: { lat: 37.52, lng: 127.095 },
      },
    },
  ],
  zones: [
    zone('apgujeong', '압구정', '강남구', 37.527, 127.0286, 100, 1, {
      north: 0.004,
    }),
    zone('cheongdam', '청담', '강남구', 37.523, 127.049, 80, 2, {
      north: 0.004,
    }),
    zone('seongsu', '성수', '성동구', 37.5446, 127.056, 120, 3, {
      south: 0.004,
    }),
    zone('banpo', '반포', '서초구', 37.5045, 126.996, 160, 4),
  ],
  apartments: Array.from({ length: 18 }, (_, i) => ({
    id: `apt-${i + 1}`,
    zoneId: 'apgujeong',
    name: i === 0 ? '압구정 검토 단지 1' : `압구정 검토 단지 ${i + 1}`,
    point: {
      lat: 37.525 + Math.floor(i / 5) * 0.0012,
      lng: 127.025 + (i % 5) * 0.0018,
    },
    households: 1800 - i * 50,
  })).concat([
    {
      id: 'cheongdam-apt',
      zoneId: 'cheongdam',
      name: '청담 검토 단지',
      point: { lat: 37.5232, lng: 127.0495 },
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
