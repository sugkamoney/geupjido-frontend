/** Complete synthetic API records. Never production or deployment data. */
export const cityRecord = {
  id: 'city-a',
  regionCode: '11',
  regionName: '서울특별시',
  name: '예시구',
  center: { longitude: 127, latitude: 37.5 },
  bounds: { west: 126, south: 37, east: 128, north: 38 },
  zoneCount: 2,
  initialTierZoneCount: 2,
  voteTierZoneCount: 0,
  initialTier: 2.1,
  voteTier: null,
};

export const zoneRecord = {
  id: 'zone-a',
  cityId: 'city-a',
  cityName: '예시구',
  regionCode: '11',
  regionName: '서울특별시',
  name: '예시권역',
  center: { longitude: 127, latitude: 37.5 },
  initialTier: 2.1,
  voteTier: null,
  rankingBasis: 'INITIAL',
  initialRank: 2,
  initialRankTotal: 10,
  voteRank: null,
  voteRankTotal: 0,
  complexCount: 1,
  validVoteCount: 0,
};

export const pinRecord = {
  id: 'complex-a',
  zoneId: 'zone-a',
  cityName: '예시구',
  zoneName: '예시권역',
  name: '예시단지',
  location: { longitude: 127.1, latitude: 37.5 },
  households: 100,
};

export const complexRecord = {
  id: 'complex-a',
  name: '예시단지',
  zoneRank: null,
  score: null,
  price: null,
  representativeArea: null,
  lastDealDate: null,
  approvalDate: '2001-02-03',
  households: 100,
  voteCandidate: false,
};

export const polygonRecord = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [126, 37],
        [128, 37],
        [128, 38],
        [126, 37],
      ],
      [
        [127, 37.2],
        [127.2, 37.2],
        [127.2, 37.3],
        [127, 37.2],
      ],
    ],
    [
      [
        [129, 35],
        [130, 35],
        [130, 36],
        [129, 35],
      ],
    ],
  ],
};

export const detailRecord = {
  zone: zoneRecord,
  polygon: polygonRecord,
  complexes: [complexRecord],
};

export const searchRecord = {
  cities: [cityRecord],
  zones: [zoneRecord],
  complexes: [pinRecord],
};
