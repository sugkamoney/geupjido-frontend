import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { WorldcupApi } from './api/client';
import type { LiveTimelineEntry, Progress } from './api/contracts';
import type { Zone, ExplorationSource } from '../map-exploration/types';
import { useRead, useReadClock, type useLiveTimeline } from './use-live-data';
export function DailyProgress({
  api,
  revision,
}: {
  api: WorldcupApi;
  revision: number;
}) {
  const tick = useReadClock();
  const read = useRead<Progress>(
    (signal) => api.progress(signal),
    `progress:${revision}:${tick}`,
  );
  return (
    <div className="worldcup-daily" aria-label="오늘 일반 월드컵 진행">
      {read.failed ? (
        <p role="alert">
          오늘 진행을 불러오지 못했어요.{' '}
          <button onClick={read.retry}>진행 다시 불러오기</button>
        </p>
      ) : read.data ? (
        <>
          <p>
            오늘 일반 월드컵 {read.data.completedRounds} /{' '}
            {read.data.dailyLimit}판
          </p>
          <small>
            {read.data.date} 한국 시간 · 선택·넘김 포함 · 권역 비교 제외
          </small>
          <p>
            {read.data.nextMilestone === null
              ? '오늘 목표를 모두 채웠어요.'
              : `${read.data.nextMilestone}판까지 ${read.data.roundsUntilNextMilestone}판 남았어요.`}
          </p>
        </>
      ) : (
        <p role="status">오늘 진행을 불러오고 있어요.</p>
      )}
    </div>
  );
}
function relativeTime(time: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(time)) / 60000),
  );
  return minutes === 0
    ? '방금'
    : minutes < 60
      ? `${minutes}분 전`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}시간 전`
        : `${Math.floor(minutes / 1440)}일 전`;
}
export function LiveTimeline({
  model,
  filter = 'all',
  source,
  onZone,
}: {
  model: ReturnType<typeof useLiveTimeline>;
  filter?: 'all' | 'zone';
  source: ExplorationSource;
  onZone: (zone: Zone) => void;
}) {
  const { all, read, zoneId } = model;
  const root = useRef<HTMLDivElement>(null),
    height = useRef(0),
    previousFilter = useRef(filter);
  const loading = !all.data || !read.data;
  useLayoutEffect(() => {
    if (previousFilter.current !== filter) {
      root.current?.closest('.shell-panel-list')?.scrollTo({ top: 0 });
      previousFilter.current = filter;
    }
    const node = root.current;
    if (node) {
      node.style.minHeight =
        loading && height.current ? `${height.current}px` : '';
      if (!loading && !all.failed && !read.failed)
        height.current = node.offsetHeight;
    }
  }, [filter, loading, all.failed, read.failed, read.data]);
  const request = useRef<AbortController | undefined>(undefined),
    [failed, setFailed] = useState(false);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    request.current?.abort();
  }, [zoneId]);
  const select = async (id: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setFailed(false);
    try {
      const detail = await source.loadZone(id, controller.signal);
      if (!controller.signal.aborted) onZone(detail.zone);
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    }
  };
  const content = () => {
    if (all.failed || read.failed)
      return (
        <p role="alert" className="shell-empty">
          타임라인을 불러오지 못했어요.{' '}
          <button
            onClick={() => {
              all.retry();
              if (read !== all) read.retry();
            }}
          >
            타임라인 다시 불러오기
          </button>
        </p>
      );
    if (!all.data || !read.data)
      return (
        <p className="shell-empty" role="status">
          타임라인을 불러오고 있어요.
        </p>
      );
    // Visibility uses the full public list, never the selected zone's count.
    if (all.data.items.length < 5) return null;
    return (
      <>
        {failed && (
          <p role="alert">
            권역 정보를 불러오지 못했어요. 권역을 다시 눌러 주세요.
          </p>
        )}
        {read.data.items.length ? (
          read.data.items.map((row, index) => (
            <TimelineRow
              key={`${row.selectedAt}:${index}`}
              row={row}
              onZone={(id) => {
                void select(id);
              }}
            />
          ))
        ) : (
          <p className="shell-empty">이 권역의 대진이 아직 없어요.</p>
        )}
      </>
    );
  };
  return (
    <div ref={root} className="worldcup-timeline" aria-busy={loading}>
      {content()}
    </div>
  );
}
function TimelineRow({
  row,
  onZone,
}: {
  row: LiveTimelineEntry;
  onZone: (id: string) => void;
}) {
  return (
    <article className="worldcup-timeline-row">
      <header>
        <span>{row.mine ? '나' : row.displayName}</span>
        <time
          dateTime={row.selectedAt}
          title={new Date(row.selectedAt).toLocaleString('ko-KR')}
        >
          {relativeTime(row.selectedAt)}
        </time>
      </header>
      <div className="worldcup-timeline-pair">
        {[row.left, row.right].map((card, index) => (
          <Fragment key={index}>
            {index === 1 && <span className="worldcup-timeline-vs">vs</span>}
            <button
              className="worldcup-timeline-cell"
              data-picked={row.selectedComplexId === card.complexId}
              onClick={() => onZone(card.zoneId)}
              aria-label={`${card.zoneName} ${card.name} 권역 상세`}
            >
              <span>
                <strong>{card.zoneName}</strong>
                {row.selectedComplexId === card.complexId && (
                  <img src="/assets/images/crown.png" alt="선택" />
                )}
              </span>
              <small>{card.name}</small>
            </button>
          </Fragment>
        ))}
      </div>
    </article>
  );
}
