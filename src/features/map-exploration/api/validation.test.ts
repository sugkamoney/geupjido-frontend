import { describe, expect, it } from 'vitest';
import {
  geometryBounds,
  MapContractError,
  parseCities,
  parseComplexPins,
  parseSearch,
  parseZoneDetail,
  parseZones,
} from './validation';
import {
  cityRecord,
  complexRecord,
  detailRecord,
  pinRecord,
  polygonRecord,
  searchRecord,
  zoneRecord,
} from './test-data';

describe('map response contracts', () => {
  it('preserves separate initial/vote tiers, ranks, totals and missing prices', () => {
    expect(parseCities([cityRecord])[0]).toMatchObject({
      initialTier: 2.1,
      voteTier: null,
      voteTierZoneCount: 0,
    });
    expect(parseZones([zoneRecord])[0]).toMatchObject({
      initialTier: 2.1,
      voteTier: null,
      initialRank: 2,
      initialRankTotal: 10,
      voteRank: null,
      rankingBasis: 'INITIAL',
    });
    expect(parseZoneDetail(detailRecord).complexes[0]).toEqual(complexRecord);
    const vote = parseZones([
      {
        ...zoneRecord,
        rankingBasis: 'VOTE',
        voteTier: 1.9,
        voteRank: 1,
        voteRankTotal: 2,
      },
    ])[0];
    expect(vote).toMatchObject({
      initialTier: 2.1,
      voteTier: 1.9,
      voteRank: 1,
    });
    expect(
      parseZones([{ ...zoneRecord, initialTier: null, initialRank: null }])[0]
        ?.initialTier,
    ).toBeNull();
  });

  it('preserves price units, dates, pin coordinates and full search groups', () => {
    const complex = {
      ...complexRecord,
      price: 123456,
      representativeArea: 84.91,
      lastDealDate: '2026-09-14',
      zoneRank: 3,
      score: 1456.78,
    };
    expect(
      parseZoneDetail({ ...detailRecord, complexes: [complex] }).complexes[0],
    ).toEqual(complex);
    expect(parseComplexPins([pinRecord])[0]?.location).toEqual({
      longitude: 127.1,
      latitude: 37.5,
    });
    expect(parseSearch(searchRecord)).toEqual(searchRecord);
    expect(parseSearch({ cities: [], zones: [], complexes: [] })).toEqual({
      cities: [],
      zones: [],
      complexes: [],
    });
  });

  it('keeps both polygons and the hole and derives bounds over every island', () => {
    const { polygon } = parseZoneDetail(detailRecord);
    expect(polygon).toEqual(polygonRecord);
    expect(geometryBounds(polygon)).toEqual({
      west: 126,
      south: 35,
      east: 130,
      north: 38,
    });
    const single = {
      type: 'Polygon',
      coordinates: polygonRecord.coordinates[0],
    };
    const parsed = parseZoneDetail({ ...detailRecord, polygon: single });
    expect(parsed.polygon).toEqual(single);
    expect(geometryBounds(parsed.polygon)).toEqual({
      west: 126,
      south: 37,
      east: 128,
      north: 38,
    });
  });

  it.each([
    ['missing field', { ...zoneRecord, id: undefined }],
    ['invalid enum', { ...zoneRecord, rankingBasis: 'UNKNOWN' }],
    [
      'invalid coordinate',
      { ...zoneRecord, center: { longitude: 181, latitude: 37 } },
    ],
    ['non-finite tier', { ...zoneRecord, initialTier: Number.NaN }],
    ['negative count', { ...zoneRecord, complexCount: -1 }],
    ['fractional count', { ...zoneRecord, validVoteCount: 1.5 }],
    ['zero rank', { ...zoneRecord, initialRank: 0 }],
  ])('rejects %s instead of inventing a display value', (_name, record) => {
    expect(() => parseZones([record])).toThrow(MapContractError);
  });

  it.each([
    {
      type: 'LineString',
      coordinates: [
        [127, 37],
        [128, 38],
      ],
    },
    { type: 'MultiPolygon', coordinates: [] },
    {
      type: 'Polygon',
      coordinates: [
        [
          [127, 37],
          [128, 38],
          [127, 37],
        ],
      ],
    },
    {
      type: 'Polygon',
      coordinates: [
        [
          [127, 37],
          [128, 37],
          [128, 38],
          [129, 38],
        ],
      ],
    },
    {
      type: 'Polygon',
      coordinates: [
        [
          [127, 37],
          [128, 37],
          [128, 91],
          [127, 37],
        ],
      ],
    },
  ])(
    'rejects unsupported or malformed geometry without dropping rings',
    (polygon) => {
      expect(() => parseZoneDetail({ ...detailRecord, polygon })).toThrow(
        MapContractError,
      );
    },
  );

  it('rejects malformed records with field paths and without leaking their contents', () => {
    expect(() =>
      parseCities([
        {
          ...cityRecord,
          bounds: { west: 128, south: 37, east: 126, north: 38 },
        },
      ]),
    ).toThrow(MapContractError);
    expect(() =>
      parseZoneDetail({
        ...detailRecord,
        complexes: [{ ...complexRecord, voteCandidate: 'false' }],
      }),
    ).toThrow(MapContractError);
    expect(() =>
      parseZoneDetail({
        ...detailRecord,
        complexes: [{ ...complexRecord, lastDealDate: '2026-02-30' }],
      }),
    ).toThrow(MapContractError);
    expect(() => parseComplexPins([{ ...pinRecord, location: null }])).toThrow(
      /complexes\[0\]\.location/,
    );
    expect(() =>
      parseSearch({ ...searchRecord, zones: 'sensitive-response-value' }),
    ).toThrow('zones');
    expect(() => parseZones({ data: [] })).toThrow(MapContractError);
  });
});
