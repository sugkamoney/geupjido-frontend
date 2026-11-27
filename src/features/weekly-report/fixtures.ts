import type {
  WeeklyReportCollectingZone as CollectingZone,
  WeeklyReportDetail as DetailFixture,
  WeeklyReportList as ListFixture,
  WeeklyReportZoneChange as ZoneChange,
} from './contracts';

const collectingZone: CollectingZone = {
  zoneId: 'fixture-zone-collecting',
  zoneName: '샘플 수집 권역',
  cityName: '샘플구',
  regionName: '서울특별시',
  rankingBasis: 'INITIAL',
  validVoteCount: 42,
  participantCount: 12,
  crossZoneVoteCount: 16,
  requiredValidVoteCount: 50,
  requiredParticipantCount: 10,
  requiredCrossZoneVoteCount: 20,
};

const first = {
  reportId: 11,
  periodStart: '2026-11-01T09:00:00Z',
  periodEnd: '2026-11-08T09:00:00Z',
  publishedAt: '2026-11-08T12:00:00Z',
};

const previous = {
  reportId: 17,
  periodStart: first.periodEnd,
  periodEnd: '2026-11-15T09:00:00Z',
  publishedAt: '2026-11-15T12:00:00Z',
};

const latest = {
  reportId: 25,
  periodStart: previous.periodEnd,
  periodEnd: '2026-11-22T09:00:00Z',
  publishedAt: '2026-11-22T12:00:00Z',
};

const rise: ZoneChange = {
  zoneId: 'fixture-zone-rising',
  zoneName: '샘플 상승 권역',
  cityName: '샘플구',
  regionName: '서울특별시',
  previousTier: 3.2,
  currentTier: 2.9,
  tierDelta: 0.3,
};

const fall: ZoneChange = {
  zoneId: 'fixture-zone-falling',
  zoneName: '샘플 하락 권역',
  cityName: '샘플시',
  regionName: '경기도',
  previousTier: 2.1,
  currentTier: 2.2,
  tierDelta: 0.1,
};

const unchangedBoundaryZones = [
  {
    zoneId: fall.zoneId,
    zoneName: fall.zoneName,
    cityName: fall.cityName,
    currentTier: 2.1,
    upperGradeBoundary: 1.9,
    distance: 0.2,
  },
  {
    zoneId: rise.zoneId,
    zoneName: rise.zoneName,
    cityName: rise.cityName,
    currentTier: 3.2,
    upperGradeBoundary: 2.9,
    distance: 0.3,
  },
] satisfies DetailFixture['nearBoundaryZones'];

export const weeklyReportDetailFixtures = {
  first: {
    ...first,
    cutoffCompletedAt: '2026-11-08T09:02:00Z',
    participantCount: 32,
    validVoteCount: 150,
    changedGradeZoneCount: null,
    summary: '첫 주간 리포트가 공개됐어요.',
    previousReportId: null,
    nextReportId: previous.reportId,
    risenZones: [],
    fallenZones: [],
    nearBoundaryZones: unchangedBoundaryZones,
    collectingZones: [],
    cityChanges: [],
  },
  previous: {
    ...previous,
    cutoffCompletedAt: '2026-11-15T09:03:00Z',
    participantCount: 28,
    validVoteCount: 125,
    changedGradeZoneCount: 0,
    summary: '지난 리포트와 비교해 민심 급지 변화가 없었어요.',
    previousReportId: first.reportId,
    nextReportId: latest.reportId,
    risenZones: [],
    fallenZones: [],
    nearBoundaryZones: unchangedBoundaryZones,
    collectingZones: [collectingZone],
    cityChanges: [],
  },
  latest: {
    ...latest,
    cutoffCompletedAt: '2026-11-22T09:01:00Z',
    participantCount: 47,
    validVoteCount: 210,
    changedGradeZoneCount: 1,
    summary: '민심 급지가 오른 권역과 내린 권역이 각각 1곳이에요.',
    previousReportId: previous.reportId,
    nextReportId: null,
    risenZones: [rise],
    fallenZones: [fall],
    nearBoundaryZones: [
      {
        zoneId: fall.zoneId,
        zoneName: fall.zoneName,
        cityName: fall.cityName,
        currentTier: 2.2,
        upperGradeBoundary: 1.9,
        distance: 0.3,
      },
      {
        zoneId: rise.zoneId,
        zoneName: rise.zoneName,
        cityName: rise.cityName,
        currentTier: 2.9,
        upperGradeBoundary: 1.9,
        distance: 1,
      },
    ],
    collectingZones: [collectingZone],
    cityChanges: [
      {
        cityId: 'fixture-city-rising',
        cityName: rise.cityName,
        regionName: rise.regionName,
        previousAverageTier: 3.2,
        currentAverageTier: 2.9,
        averageTierDelta: 0.3,
        movement: 'UP',
        comparedZoneCount: 1,
      },
      {
        cityId: 'fixture-city-falling',
        cityName: fall.cityName,
        regionName: fall.regionName,
        previousAverageTier: 2.1,
        currentAverageTier: 2.2,
        averageTierDelta: 0.1,
        movement: 'DOWN',
        comparedZoneCount: 1,
      },
    ],
  },
} satisfies Record<'first' | 'previous' | 'latest', DetailFixture>;

const publishedReports = [
  { ...latest, latest: true },
  { ...previous, latest: false },
  { ...first, latest: false },
];
const nextReleaseAt = '2026-11-29T12:00:00Z';

export const weeklyReportListFixtures = {
  COLLECTING: {
    state: 'COLLECTING',
    expectedReleaseAt: '2026-11-08T12:00:00Z',
    reports: [],
    collectingZones: [collectingZone],
  },
  PREPARING: {
    state: 'PREPARING',
    expectedReleaseAt: nextReleaseAt,
    reports: publishedReports,
    collectingZones: [],
  },
  DELAYED: {
    state: 'DELAYED',
    expectedReleaseAt: nextReleaseAt,
    reports: publishedReports,
    collectingZones: [],
  },
  PUBLISHED: {
    state: 'PUBLISHED',
    expectedReleaseAt: nextReleaseAt,
    reports: publishedReports,
    collectingZones: [],
  },
} satisfies {
  [State in ListFixture['state']]: ListFixture & { state: State };
};
