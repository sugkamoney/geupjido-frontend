import { useCallback, useEffect, useRef } from 'react';
import type { ExplorationSource, Zone } from './types';

/** Navigation follows user intent, independently of the timeline query filter. */
export function useTimelineNavigation(source: ExplorationSource) {
  const request = useRef<AbortController | undefined>(undefined);
  const cancel = useCallback(() => request.current?.abort(), []);
  useEffect(() => () => request.current?.abort(), [source]);
  const navigate = async (
    id: string,
    signal: AbortSignal,
    onZone: (zone: Zone) => void,
  ) => {
    cancel();
    const controller = new AbortController();
    request.current = controller;
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    try {
      if (signal.aborted) return;
      const detail = await source.loadZone(id, controller.signal);
      if (!controller.signal.aborted && !signal.aborted) onZone(detail.zone);
    } catch (error) {
      if (!controller.signal.aborted && !signal.aborted) throw error;
    } finally {
      signal.removeEventListener('abort', abort);
      if (request.current === controller) request.current = undefined;
    }
  };
  return { cancel, navigate };
}
