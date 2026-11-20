import { worldcupApi, type WorldcupApi } from './api/client';
import type { WorldcupSource } from './source';
/** Example methods deliberately fail: live games can only use the game API hook. */
export function createLiveWorldcupSource(
  api: WorldcupApi = worldcupApi,
): WorldcupSource {
  return {
    api,
    label: '익명 쿠키로 이어하기 · 급지·순위는 3시간마다 반영',
    timeline: { visible: false, entries: [] },
    loadMatch: async () => {
      throw new Error('Use live game API');
    },
    submit: async () => {
      throw new Error('Use live game API');
    },
  };
}
export const liveWorldcupSource = createLiveWorldcupSource();
