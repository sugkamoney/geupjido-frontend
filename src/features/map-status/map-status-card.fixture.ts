import type { MapStatus } from './validation';

export const mapStatusFixture = {
  zoneCount: 6,
  initialTierZoneCount: 5,
  missingInitialTierZoneCount: 1,
  voteBasedZoneCount: 2,
  collectingZoneCount: 4,
  initialGradeCounts: [
    { grade: 3, count: 1 },
    { grade: 1, count: 0 },
    { grade: 5, count: 1 },
    { grade: 2, count: 2 },
    { grade: 4, count: 1 },
  ],
  validVoteCount: 95,
  participantCount: 21,
  lastCompletedAt: '2026-11-27T03:00:00Z',
  nextScheduledAt: '2026-11-27T06:00:00Z',
} satisfies MapStatus;
