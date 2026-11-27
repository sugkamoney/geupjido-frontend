import { useQuery } from '@tanstack/react-query';
import { fetchRankingZones } from './client';
import {
  DEFAULT_RANKING_FILTERS,
  normalizeRankingFilters,
  type RankingFilters,
} from './contracts';

export function useRankingZones(
  filters: RankingFilters = DEFAULT_RANKING_FILTERS,
  enabled = true,
) {
  const applied = normalizeRankingFilters(filters);
  return useQuery({
    queryKey: ['ranking', 'zones', applied.region, applied.tab, applied.sort],
    queryFn: ({ signal }) => fetchRankingZones(applied, signal),
    enabled,
    retry: false,
  });
}
