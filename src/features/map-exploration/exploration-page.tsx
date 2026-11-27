import { useZoneNavigation } from './use-zone-navigation';
import { DEFAULT_RANKING_FILTERS } from '../ranking/api/contracts';
import {
  RankingContent,
  type RankingSlotContext,
} from '../ranking/ranking-content';
import { liveWorldcupSource } from '../worldcup/live-source';
import { LiveTimeline } from '../worldcup/live-data';
import { useLiveTimeline } from '../worldcup/use-live-data';
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
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useSearch } from '../search/use-search';
import { fixtureSearchSource, type SearchSource } from '../search/source';
import type { SearchTarget } from '../search/model';
import { AppShell } from '../../components/app-shell/app-shell';
import { fixtures, fixtureSource } from './fixtures';
import { createDefaultMapAdapter } from './map-provider';
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
  ZoneDetail,
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
  worldcupSource: providedWorldcupSource,
  live = false,
  onViewportChange,
  statusContent,
}: {
  adapter?: MapAdapter;
  source?: ExplorationSource;
  data?: ExplorationData;
  searchSource?: SearchSource;
  worldcupSource?: WorldcupSource;
  live?: boolean;
  onViewportChange?: (bounds: GeoBounds, zoom: number) => void;
  statusContent?: ReactNode;
}) {
  const worldcupSource =
    providedWorldcupSource ??
    (live ? liveWorldcupSource : fixtureWorldcupSource);
  const [revision, setRevision] = useState(0);
  const [adapter] = useState(
    () => providedAdapter ?? createDefaultMapAdapter(data),
  );
  const camera = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot);
  const { cancel: cancelZoneNavigation, navigate: navigateZone } =
    useZoneNavigation(source);
  const [rankingQuery, setRankingQuery] = useState(DEFAULT_RANKING_FILTERS);
  const [rankingDetail, setRankingDetail] = useState<{
    source: ExplorationSource;
    value: ZoneDetail;
  }>();

  const [worldcup, setWorldcup] = useState<{
    zone?: Zone;
    intro: boolean;
    origin: HTMLElement;
  } | null>(null);
  const [picks, setPicks] = useState(0);
  const [ownTimeline, setOwnTimeline] = useState<TimelineEntry[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'zone'>('all');
  const openWorldcup = (origin: HTMLElement, scope?: Zone) => {
    cancelZoneNavigation();
    setWorldcup({ zone: scope, intro: claimIntroduction(), origin });
  };
  const recordChoice = (match: Match, choice: Choice) => {
    if (choice === 'skip') return;
    if (live) {
      setPicks((n) => n + 1);
      return;
    }
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
  const [selectedZone, setSelectedZone] = useState<Zone>();
  const [apartmentId, setApartmentId] = useState<string>();
  const [selectedApartment, setSelectedApartment] = useState<Apartment>();
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
  const detail = useZoneDetail(zoneId, source, rankingDetail);
  const searchZone =
    searchTarget?.kind === 'zone'
      ? searchTarget.item
      : searchTarget?.kind === 'apartment'
        ? searchTarget.zone
        : undefined;
  const zone =
    detail.value?.zone ??
    data.zones.find((x) => x.id === zoneId) ??
    (searchZone?.id === zoneId ? searchZone : undefined) ??
    (selectedZone?.id === zoneId ? selectedZone : undefined);
  const liveTimeline = useLiveTimeline(
    worldcupSource.api,
    timelineFilter === 'zone' ? zone?.id : undefined,
    revision,
  );
  if (zone && zone !== selectedZone) setSelectedZone(zone);
  const fallbackItem =
    data.apartments.find((x) => x.id === apartmentId) ??
    (searchTarget?.kind === 'apartment' && searchTarget.item.id === apartmentId
      ? searchTarget.item
      : undefined) ??
    (selectedApartment?.id === apartmentId ? selectedApartment : undefined);
  const retainedPoint =
    selectedApartment?.id === apartmentId
      ? selectedApartment?.point
      : undefined;
  const fallbackApartment = fallbackItem
    ? { ...fallbackItem, point: fallbackItem.point ?? retainedPoint }
    : undefined;
  const detailApartment = detail.value?.apartments.find(
    (x) => x.id === apartmentId,
  );
  const apartment = detailApartment
    ? {
        ...detailApartment,
        point: detailApartment.point ?? fallbackApartment?.point,
      }
    : fallbackApartment;
  // Retain coordinates learned after selection, independently of viewport data.
  if (
    apartment?.point &&
    selectedApartment?.id === apartment.id &&
    (selectedApartment.point?.lat !== apartment.point.lat ||
      selectedApartment.point?.lng !== apartment.point.lng)
  ) {
    setSelectedApartment({ ...selectedApartment, point: apartment.point });
  }
  const clear = () => {
    cancelZoneNavigation();
    setZoneId(undefined);
    setRankingDetail(undefined);
    setSelectedZone(undefined);
    setSearchTarget(undefined);
    setApartmentId(undefined);
    setSelectedApartment(undefined);
    setSheetExpanded(false);
    adapter.releaseAnchor();
  };
  const applyLabelSelection = (label: MapLabel) => {
    setApartmentId(undefined);
    setSelectedApartment(undefined);
    if (label.kind === 'gu' || label.id !== zoneId) setRankingDetail(undefined);
    if (label.kind === 'gu') {
      setZoneId(undefined);
      setSelectedZone(undefined);
      setSearchTarget(undefined);
      setSheetExpanded(false);
      if (label.bounds) adapter.fit(label.bounds, 48, [12.55, 13.5], true);
    } else {
      setSelectedZone({ ...label, kind: 'zone' });
      setZoneId(label.id);
      adapter.center(
        label.point,
        Math.max(adapter.getSnapshot().zoom, 12.5),
        true,
      );
    }
  };
  const selectLabel = (label: MapLabel) => {
    cancelZoneNavigation();
    applyLabelSelection(label);
  };
  const selectApartment = (item: Apartment, origin: 'map' | 'list') => {
    cancelZoneNavigation();
    if (item.zoneId !== zoneId) {
      setRankingDetail(undefined);
      setSelectedZone(data.zones.find((entry) => entry.id === item.zoneId));
    }
    setZoneId(item.zoneId);
    setApartmentId(item.id);
    setSelectedApartment(item);
    if (origin === 'map') adapter.releaseAnchor();
    else if (item.point) {
      setSheetExpanded(false);
      adapter.center(item.point, Math.max(camera.zoom, 15), true);
    }
  };
  const navigateTimelineZone = (id: string, signal: AbortSignal) =>
    navigateZone(id, signal, ({ zone }) => applyLabelSelection(zone));
  const rankingSlot = {
    ranking: ({ signal, onZoneSelected }: RankingSlotContext) => (
      <RankingContent
        signal={signal}
        query={rankingQuery}
        selectedZoneId={zoneId}
        onQueryChange={(query) => {
          cancelZoneNavigation();
          setRankingQuery(query);
        }}
        onSelectZone={(id, onError) => {
          void navigateZone(
            id,
            signal,
            (value) => {
              applyLabelSelection(value.zone);
              setSearchTarget(undefined);
              setSheetExpanded(false);
              setRankingDetail({ source, value });
              onZoneSelected();
            },
            onError,
          );
        }}
      />
    ),
  };
  const search = useSearch(
    searchSource,
    (target) => {
      setSearchTarget(target);
      if (target.kind === 'apartment') selectApartment(target.item, 'list');
      else selectLabel(target.item);
    },
    cancelZoneNavigation,
  );
  const allApartments = new Map<string, Apartment>();
  for (const item of [
    ...data.apartments,
    ...(detail.value?.apartments ?? []),
    ...(apartment ? [apartment] : []),
  ]) {
    allApartments.set(item.id, {
      ...item,
      point: item.point ?? allApartments.get(item.id)?.point,
    });
  }
  const mapData = {
    ...data,
    zones: [
      ...new Map(
        [...data.zones, ...(zone ? [zone] : [])].map((item) => [item.id, item]),
      ).values(),
    ],
    apartments: [...allApartments.values()],
  };
  return (
    <>
      <AppShell
        {...(live ? rankingSlot : {})}
        onWorldcupStart={(origin) => openWorldcup(origin)}
        timelineVisible={
          worldcupSource.api
            ? liveTimeline.visible
            : worldcupSource.timeline.visible
        }
        timelineHeader={
          <TimelineFilters
            zone={zone}
            filter={timelineFilter}
            onChange={setTimelineFilter}
          />
        }
        timeline={
          live && worldcupSource.api ? (
            <LiveTimeline
              filter={timelineFilter}
              model={liveTimeline}
              onZone={navigateTimelineZone}
            />
          ) : (
            <Timeline
              entries={[...ownTimeline, ...worldcupSource.timeline.entries]}
              zone={zone}
              filter={timelineFilter}
              onZone={selectLabel}
            />
          )
        }
        search={search}
        displayLevel={zoneId || camera.zoom >= 12.5 ? 'zone' : 'gu'}
        sheetExpanded={sheetExpanded}
        onSheetExpandedChange={setSheetExpanded}
        onLevelChange={(level) => {
          cancelZoneNavigation();
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
          cancelZoneNavigation();
          if (command === 'fit') {
            adapter.fit(data.overview, 48, [9.5, 12.49], true);
          } else adapter.zoom(command === 'zoom-in' ? 1 : -1, undefined, true);
        }}
        detail={
          zone
            ? buildZoneDetail({
                zone,
                onCompare: (origin) => openWorldcup(origin, zone),
                value: detail.value
                  ? {
                      ...detail.value,
                      apartments: detail.value.apartments.map((item) => ({
                        ...item,
                        point: item.point ?? allApartments.get(item.id)?.point,
                      })),
                    }
                  : undefined,
                failed: detail.failed,
                retry: detail.retry,
                selected: apartment,
                onSelect: (item) => selectApartment(item, 'list'),
              })
            : zoneId
              ? {
                  id: zoneId,
                  title: '권역 정보',
                  location: '',
                  content: (
                    <div role="status">
                      {detail.failed ? (
                        <>
                          <p>권역 정보를 불러오지 못했어요.</p>
                          <button onClick={detail.retry}>다시 불러오기</button>
                        </>
                      ) : (
                        '권역 정보를 불러오고 있어요.'
                      )}
                    </div>
                  ),
                }
              : undefined
        }
        onDetailClose={clear}
        map={({ frame }) => (
          <MapSurface
            adapter={adapter}
            onNavigationStart={cancelZoneNavigation}
            live={live}
            onViewportChange={onViewportChange}
            statusContent={statusContent}
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
          revision={revision}
          onRefresh={() => setRevision((n) => n + 1)}
          zone={worldcup.zone}
          introduction={worldcup.intro}
          count={picks}
          origin={worldcup.origin}
          onClose={() => {
            setWorldcup(null);
            setRevision((n) => n + 1);
          }}
          onSuccess={recordChoice}
        />
      )}
    </>
  );
}
