export const cardRecord = {
  complexId: 'left',
  name: '왼쪽단지',
  cityName: '예시구',
  zoneName: '예시권역',
  zoneTier: 2.5,
  households: 1000,
  approvalYear: 2005,
  representativeSale: {
    exclusiveAreaSquareMeters: 84.9,
    priceTenThousandWon: 150000,
    contractDate: '2026-10-01',
  },
};
export function gameRecord(done = 0, scope?: string) {
  return {
    baseZoneId: scope ?? 'zone-a',
    tierRangeUsed: scope ? null : 1,
    matchups: Array.from({ length: 10 }, (_, i) => ({
      roundNumber: i + 1,
      type: scope || i < 4 ? 'WITHIN_ZONE' : 'CROSS_ZONE',
      left: { ...cardRecord, complexId: `left-${i + 1}` },
      right: {
        ...cardRecord,
        complexId: `right-${i + 1}`,
        name: '오른쪽단지',
        zoneName: scope || i < 4 ? '예시권역' : '다른권역',
      },
    })),
    selections: Array.from({ length: done }, (_, i) => ({
      roundNumber: i + 1,
      selectedComplexId: `left-${i + 1}`,
      selectedAt: `2026-11-20T01:00:${String(i).padStart(2, '0')}Z`,
    })),
    skips: [] as { roundNumber: number; skippedAt: string }[],
    nextRoundNumber: done === 10 ? null : done + 1,
    completed: done === 10,
    roundResult: null as null | {
      roundNumber: number;
      available: boolean;
      leftPercent: number | null;
      rightPercent: number | null;
    },
  };
}
export const progressRecord = {
  date: '2026-11-20',
  dailyLimit: 60,
  completedRounds: 0,
  remainingRounds: 60,
  nextMilestone: 30,
  roundsUntilNextMilestone: 30,
};
export const zoneSelectionRecord = {
  zoneId: 'zone-a',
  cityName: '예시구',
  zoneName: '예시권역',
  tier: 2.5,
  activeComplexCount: 5,
  canStart: true,
};
export const timelineRecord = {
  items: [
    {
      displayName: '나',
      mine: true,
      selectedAt: '2026-11-20T01:00:00Z',
      left: {
        complexId: 'left-1',
        name: '왼쪽단지',
        zoneId: 'zone-a',
        zoneName: '예시권역',
      },
      right: {
        complexId: 'right-1',
        name: '오른쪽단지',
        zoneId: 'zone-a',
        zoneName: '예시권역',
      },
      selectedComplexId: 'left-1',
    },
  ],
};
