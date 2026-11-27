import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Button } from '../../components/ui';
import batchIcon from './assets/batch.svg';
import calendarIcon from './assets/calendar.svg';
import chevronIcon from './assets/chevron-down.svg';
import peopleIcon from './assets/people.svg';
import type { MapStatus } from './validation';
import './map-status-card.css';

export type MapStatusCardProps = {
  basis: 'initial' | 'vote';
  data?: MapStatus;
  phase: 'loading' | 'ready' | 'error' | 'refreshing' | 'refresh-error';
  onRetry: () => void;
};

const number = new Intl.NumberFormat('ko-KR');
const koreanTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const phaseMessage = {
  loading: '불러오는 중',
  ready: '',
  error: '지도 상태를 불러오지 못했어요',
  refreshing: '갱신 중',
  'refresh-error': '마지막으로 불러온 정보 · 갱신 실패',
} satisfies Record<MapStatusCardProps['phase'], string>;

const koreanDayPeriods: Readonly<Record<string, string>> = {
  AM: '오전',
  PM: '오후',
};

function Time({ instant }: { instant: string }) {
  const label = koreanTime
    .formatToParts(new Date(instant))
    .map(({ type, value }) =>
      type === 'dayPeriod' ? (koreanDayPeriods[value] ?? value) : value,
    )
    .join('');
  return <time dateTime={instant}>{label}</time>;
}

function useReservationElapsed(instant?: string | null) {
  const deadline = instant ? Date.parse(instant) : Infinity;
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!Number.isFinite(deadline)) return () => {};
      let timer: ReturnType<typeof setTimeout>;
      function schedule() {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          notify();
        } else {
          timer = setTimeout(schedule, Math.min(remaining, 2_147_483_647));
        }
      }
      schedule();
      document.addEventListener('visibilitychange', notify);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('visibilitychange', notify);
      };
    },
    [deadline],
  );
  return useSyncExternalStore(
    subscribe,
    () => Date.now() >= deadline,
    () => false,
  );
}

function Reservation({
  instant,
  elapsed,
}: {
  instant: string | null;
  elapsed: boolean;
}) {
  return (
    <span className="map-status-line map-status-reservation">
      <img src={calendarIcon} alt="" />
      {instant ? (
        <span>
          다음 반영{' '}
          <strong>
            <Time instant={instant} />
          </strong>
        </span>
      ) : (
        <span>예정된 반영 없음</span>
      )}
      {elapsed && (
        <span className="map-status-reservation-note">예약 시각 경과</span>
      )}
    </span>
  );
}

function Distribution({
  segments,
  total,
}: {
  segments: MapStatus['initialGradeCounts'];
  total: number;
}) {
  return (
    <span className="map-status-distribution" aria-hidden="true">
      {segments.map(({ grade, count }) => (
        <span
          key={grade}
          data-grade={grade}
          style={{ flexBasis: total ? `${(count / total) * 100}%` : '0%' }}
        />
      ))}
    </span>
  );
}

function Metric({
  label,
  count,
  unit = '곳',
}: {
  label: string;
  count: number;
  unit?: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <strong>{number.format(count)}</strong>
        {unit}
      </dd>
    </div>
  );
}

function Detail({
  label,
  description,
  count,
  active = false,
}: {
  label: string;
  description: string;
  count: number;
  active?: boolean;
}) {
  return (
    <div className="map-status-detail" data-active={active}>
      <dt>
        <strong>{label}</strong>
        <small>{description}</small>
      </dt>
      <dd>{number.format(count)}곳</dd>
    </div>
  );
}

