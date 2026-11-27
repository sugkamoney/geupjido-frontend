import { useEffect, useState } from 'react';
import type { ExplorationSource, ZoneDetail } from './types';

type Result = {
  id: string;
  source: ExplorationSource;
  value?: ZoneDetail;
  failed?: boolean;
};
export async function loadZoneDetail(
  id: string,
  source: ExplorationSource,
  signal: AbortSignal,
): Promise<ZoneDetail> {
  signal.throwIfAborted();
  const value = await source.loadZone(id, signal);
  signal.throwIfAborted();
  if (
    value.zone.id !== id ||
    value.apartments.some((item) => item.zoneId !== id)
  )
    throw new Error('Detail response does not match the selected zone');
  return {
    ...value,
    apartments: [
      ...new Map(value.apartments.map((item) => [item.id, item])).values(),
    ],
  };
}

export function useZoneDetail(
  id: string | undefined,
  source: ExplorationSource,
  preload?: { source: ExplorationSource; value: ZoneDetail },
) {
  const loaded =
    preload?.source === source && preload.value.zone.id === id
      ? preload.value
      : undefined;
  const [result, setResult] = useState<Result>();
  const [retry, setRetry] = useState(0);
  if (result && (result.id !== id || result.source !== source))
    setResult(undefined);
  useEffect(() => {
    if (!id || loaded) return;
    const request = new AbortController();
    let current = true;
    void loadZoneDetail(id, source, request.signal)
      .then((value) => {
        if (current && !request.signal.aborted)
          setResult({ id, source, value });
      })
      .catch(() => {
        if (current && !request.signal.aborted)
          setResult({ id, source, failed: true });
      });
    return () => {
      current = false;
      request.abort();
    };
  }, [id, source, retry, loaded]);
  const selected =
    result?.id === id && result?.source === source ? result : undefined;
  return {
    value: loaded ?? selected?.value,
    failed: !loaded && !!selected?.failed,
    retry: () => {
      setResult(undefined);
      setRetry((x) => x + 1);
    },
  };
}
