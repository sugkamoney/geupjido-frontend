import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { GradeChip } from '../../components/ui';
import type { MapFrame } from '../../components/app-shell/types';
import { MapStatusView } from './map-status';
import { MapTarget } from './map-target';
import { useMapInput } from './use-map-input';
import {
  layoutOverlays,
  polygonOpacity,
  visibleApartments,
  visibleLabels,
} from './model';
import type { Apartment, ExplorationData, MapAdapter, MapLabel } from './types';

export function MapSurface({
  adapter,
  frame,
  data,
  zoneId,
  apartmentId,
  onLabel,
  onApartment,
  onReload = () => window.location.reload(),
}: {
  adapter: MapAdapter;
  frame: MapFrame;
  data: ExplorationData;
  zoneId?: string;
  apartmentId?: string;
  onLabel: (item: MapLabel) => void;
  onApartment: (item: Apartment) => void;
  /** 인증 실패·설정 누락의 `다시 시도`. */
  onReload?: () => void;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLDivElement | null>(null);
  const camera = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot);
  const status = useSyncExternalStore(adapter.subscribe, adapter.getStatus);
  const naver = adapter.kind === 'naver';
  const [size, setSize] = useState({ width: 1000, height: 800 });
  const [hover, setHover] = useState<string>();
  const hoverCurrent = useRef<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearHover = () => {
    clearTimeout(timer.current);
    hoverCurrent.current = undefined;
    setHover(undefined);
  };
  const enter = (id: string, pointerType: string) => {
    if (
      pointerType !== 'mouse' ||
      window.matchMedia?.('(max-width: 767px)').matches
    )
      return;
    clearTimeout(timer.current);
    if (hoverCurrent.current) {
      hoverCurrent.current = id;
      setHover(id);
    } else
      timer.current = setTimeout(() => {
        hoverCurrent.current = id;
        setHover(id);
      }, 100);
  };
  const leave = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      hoverCurrent.current = undefined;
      setHover(undefined);
    }, 120);
  };
  useEffect(() => {
    const off = adapter.subscribe(clearHover);
    return () => {
      off();
      clearTimeout(timer.current);
    };
  }, [adapter]);
  useLayoutEffect(() => {
    // 같은 node로 다시 불러도 adapter가 무시한다(StrictMode 재실행 포함). 정리는 페이지가 destroy로 한다.
    if (canvas.current) adapter.mount(canvas.current);
  }, [adapter]);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => {
      const bounds = node.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const next = { width: bounds.width, height: bounds.height };
      setSize(next);
      adapter.setViewport(next, frame);
    };
    measure();
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(measure)
        : undefined;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [adapter, frame]);
  const input = useMapInput(
    adapter,
    root,
    clearHover,
    naver ? 'observe' : 'drive',
  );
  const ready = status === 'ready';
  // NAVER: overlay를 SDK 입력 요소 안에 portal로 그려 라벨·핀에서 시작한 드래그·휠이 SDK로
  // 전달되게 한다(Step 4b smoke). 좌표 기준은 같은 원점의 container pixel이다.
  const host = ready ? adapter.getOverlayHost?.() : undefined;
  const place = (node: ReactNode) => (host ? createPortal(node, host) : node);
  const layers = layoutOverlays(
    visibleLabels(data, camera.zoom, zoneId),
    visibleApartments(data, camera.zoom, apartmentId),
    adapter.project,
    size,
    zoneId,
    apartmentId,
  );
  const zone = data.zones.find((x) => x.id === zoneId);
  const card = ready
    ? layers.labels.find((x) => x.item.id === hover)
    : undefined;
  const cardWidth = Math.min(250, size.width - 16);
  const cardLeft = card
    ? Math.max(
        8,
        Math.min(size.width - cardWidth - 8, card.point.x - cardWidth / 2),
      )
    : 8;
  const cardTop = card
    ? Math.max(
        8,
        Math.min(
          size.height - 80,
          card.point.y - 53 - 80 >= 8
            ? card.point.y - 53 - 80
            : card.point.y + 12,
        ),
      )
    : 8;
  return (
    <div
      ref={root}
      className="exploration-map"
      role="region"
      aria-label="검토용 지도"
      tabIndex={0}
      data-zoom={camera.zoom}
      data-center-lat={camera.center.lat}
      data-center-lng={camera.center.lng}
      data-frame={JSON.stringify(frame)}
      data-provider={adapter.kind}
      {...input.handlers}
    >
      <div ref={canvas} className="exploration-map-canvas" />
      <div
        className="exploration-fixture-notice"
        style={{
          left: Math.max(12, frame.x + 12),
          maxWidth: Math.max(80, frame.width - 24),
        }}
      >
        <h1>급지도</h1>
        <p>
          <span className="exploration-notice-desktop">
            {naver
              ? '검토용 데이터 · 실제 위치·시세 미검증'
              : '검토용 지도·데이터 · NAVER 지도·실제 시세 미연결'}
          </span>
          <span className="exploration-notice-mobile">
            {naver ? '검토용 데이터' : '검토용 · 지도·시세 미연결'}
          </span>
        </p>
        <span>줌 {camera.zoom.toFixed(2)}</span>
      </div>
      <MapStatusView
        status={status}
        onRetry={() => adapter.retry()}
        onReload={onReload}
      />
      {ready &&
        place(
          <div className="exploration-overlay">
            {zone && polygonOpacity(camera.zoom) > 0 && (
              <svg
                className="exploration-area"
                width={size.width}
                height={size.height}
                aria-hidden="true"
              >
                <polygon
                  data-selected-polygon={zone.id}
                  points={zone.polygon
                    .map((p) => {
                      const point = adapter.project(p);
                      return `${point.x},${point.y}`;
                    })
                    .join(' ')}
                  style={{
                    fill: `var(--map-grade-${zone.grade})`,
                    stroke: `var(--map-grade-${zone.grade})`,
                    fillOpacity: polygonOpacity(camera.zoom),
                  }}
                  strokeWidth={2.5}
                />
              </svg>
            )}
            {layers.labels.map(({ item, point, showLabel }) => (
              <MapTarget
                key={item.id}
                className="exploration-label"
                data-selected={item.id === zoneId}
                data-dot={!showLabel}
                aria-label={`${item.kind === 'zone' ? '권역' : '구'} ${item.name}`}
                aria-pressed={item.id === zoneId}
                style={
                  {
                    left: point.x,
                    top: point.y,
                    '--marker-color': `var(--map-grade-${item.grade})`,
                  } as CSSProperties
                }
                canActivate={input.canActivate}
                capture={!naver}
                onActivate={() => {
                  clearHover();
                  onLabel(item);
                }}
                onPointerEnter={(event) => enter(item.id, event.pointerType)}
                onPointerLeave={leave}
              >
                {showLabel && (
                  <>
                    <span className="exploration-label-house">
                      <img
                        className="exploration-house-asset"
                        src={`/assets/map/${item.id === zoneId ? 'label-selected' : 'label-house'}.svg`}
                        alt=""
                      />
                      <span className="exploration-label-body">
                        <GradeChip grade={item.grade} value={item.value} />
                        <span>{item.name}</span>
                      </span>
                    </span>
                    <span className="exploration-label-stem" />
                  </>
                )}
                <span className="exploration-dot">
                  <img src={`/assets/map/dot-${item.grade}.svg`} alt="" />
                </span>
              </MapTarget>
            ))}
            {layers.pins.map(({ item, point, showName }) => (
              <MapTarget
                key={item.id}
                className="exploration-pin"
                aria-label={`지도 단지 ${item.name}`}
                aria-pressed={item.id === apartmentId}
                data-selected={item.id === apartmentId}
                style={{ left: point.x, top: point.y }}
                canActivate={input.canActivate}
                capture={!naver}
                onActivate={() => {
                  clearHover();
                  onApartment(item);
                }}
              >
                <span className="exploration-pin-name" data-show={showName}>
                  {item.name}
                </span>
                <span className="exploration-pin-body">
                  <span className="exploration-apartment-icon">
                    <img src="/assets/map/apartment-white.svg" alt="" />
                  </span>
                </span>
                <span className="exploration-pin-tail">
                  <img src="/assets/map/pin-tail.svg" alt="" />
                </span>
              </MapTarget>
            ))}
            {card && (
              <div
                role="tooltip"
                className="exploration-hover-card"
                style={{ left: cardLeft, top: cardTop, width: cardWidth }}
              >
                <div>
                  <strong>{card.item.name}</strong>
                  <span>{card.item.district}</span>
                </div>
                <div>
                  <GradeChip grade={card.item.grade} value={card.item.value} />
                  <span>{card.item.detail}</span>
                </div>
              </div>
            )}
          </div>,
        )}
    </div>
  );
}
