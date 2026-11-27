import { useCallback, useLayoutEffect, useRef } from 'react';
import type { ExplorationSource, ZoneDetail } from './types';
import { loadZoneDetail } from './use-zone-detail';

/** Ranking and timeline navigation share the same latest user intent. */
export function useZoneNavigation(source: ExplorationSource) {
  const request = useRef<AbortController | undefined>(undefined);
  const cancel = useCallback(() => request.current?.abort(), []);
  useLayoutEffect(() => () => request.current?.abort(), [source]);
  const navigate = async (
    id: string,
    signal: AbortSignal,
    onDetail: (detail: ZoneDetail) => void,
    onError?: () => void,
  ) => {
    if (signal.aborted) return;
    cancel();
    const controller = new AbortController();
    request.current = controller;
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    try {
      const detail = await loadZoneDetail(id, source, controller.signal);
      if (!controller.signal.aborted && !signal.aborted) onDetail(detail);
    } catch (error) {
      if (!controller.signal.aborted && !signal.aborted) {
        if (onError) onError();
        else throw error;
      }
    } finally {
      signal.removeEventListener('abort', abort);
      if (request.current === controller) request.current = undefined;
    }
  };
  return { cancel, navigate };
}
