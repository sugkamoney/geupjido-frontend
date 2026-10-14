import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppShell } from '../../components/app-shell/app-shell';
import { FixtureMapAdapter } from './fixture-adapter';
import { fixtures, fixtureSource } from './fixtures';
import { MapSurface } from './map-surface';
import { useZoneDetail } from './use-zone-detail';
import { buildZoneDetail } from './zone-detail';
import type {
  Apartment,
  ExplorationData,
  ExplorationSource,
  MapAdapter,
  MapLabel,
} from './types';

export function ExplorationPage({
  adapter: providedAdapter,
  source = fixtureSource,
  data = fixtures,
}: {
  adapter?: MapAdapter;
  source?: ExplorationSource;
  data?: ExplorationData;
}) {
  const [adapter] = useState(
    () => providedAdapter ?? new FixtureMapAdapter(data.overview),
  );
  const camera = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot);
  const [zoneId, setZoneId] = useState<string>();
  const [apartmentId, setApartmentId] = useState<string>();
  const [query, setQuery] = useState('');
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current) adapter.destroy();
      });
    };
  }, [adapter]);
  const detail = useZoneDetail(zoneId, source);
  const zone = data.zones.find((x) => x.id === zoneId);
  const apartment =
    data.apartments.find((x) => x.id === apartmentId) ??
    detail.value?.apartments.find((x) => x.id === apartmentId);
  const clear = () => {
    setZoneId(undefined);
    setApartmentId(undefined);
    setSheetExpanded(false);
    adapter.releaseAnchor();
  };
  const selectLabel = (label: MapLabel) => {
    setApartmentId(undefined);
    if (label.kind === 'gu') {
      setZoneId(undefined);
      setSheetExpanded(false);
      adapter.fit(label.bounds, 48, [12.55, 13.5], true);
    } else {
      setZoneId(label.id);
      adapter.center(label.point, Math.max(camera.zoom, 12.5), true);
    }
  };
  const selectApartment = (item: Apartment, origin: 'map' | 'list') => {
    setZoneId(item.zoneId);
    setApartmentId(item.id);
    if (origin === 'map') adapter.releaseAnchor();
    else {
      setSheetExpanded(false);
      adapter.center(item.point, Math.max(camera.zoom, 15), true);
    }
  };
  return (
    <AppShell
      search={{
        value: query,
        onValueChange: setQuery,
        results: query ? (
          <p className="shell-empty">검색 결과 연결은 후속 작업이에요.</p>
        ) : undefined,
      }}
      displayLevel={zoneId || camera.zoom >= 12.5 ? 'zone' : 'gu'}
      sheetExpanded={sheetExpanded}
      onSheetExpandedChange={setSheetExpanded}
      onLevelChange={(level) => {
        if (level === 'gu') {
          clear();
          adapter.fit(data.overview, 48, [9.5, 12.49], true);
        } else
          adapter.center(
            zone?.point ?? { x: 0, y: 0 },
            Math.max(camera.zoom, 12.9),
            true,
          );
      }}
      onMapCommand={(command) => {
        if (command === 'fit') {
          adapter.fit(data.overview, 48, [9.5, 12.49], true);
        } else adapter.zoom(command === 'zoom-in' ? 1 : -1, undefined, true);
      }}
      detail={
        zone
          ? buildZoneDetail({
              zone,
              value: detail.value,
              failed: detail.failed,
              retry: detail.retry,
              selected: apartment,
              onSelect: (item) => selectApartment(item, 'list'),
            })
          : undefined
      }
      onDetailClose={clear}
      map={({ frame }) => (
        <MapSurface
          adapter={adapter}
          frame={frame}
          data={
            apartment &&
            !data.apartments.some((item) => item.id === apartment.id)
              ? { ...data, apartments: [...data.apartments, apartment] }
              : data
          }
          zoneId={zoneId}
          apartmentId={apartmentId}
          onLabel={selectLabel}
          onApartment={(item) => selectApartment(item, 'map')}
        />
      )}
    />
  );
}
