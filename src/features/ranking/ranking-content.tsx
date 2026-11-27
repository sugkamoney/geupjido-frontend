import { useState } from 'react';
import { useRankingZones } from './api/use-ranking-zones';
import { RankingPanel, type RankingPanelQuery } from './ranking-panel';

export type RankingSlotContext = {
  signal: AbortSignal;
  onZoneSelected: () => void;
};

export function RankingContent({
  signal,
  query,
  selectedZoneId,
  onQueryChange,
  onSelectZone,
}: {
  signal: AbortSignal;
  query: RankingPanelQuery;
  selectedZoneId?: string;
  onQueryChange: (query: RankingPanelQuery) => void;
  onSelectZone: (id: string, onError: () => void) => void;
}) {
  const ranking = useRankingZones(query);
  const [failure, setFailure] = useState<{ id: string; signal: AbortSignal }>();

  const select = (id: string) => {
    setFailure(undefined);
    onSelectZone(id, () => setFailure({ id, signal }));
  };

  return (
    <RankingPanel
      query={query}
      result={ranking.data}
      status={
        ranking.isError ? 'error' : ranking.isPending ? 'loading' : 'ready'
      }
      selectedZoneId={selectedZoneId}
      onQueryChange={(next) => {
        setFailure(undefined);
        onQueryChange(next);
      }}
      onSelectZone={select}
      onRetry={() => void ranking.refetch()}
      onRetrySelection={
        failure?.signal === signal && !signal.aborted
          ? () => select(failure.id)
          : undefined
      }
    />
  );
}