export function MapStatusCard({
  basis,
  data,
  phase,
  onRetry,
}: MapStatusCardProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();
  const vote = basis === 'vote';
  const basisLabel = vote ? '민심 급지' : '초기 급지';
  const elapsed = useReservationElapsed(vote ? data?.nextScheduledAt : null);
  const grades = [...(data?.initialGradeCounts ?? [])].sort(
    (a, b) => a.grade - b.grade,
  );
  const segments =
    vote && data ? [{ grade: 0, count: data.voteBasedZoneCount }] : grades;
  const message = phaseMessage[phase];
  const busy = phase === 'loading' || phase === 'refreshing';
  const canRetry = phase === 'error' || phase === 'refresh-error';
  const retry = canRetry && (
    <Button
      variant="Subtle"
      className="map-status-retry"
      onClick={() => {
        trigger.current?.focus();
        onRetry();
      }}
    >
      다시 불러오기
    </Button>
  );

  const dismissOnEscape = useCallback((event: KeyboardEvent) => {
    if (
      event.key !== 'Escape' ||
      event.defaultPrevented ||
      event.isComposing ||
      event.keyCode === 229
    ) {
      return;
    }
    event.preventDefault();
    setOpen(false);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function dismissOutside(event: MouseEvent) {
      if (root.current && !event.composedPath().includes(root.current)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', dismissOutside, true);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('click', dismissOutside, true);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [open, dismissOnEscape]);

  return (
    <div
      ref={root}
      className="map-status"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (open) dismissOnEscape(event.nativeEvent);
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="map-status-summary">
        <button
          ref={trigger}
          className="map-status-trigger"
          type="button"
          aria-label={`${basisLabel} 지도 상태`}
          aria-describedby={
            data
              ? [vote && `${panelId}-participation`, `${panelId}-summary`]
                  .filter(Boolean)
                  .join(' ')
              : undefined
          }
          aria-controls={panelId}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span className="map-status-line">
            <img src={vote ? peopleIcon : batchIcon} alt="" />
            {vote && data ? (
              <span id={`${panelId}-participation`}>
                <strong>{number.format(data.participantCount)}</strong>명 참여 ·{' '}
                <strong>{number.format(data.validVoteCount)}</strong>표
              </span>
            ) : (
              <strong>{basisLabel} 기준</strong>
            )}
            <img className="map-status-chevron" src={chevronIcon} alt="" />
          </span>
          {data && (
            <span
              id={`${panelId}-summary`}
              className="map-status-summary-values"
            >
              <span>
                {basisLabel}{' '}
                <strong>
                  {number.format(
                    vote ? data.voteBasedZoneCount : data.initialTierZoneCount,
                  )}
                </strong>{' '}
                / {number.format(data.zoneCount)}곳
              </span>
              <Distribution segments={segments} total={data.zoneCount} />
              {vote && (
                <Reservation instant={data.nextScheduledAt} elapsed={elapsed} />
              )}
            </span>
          )}
        </button>
        <div className="map-status-message" role="status">
          {message}
        </div>
        {!open && retry}
      </div>

      <section
        className="map-status-panel"
        id={panelId}
        aria-labelledby={titleId}
        aria-busy={busy}
        hidden={!open}
        tabIndex={0}
      >
        {open && (
          <>
            <header className="map-status-panel-header">
              <h2 id={titleId}>지금 지도 상태</h2>
              {vote && data && (
                <span>
                  {data.lastCompletedAt ? (
                    <>
                      마지막 집계 <Time instant={data.lastCompletedAt} />
                    </>
                  ) : (
                    '아직 집계 전이에요'
                  )}
                </span>
              )}
            </header>
            {data && (
              <>
                <dl className="map-status-metrics">
                  {vote ? (
                    <>
                      <Metric
                        label="참여한 사람"
                        count={data.participantCount}
                        unit="명"
                      />
                      <Metric
                        label="모인 표"
                        count={data.validVoteCount}
                        unit="표"
                      />
                    </>
                  ) : (
                    <>
                      <Metric
                        label="초기 급지"
                        count={data.initialTierZoneCount}
                      />
                      <Metric
                        label="초기 급지 없음"
                        count={data.missingInitialTierZoneCount}
                      />
                    </>
                  )}
                </dl>
                <Distribution segments={segments} total={data.zoneCount} />
                {!vote && (
                  <ul
                    className="map-status-grades"
                    role="list"
                    aria-label="초기 급지별 권역 수"
                  >
                    {grades.map(({ grade, count }) => (
                      <li key={grade} data-grade={grade}>
                        <span>{grade}급지</span>
                        <strong>{number.format(count)}곳</strong>
                      </li>
                    ))}
                  </ul>
                )}
                <dl className="map-status-details">
                  {vote ? (
                    <>
                      <Detail
                        label="민심 급지"
                        description="투표를 반영해 민심 급지가 정해진 권역"
                        count={data.voteBasedZoneCount}
                        active
                      />
                      <Detail
                        label="모으는 중"
                        description="민심 급지에 반영할 투표를 모으는 권역"
                        count={data.collectingZoneCount}
                      />
                    </>
                  ) : (
                    <Detail
                      label="초기 급지 없음"
                      description="초기 급지가 없는 권역"
                      count={data.missingInitialTierZoneCount}
                    />
                  )}
                </dl>
                {vote && (
                  <footer>
                    <Reservation
                      instant={data.nextScheduledAt}
                      elapsed={elapsed}
                    />
                  </footer>
                )}
              </>
            )}
            {message && <p className="map-status-panel-message">{message}</p>}
            {retry}
          </>
        )}
      </section>
    </div>
  );
}
