import { useEffect, useState } from 'react';
import type { ExplorationSource, ZoneDetail } from './types';

type Result = {
  id: string;
  source: ExplorationSource;
  value?: ZoneDetail;
  failed?: boolean;
};
export function useZoneDetail(
  id: string | undefined,
  source: ExplorationSource,
) {
  const [result, setResult] = useState<Result>();
  const [retry, setRetry] = useState(0);
  if (result && (result.id !== id || result.source !== source))
    setResult(undefined);
  useEffect(() => {
    if (!id) return;
    const request = new AbortController();
    let current = true;
    // Promise.resolve also turns synchronous source errors into the same error path.
    void Promise.resolve()
      .then(() => source.loadZone(id, request.signal))
      .then((value) => {
        if (current && !request.signal.aborted)
          setResult({
            id,
            source,
            value: {
              ...value,
              apartments: [
                ...new Map(value.apartments.map((x) => [x.id, x])).values(),
              ],
            },
          });
      })
      .catch(() => {
        if (current && !request.signal.aborted)
          setResult({ id, source, failed: true });
      });
    return () => {
      current = false;
      request.abort();
    };
  }, [id, source, retry]);
  const selected =
    result?.id === id && result?.source === source ? result : undefined;
  return {
    value: selected?.value,
    failed: !!selected?.failed,
    retry: () => {
      setResult(undefined);
      setRetry((x) => x + 1);
    },
  };
}
