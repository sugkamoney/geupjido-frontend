import type { ExplorationData } from '../map-exploration/types';
import { fixtures } from '../map-exploration/fixtures';
import { matchCatalog, type SearchGroup } from './model';
/** Frontend contract, not backend-generated OpenAPI. Never a viewport response. */
export type SearchSource = {
  search: (query: string, signal: AbortSignal) => Promise<SearchGroup[]>;
};
export function createFixtureSearchSource(
  catalog: ExplorationData,
): SearchSource {
  return {
    async search(query, signal) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return matchCatalog(catalog, query);
    },
  };
}
export const fixtureSearchSource = createFixtureSearchSource(fixtures);
