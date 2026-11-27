import { DEFAULT_RANKING_FILTERS, type RankingFilters } from './contracts';

export function responseBody(
  filters: RankingFilters = DEFAULT_RANKING_FILTERS,
) {
  return {
    ...filters,
    totalZoneCount: 30,
    rankedZoneCount: 27,
    gradeCounts: [{ grade: 1, count: 2 }],
    collectingCount: 8,
    lastCompletedAt: null,
    previousCompletedAt: null,
    zones: [],
  };
}
