import { DEFAULT_RANKING_FILTERS, type RankingFilters } from './contracts';

export function responseBody(
  filters: RankingFilters = DEFAULT_RANKING_FILTERS,
) {
  return {
    ...filters,
    totalZoneCount: 30,
    rankedZoneCount: 27,
    gradeCounts: [0, 2, 10, 10, 5].map((count, index) => ({
      grade: index + 1,
      count,
    })),
    collectingCount: 8,
    lastCompletedAt: null,
    previousCompletedAt: null,
    zones: [],
  };
}
