import type { MapBounds } from './contracts';
import {
  MapContractError,
  parseBounds,
  parseCities,
  parseComplexPins,
  parseSearch,
  parseZoneDetail,
  parseZones,
} from './validation';

export class MapApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    // Server messages may contain internal information; UI owns public copy.
    super(`Map API request failed (${status})`);
    this.name = 'MapApiError';
  }
}

export async function getMap<T>(
  path: string,
  signal: AbortSignal,
  parse: (value: unknown) => T,
): Promise<T> {
  signal.throwIfAborted();
  const response = await fetch(`/api/v1/map${path}`, {
    method: 'GET',
    signal,
    headers: { Accept: 'application/json' },
  });
  signal.throwIfAborted();
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => undefined);
    signal.throwIfAborted();
    const code =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : undefined;
    throw new MapApiError(response.status, code);
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof SyntaxError) throw new MapContractError('response');
    throw error;
  }
  signal.throwIfAborted();
  return parse(value);
}

function boundsQuery(value: MapBounds): string {
  const bounds = parseBounds(value);
  return new URLSearchParams(
    Object.entries(bounds).map(([key, n]) => [key, String(n)]),
  ).toString();
}

/** Read-only transport. Caching, retries and selection state belong to consumers. */
export function createMapApi() {
  return {
    async cities(signal: AbortSignal) {
      return getMap('/cities', signal, parseCities);
    },
    async zones(bounds: MapBounds, signal: AbortSignal) {
      return getMap(`/zones?${boundsQuery(bounds)}`, signal, parseZones);
    },
    async complexes(bounds: MapBounds, signal: AbortSignal) {
      return getMap(
        `/complexes?${boundsQuery(bounds)}`,
        signal,
        parseComplexPins,
      );
    },
    async zone(id: string, signal: AbortSignal) {
      if (!id.trim()) throw new MapContractError('zoneId');
      const detail = await getMap(
        `/zones/${encodeURIComponent(id)}`,
        signal,
        parseZoneDetail,
      );
      if (detail.zone.id !== id) throw new MapContractError('detail.zone.id');
      return detail;
    },
    async search(query: string, signal: AbortSignal) {
      if (!query.trim() || query.length > 80) throw new MapContractError('q');
      return getMap(
        `/search?${new URLSearchParams({ q: query })}`,
        signal,
        parseSearch,
      );
    },
  };
}
