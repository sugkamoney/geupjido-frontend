import {
  parseGame,
  parseProgress,
  parseTimeline,
  parseZones,
} from './validation';
export class WorldcupApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`Worldcup API request failed (${status})`);
    this.name = 'WorldcupApiError';
  }
}
async function request<T>(
  path: string,
  method: string,
  signal: AbortSignal,
  parse: (value: unknown) => T,
  body?: unknown,
): Promise<T> {
  signal.throwIfAborted();
  const response = await fetch(`/api/v1/worldcup${path}`, {
    method,
    signal,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  signal.throwIfAborted();
  if (!response.ok) {
    const value: unknown = await response.json().catch(() => undefined);
    signal.throwIfAborted();
    const code =
      value &&
      typeof value === 'object' &&
      'code' in value &&
      typeof value.code === 'string'
        ? value.code
        : undefined;
    throw new WorldcupApiError(response.status, code);
  }
  const value: unknown = await response.json();
  signal.throwIfAborted();
  return parse(value);
}
const path = (zoneId?: string) =>
  zoneId === undefined
    ? '/games'
    : `/zones/${encodeURIComponent(zoneId)}/games`;
export function createWorldcupApi() {
  return {
    start: (zoneId: string | undefined, signal: AbortSignal) =>
      request(path(zoneId), 'POST', signal, parseGame),
    current: (zoneId: string | undefined, signal: AbortSignal) =>
      request(path(zoneId) + '/current', 'GET', signal, parseGame),
    submit: (
      zoneId: string | undefined,
      round: number,
      choice: string,
      signal: AbortSignal,
    ) =>
      request(
        `${path(zoneId)}/current/rounds/${round}/${choice === 'skip' ? 'skip' : 'vote'}`,
        'PUT',
        signal,
        parseGame,
        choice === 'skip' ? undefined : { selectedComplexId: choice },
      ),
    zones: (signal: AbortSignal) =>
      request('/zones', 'GET', signal, parseZones),
    alternatives: (zoneId: string, signal: AbortSignal) =>
      request(
        `/zones/${encodeURIComponent(zoneId)}/alternatives`,
        'GET',
        signal,
        parseZones,
      ),
    progress: (signal: AbortSignal) =>
      request('/progress', 'GET', signal, parseProgress),
    timeline: (zoneId: string | undefined, signal: AbortSignal) =>
      request(
        '/timeline' +
          (zoneId === undefined ? '' : `?${new URLSearchParams({ zoneId })}`),
        'GET',
        signal,
        parseTimeline,
      ),
  };
}
export type WorldcupApi = ReturnType<typeof createWorldcupApi>;
export const worldcupApi = createWorldcupApi();
