import { claimIntroduction } from '../worldcup/intro';
import { WorldcupDialog } from '../worldcup/worldcup-dialog';
import { Timeline, TimelineFilters } from '../worldcup/timeline';
import {
  fixtureWorldcupSource,
  type WorldcupSource,
  type TimelineEntry,
  type Match,
  type Choice,
} from '../worldcup/source';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSearch } from '../search/use-search';
import { fixtureSearchSource, type SearchSource } from '../search/source';
import type { SearchTarget } from '../search/model';
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
  GeoBounds,
  LatLng,
  MapAdapter,
  MapLabel,
  Zone,
} from './types';

const overviewCenter = (bounds: GeoBounds): LatLng => ({
  lat: (bounds.sw.lat + bounds.ne.lat) / 2,
  lng: (bounds.sw.lng + bounds.ne.lng) / 2,
});

export function ExplorationPage({
  adapter: providedAdapter,
  source = fixtureSource,
  data = fixtures,
  searchSource = fixtureSearchSource,
  worldcupSource = fixtureWorldcupSource,
}: {
  adapter?: MapAdapter;
  source?: ExplorationSource;
  data?: ExplorationData;
  searchSource?: SearchSource;
  worldcupSource?: WorldcupSource;
}) {
  const [adapter] = useState(
    () => providedAdapter ?? new FixtureMapAdapter(data.overview),
  );
  const camera = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot);
  const [worldcup, setWorldcup] = useState<{
    zone?: Zone;
    intro: boolean;
    origin: HTMLElement;
  } | null>(null);
  const [picks, setPicks] = useState(0);
  const [ownTimeline, setOwnTimeline] = useState<TimelineEntry[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'zone'>('all');
  const openWorldcup = (origin: HTMLElement, scope?: Zone) =>
    setWorldcup({ zone: scope, intro: claimIntroduction(), origin });
  const recordChoice = (match: Match, choice: Choice) => {
    if (choice === 'skip') return;
    setPicks((n) => n + 1);
    setOwnTimeline((rows) => [
      {
        id: `own-${crypto.randomUUID()}`,
        match,
        picked: choice,
        author: '나',
        time: '방금',
      },
      ...rows,
    ]);
  };
  const [zoneId, setZoneId] = useState<string>();
  const [apartmentId, setApartmentId] = useState<string>();
  const [searchTarget, setSearchTarget] = useState<SearchTarget>();
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
  const searchZone =
    searchTarget?.kind === 'zone'
      ? searchTarget.item
      : searchTarget?.kind === 'apartment'
        ? searchTarget.zone
        : undefined;
  const zone =
    detail.value?.zone ??
    data.zones.find((x) => x.id === zoneId) ??
    (searchZone?.id === zoneId ? searchZone : undefined);
  const apartment =
    detail.value?.apartments.find((x) => x.id === apartmentId) ??
    data.apartments.find((x) => x.id === apartmentId) ??
    (searchTarget?.kind === 'apartment' && searchTarget.item.id === apartmentId
      ? searchTarget.item
      : undefined);
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
  const search = useSearch(searchSource, (target) => {
    setSearchTarget(target);
    if (target.kind === 'apartment') selectApartment(target.item, 'list');
    else selectLabel(target.item);
  });
  const mapData = {
    ...data,
    zones: [
      ...new Map(
        [...data.zones, ...(zone ? [zone] : [])].map((item) => [item.id, item]),
      ).values(),
    ],
    apartments: [
      ...new Map(
        [
          ...data.apartments,
          ...(apartment ? [apartment] : []),
          ...(detail.value?.apartments ?? []),
        ].map((item) => [item.id, item]),
      ).values(),
    ],
  };
  return (
    <>
      <AppShell
        onWorldcupStart={(origin) => openWorldcup(origin)}
        timelineVisible={worldcupSource.timeline.visible}
        timelineHeader={
          <TimelineFilters
            zone={zone}
            filter={timelineFilter}
            onChange={setTimelineFilter}
          />
        }
        timeline={
          <Timeline
            entries={[...ownTimeline, ...worldcupSource.timeline.entries]}
            zone={zone}
            filter={timelineFilter}
            onZone={selectLabel}
          />
        }
        search={search}
        displayLevel={zoneId || camera.zoom >= 12.5 ? 'zone' : 'gu'}
        sheetExpanded={sheetExpanded}
        onSheetExpandedChange={setSheetExpanded}
        onLevelChange={(level) => {
          if (level === 'gu') {
            clear();
            adapter.fit(data.overview, 48, [9.5, 12.49], true);
          } else
            adapter.center(
              zone?.point ?? overviewCenter(data.overview),
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
                onCompare: (origin) => openWorldcup(origin, zone),
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
            data={mapData}
            zoneId={zoneId}
            apartmentId={apartmentId}
            onLabel={selectLabel}
            onApartment={(item) => selectApartment(item, 'map')}
          />
        )}
      />
      {worldcup && (
        <WorldcupDialog
          source={worldcupSource}
          zone={worldcup.zone}
          introduction={worldcup.intro}
          count={picks}
          origin={worldcup.origin}
          onClose={() => setWorldcup(null)}
          onSuccess={recordChoice}
        />
      )}
    </>
  );
}
