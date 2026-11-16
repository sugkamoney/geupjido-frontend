import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExplorationPage } from './exploration-page';
import { createDefaultMapAdapter } from './map-provider';
import { createMapApi, MapApiError } from './api/client';
import {
  cityData,
  createLiveSources,
  toApartment,
  toZone,
} from './api/live-source';
import type { MapBounds } from './api/contracts';
import type { ExplorationData, GeoBounds, MapAdapter } from './types';

const apiClient = createMapApi();
const retry = (attempt: number, error: Error) =>
  !(error instanceof MapApiError && error.status < 500) && attempt < 1;
export function LiveExplorationPage({
  api = apiClient,
  createAdapter = createDefaultMapAdapter,
}: {
  api?: ReturnType<typeof createMapApi>;
  createAdapter?: (data: ExplorationData) => MapAdapter;
}) {
  const cities = useQuery({
    queryKey: ['map', 'cities'],
    queryFn: ({ signal }) => api.cities(signal),
    retry,
    retryDelay: 300,
  });
  if (!cities.data?.length)
    return (
      <main className="page">
        <section className="message">
          <h1>급지도</h1>
          <p role="status">
            {cities.isPending
              ? '서비스 지역을 불러오고 있어요.'
              : cities.isError
                ? '지도 데이터를 불러오지 못했어요.'
                : '현재 서비스 지역이 없어요.'}
          </p>
          {!cities.isPending && (
            <button onClick={() => void cities.refetch()}>다시 불러오기</button>
          )}
        </section>
      </main>
    );
  return (
    <LiveMap
      api={api}
      initial={cityData(cities.data)}
      createAdapter={createAdapter}
      catalogError={cities.isError}
      retryCatalog={() => void cities.refetch()}
    />
  );
}

function LiveMap({
  api,
  initial,
  createAdapter,
  catalogError,
  retryCatalog,
}: {
  api: ReturnType<typeof createMapApi>;
  initial: ExplorationData;
  createAdapter: (data: ExplorationData) => MapAdapter;
  catalogError: boolean;
  retryCatalog: () => void;
}) {
  const [adapter] = useState(() => createAdapter(initial));
  const sources = useMemo(() => createLiveSources(api), [api]);
  const [viewport, setViewport] = useState<{
    bounds: MapBounds;
    zoom: number;
  }>();
  const onViewportChange = useCallback((b: GeoBounds, zoom: number) => {
    const value = {
      bounds: {
        west: b.sw.lng,
        south: b.sw.lat,
        east: b.ne.lng,
        north: b.ne.lat,
      },
      zoom,
    };
    setViewport((previous) =>
      JSON.stringify(previous) === JSON.stringify(value) ? previous : value,
    );
  }, []);
  const zonesEnabled = !!viewport && viewport.zoom >= 12.5;
  const pinsEnabled = !!viewport && viewport.zoom >= 14.5;
  const zones = useQuery({
    queryKey: ['map', 'zones', viewport?.bounds],
    enabled: zonesEnabled,
    queryFn: ({ signal }) => api.zones(viewport!.bounds, signal),
    retry,
    retryDelay: 300,
  });
  const pins = useQuery({
    queryKey: ['map', 'complexes', viewport?.bounds],
    enabled: pinsEnabled,
    queryFn: ({ signal }) => api.complexes(viewport!.bounds, signal),
    retry,
    retryDelay: 300,
  });
  const failed =
    (zonesEnabled && zones.isError) || (pinsEnabled && pins.isError);
  const fetching =
    (zonesEnabled && zones.isFetching) || (pinsEnabled && pins.isFetching);
  const empty = zonesEnabled && zones.isSuccess && !zones.data.length;
  const statusContent = failed ? (
    <div role="alert">
      지도 데이터를 불러오지 못했어요.{' '}
      <button
        onClick={() => {
          if (zonesEnabled) void zones.refetch();
          if (pinsEnabled) void pins.refetch();
        }}
      >
        다시 불러오기
      </button>
    </div>
  ) : fetching ? (
    <span role="status">지도 데이터를 불러오고 있어요.</span>
  ) : empty ? (
    <span role="status">현재 지도 범위에 권역이 없어요.</span>
  ) : undefined;
  const data = {
    ...initial,
    zones: zonesEnabled ? (zones.data ?? []).map(toZone) : [],
    apartments: pinsEnabled ? (pins.data ?? []).map(toApartment) : [],
  };
  return (
    <ExplorationPage
      live
      adapter={adapter}
      data={data}
      source={sources.source}
      searchSource={sources.searchSource}
      onViewportChange={onViewportChange}
      statusContent={
        catalogError ? (
          <>
            <div role="alert">
              서비스 지역 갱신에 실패했어요.{' '}
              <button onClick={retryCatalog}>서비스 지역 다시 불러오기</button>
            </div>
            {statusContent}
          </>
        ) : (
          statusContent
        )
      }
    />
  );
}
