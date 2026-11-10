import { FixtureMapAdapter } from './fixture-adapter';
import { createNaverLoader } from './naver/loader';
import { NaverMapAdapter } from './naver/naver-adapter';
import type { ExplorationData, MapAdapter } from './types';

/**
 * 기본 adapter만 env로 고른다. 입력 모드·고지·배경은 화면이 `adapter.kind`로 정한다.
 * `VITE_MAP_PROVIDER=fixture`이면 fixture, 그 외(미설정 포함)는 NAVER.
 */
export function createDefaultMapAdapter(data: ExplorationData): MapAdapter {
  if (import.meta.env.VITE_MAP_PROVIDER === 'fixture')
    return new FixtureMapAdapter(data.overview);
  return new NaverMapAdapter({
    loader: createNaverLoader({
      clientId: import.meta.env.VITE_NAVER_MAP_CLIENT_ID,
    }),
    overview: data.overview,
  });
}
