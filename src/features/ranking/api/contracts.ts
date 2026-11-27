import type { components } from '../../map-exploration/api/generated';

type Schema = components['schemas'];
type ResponseFields = Required<Schema['Response']>;
type ZoneFields = Required<Schema['RankingZone']>;

export type RankingFilters = Pick<ResponseFields, 'region' | 'tab' | 'sort'>;

export type RankingZone = Omit<
  ZoneFields,
  'tier' | 'rank' | 'previousTier' | 'tierDelta'
> & {
  tier: number | null;
  rank: number | null;
  previousTier: number | null;
  tierDelta: number | null;
};

export type RankingResponse = Omit<
  ResponseFields,
  'zones' | 'gradeCounts' | 'lastCompletedAt' | 'previousCompletedAt'
> & {
  zones: RankingZone[];
  gradeCounts: Required<Schema['RankingGradeCount']>[];
  lastCompletedAt: string | null;
  previousCompletedAt: string | null;
};

export const DEFAULT_RANKING_FILTERS: Readonly<RankingFilters> = {
  region: 'ALL',
  tab: 'GRADE_1',
  sort: 'CURRENT',
};

export function normalizeRankingFilters(
  filters: RankingFilters,
): RankingFilters {
  return {
    region: filters.region,
    tab: filters.tab,
    sort: filters.tab === 'COLLECTING' ? 'CURRENT' : filters.sort,
  };
}
