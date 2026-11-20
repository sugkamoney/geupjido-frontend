import { useEffect, useRef, useState } from 'react';
import type { WorldcupApi } from './api/client';
/** Read models own their cancellation and never display stale data for a new scope. */
export function useRead<T>(
  load: ((signal: AbortSignal) => Promise<T>) | undefined,
  key: string,
) {
  const [attempt, setAttempt] = useState(0),
    [state, setState] = useState<{ key: string; data?: T; failed?: boolean }>({
      key: '',
    });
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });
  useEffect(() => {
    const load = latest.current;
    if (!load) return;
    const controller = new AbortController();
    let alive = true;
    load(controller.signal).then(
      (data) => {
        if (alive && !controller.signal.aborted) setState({ key, data });
      },
      () => {
        if (alive && !controller.signal.aborted)
          setState({ key, failed: true });
      },
    );
    return () => {
      alive = false;
      controller.abort();
    };
  }, [key, attempt]);
  return {
    ...(state.key === key ? state : {}),
    retry: () => {
      setState({ key });
      setAttempt((a) => a + 1);
    },
  };
}
export function useReadClock() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    const timer = setInterval(update, 60000);
    window.addEventListener('focus', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, []);
  return tick;
}
export function useLiveTimeline(
  api: WorldcupApi | undefined,
  zoneId: string | undefined,
  revision: number,
) {
  const tick = useReadClock();
  const all = useRead(
    api ? (signal) => api.timeline(undefined, signal) : undefined,
    `all:${revision}:${tick}`,
  );
  const scoped = useRead(
    api && zoneId ? (signal) => api.timeline(zoneId, signal) : undefined,
    `scope:${zoneId ?? 'all'}:${revision}:${tick}`,
  );
  const read = zoneId ? scoped : all;
  return {
    all,
    read,
    zoneId,
    visible: !all.data || all.data.items.length >= 5,
  };
}
