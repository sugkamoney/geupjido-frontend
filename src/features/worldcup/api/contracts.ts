import type { components } from '../../map-exploration/api/generated';
type Schema = components['schemas'];
/** Deployed OpenAPI omits required/null annotations. Validated refinements follow BE docs. */
export type GameCard = Omit<
  Required<Schema['MatchCard']>,
  'representativeSale'
> & { representativeSale: Required<Schema['RepresentativeSale']> };
export type GameRound = Omit<Required<Schema['Round']>, 'left' | 'right'> & {
  left: GameCard;
  right: GameCard;
};
export type Game = Omit<
  Required<Schema['WorldcupGameResponse']>,
  | 'matchups'
  | 'selections'
  | 'skips'
  | 'nextRoundNumber'
  | 'roundResult'
  | 'tierRangeUsed'
> & {
  matchups: GameRound[];
  selections: Required<Schema['Selection']>[];
  skips: Required<Schema['Skip']>[];
  nextRoundNumber: number | null;
  tierRangeUsed: number | null;
  roundResult:
    | (Omit<Required<Schema['RoundResult']>, 'leftPercent' | 'rightPercent'> & {
        leftPercent: number | null;
        rightPercent: number | null;
      })
    | null;
};
export type Progress = Omit<
  Required<Schema['WorldcupDailyProgressResponse']>,
  'nextMilestone'
> & { nextMilestone: 30 | 60 | null };
export type WorldcupZone = Omit<
  Required<Schema['WorldcupZoneSelectionResponse']>,
  'tier'
> & { tier: number | null };
export type TimelineCandidate = Required<Schema['Candidate']>;
export type LiveTimelineEntry = Omit<
  Required<Schema['Entry']>,
  'left' | 'right'
> & { left: TimelineCandidate; right: TimelineCandidate };
export type LiveTimeline = { items: LiveTimelineEntry[] };
