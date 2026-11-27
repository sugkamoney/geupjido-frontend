import {
  DEFAULT_RANKING_FILTERS,
  normalizeRankingFilters,
  type RankingFilters,
  type RankingResponse,
} from './contracts';
import { parseRankingResponse, RankingContractError } from './validation';

export class RankingApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`Ranking API request failed (${status})`);
    this.name = 'RankingApiError';
  }
}

export async function fetchRankingZones(
  filters: RankingFilters = DEFAULT_RANKING_FILTERS,
  signal: AbortSignal,
): Promise<RankingResponse> {
  signal.throwIfAborted();
  const params = new URLSearchParams(normalizeRankingFilters(filters));
  const response = await fetch(`/api/v1/rankings/zones?${params}`, {
    method: 'GET',
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  signal.throwIfAborted();

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    signal.throwIfAborted();
    const code =
      body &&
      typeof body === 'object' &&
      'code' in body &&
      typeof body.code === 'string'
        ? body.code
        : undefined;
    throw new RankingApiError(response.status, code);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof SyntaxError)
      throw new RankingContractError('response');
    throw error;
  }
  signal.throwIfAborted();
  return parseRankingResponse(body);
}
