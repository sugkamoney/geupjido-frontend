import { useLayoutEffect, useRef } from 'react';
import { Button, GradeChip } from '../../components/ui';
import chevronDown from './assets/chevron-down.svg?no-inline';
import homeHeart from './assets/home-heart.svg?no-inline';
import './ranking-panel.css';

const regions = {
  ALL: '전체',
  SEOUL: '서울',
  GYEONGGI_INCHEON: '경기·인천',
} as const;

const tiers = [
  { tab: 'GRADE_1', grade: 1, label: '1급지' },
  { tab: 'GRADE_2', grade: 2, label: '2급지' },
  { tab: 'GRADE_3', grade: 3, label: '3급지' },
  { tab: 'GRADE_4', grade: 4, label: '4급지' },
  { tab: 'GRADE_5', grade: 5, label: '5급지' },
  { tab: 'COLLECTING', grade: null, label: '모으는 중' },
] as const;

const sorts = [
  { value: 'CURRENT', label: '민심 급지 순' },
  { value: 'RISEN', label: '많이 오른 곳' },
  { value: 'FALLEN', label: '많이 내린 곳' },
] as const;

export type RankingPanelQuery = {
  region: keyof typeof regions;
  tab: (typeof tiers)[number]['tab'];
  sort: (typeof sorts)[number]['value'];
};

type RankingPanelZone = {
  zoneId: string;
  name: string;
  cityName: string;
  regionName: string;
  tier: number | null;
  rank: number | null;
  previousTier: number | null;
  tierDelta: number | null;
  movement: 'UP' | 'DOWN' | 'SAME' | 'NONE';
  validVoteCount: number;
  participantCount: number;
  crossZoneVoteCount: number;
};

export type RankingPanelResult = {
  region: RankingPanelQuery['region'];
  gradeCounts: readonly { grade: number; count: number }[];
  collectingCount: number;
  lastCompletedAt: string | null;
  previousCompletedAt: string | null;
  zones: readonly RankingPanelZone[];
};

export type RankingPanelProps = {
  query: RankingPanelQuery;
  result?: RankingPanelResult | null;
  status: 'loading' | 'error' | 'ready';
  onQueryChange: (query: RankingPanelQuery) => void;
  onSelectZone: (zoneId: string) => void;
  onRetry: () => void;
  selectedZoneId?: string | null;
};

const publicationFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function RankingMovement({
  zone,
  hasPreviousPublication,
}: {
  zone: RankingPanelZone;
  hasPreviousPublication: boolean;
}) {
  const { movement, tierDelta, previousTier, tier } = zone;
  if ((movement === 'UP' || movement === 'DOWN') && tierDelta !== null) {
    const up = movement === 'UP';
    const delta = tierDelta.toFixed(1);
    return (
      <span
        className="ranking-movement"
        title={
          previousTier === null
            ? undefined
            : `이전 급지 ${previousTier.toFixed(1)}`
        }
      >
        <span aria-hidden="true">
          {up ? '▲' : '▼'} {delta}
        </span>
        <span className="sr-only">
          {delta} {up ? '상승' : '하락'}
        </span>
      </span>
    );
  }
  if (
    movement === 'NONE' &&
    hasPreviousPublication &&
    previousTier === null &&
    tier !== null
  ) {
    return <span className="ranking-movement">새로</span>;
  }
  return (
    <span className="ranking-movement ranking-movement-muted">
      <span aria-hidden="true">–</span>
      <span className="sr-only">
        {movement === 'SAME' ? '변동 없음' : '이전 급지 비교 없음'}
      </span>
    </span>
  );
}

function RankingZoneRow({
  zone,
  collecting,
  selected,
  hasPreviousPublication,
  onSelectZone,
}: {
  zone: RankingPanelZone;
  collecting: boolean;
  selected: boolean;
  hasPreviousPublication: boolean;
  onSelectZone: RankingPanelProps['onSelectZone'];
}) {
  const grade = tiers.find(
    ({ grade }) => grade === Math.floor(zone.tier ?? 0),
  )?.grade;
  return (
    <li>
      <button
        type="button"
        className="ranking-zone"
        aria-current={selected || undefined}
        onClick={() => onSelectZone(zone.zoneId)}
      >
        <span
          className="ranking-rank"
          data-top={zone.rank !== null && zone.rank <= 3}
          aria-label={zone.rank === null ? '순위 미정' : undefined}
        >
          {zone.rank ?? '–'}
        </span>
        <span className="ranking-zone-label">
          <span className="ranking-zone-name">{zone.name}</span>
          <span className="ranking-zone-region">
            {zone.cityName || zone.regionName}
          </span>
        </span>
        {!collecting && (
          <RankingMovement
            zone={zone}
            hasPreviousPublication={hasPreviousPublication}
          />
        )}
        <GradeChip
          className="ranking-grade"
          grade={grade ?? undefined}
          value={zone.tier?.toFixed(1) ?? '–'}
          aria-label={
            zone.tier === null ? '급지 미정' : `급지 ${zone.tier.toFixed(1)}`
          }
        />
        {collecting && (
          <span className="ranking-progress">
            <span>유효표 {zone.validVoteCount}/50표</span>
            <span>참여자 {zone.participantCount}/10명</span>
            <span>권역 간 유효표 {zone.crossZoneVoteCount}/20표</span>
          </span>
        )}
      </button>
    </li>
  );
}

export function RankingPanel({
  query,
  result,
  status,
  onQueryChange,
  onSelectZone,
  onRetry,
  selectedZoneId,
}: RankingPanelProps) {
  const { region, tab, sort } = query;
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (scroll) scroll.scrollTop = 0;
  }, [region, tab, sort]);

  const collecting = tab === 'COLLECTING';
  const regionResult = result?.region === query.region ? result : undefined;
  const zones = regionResult?.zones ?? [];
  const publication = regionResult?.lastCompletedAt;

  return (
    <section className="ranking-panel" aria-label="랭킹">
      <div className="ranking-header">
        <div className="ranking-heading">
          <h2>랭킹</h2>
          <span className="ranking-basis">
            <img src={homeHeart} width={16} height={16} alt="" />
            민심 급지
          </span>
        </div>
        <p className="ranking-description">
          랭킹은 3시간마다 바뀌어요.
          <br />
          {publication ? (
            <>
              최근 발표{' '}
              <time dateTime={publication}>
                {publicationFormat.format(new Date(publication))}
              </time>
            </>
          ) : regionResult ? (
            '아직 발표된 랭킹이 없어요.'
          ) : (
            '업데이트를 꼭 확인해 보세요!'
          )}
        </p>
        <div className="ranking-tabs" role="group" aria-label="급지">
          {tiers.map(({ tab, grade, label }) => {
            const selected = query.tab === tab;
            const count =
              regionResult &&
              (grade === null
                ? regionResult.collectingCount
                : (regionResult.gradeCounts.find((item) => item.grade === grade)
                    ?.count ?? 0));
            return (
              <button
                key={tab}
                type="button"
                className={
                  grade === null ? 'ranking-tab' : 'ranking-tab ui-grade'
                }
                data-grade={grade ?? undefined}
                aria-pressed={selected}
                disabled={count === 0 && !selected}
                onClick={() =>
                  onQueryChange({
                    ...query,
                    tab,
                    sort: tab === 'COLLECTING' ? 'CURRENT' : query.sort,
                  })
                }
              >
                <span className="ranking-swatch" aria-hidden="true" />
                <span>{label}</span>
                <span className="ranking-count">{count ?? '–'}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="ranking-scroll" ref={scrollRef}>
        <div className="ranking-controls">
          {!collecting && (
            <div className="ranking-sorts" role="group" aria-label="정렬">
              {sorts.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className="ranking-sort"
                  aria-pressed={query.sort === value}
                  onClick={() => onQueryChange({ ...query, sort: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="ranking-region">
            <span aria-hidden="true" className="ranking-region-value">
              {regions[query.region]}
            </span>
            <select
              aria-label="지역"
              value={query.region}
              onChange={(event) =>
                onQueryChange({
                  ...query,
                  region: event.currentTarget
                    .value as RankingPanelQuery['region'],
                })
              }
            >
              {Object.entries(regions).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <img src={chevronDown} width={16} height={16} alt="" />
          </div>
        </div>

        {status === 'loading' && (
          <p className="ranking-status" role="status">
            랭킹을 불러오는 중이에요.
          </p>
        )}
        {status === 'error' && (
          <div className="ranking-status">
            <p role="alert">랭킹을 불러오지 못했어요.</p>
            <Button variant="Outline" onClick={onRetry}>
              다시 시도
            </Button>
          </div>
        )}
        {status === 'ready' &&
          (zones.length === 0 ? (
            <p className="ranking-status" role="status">
              조건에 맞는 권역이 없어요.
            </p>
          ) : (
            <ul className="ranking-zones" role="list" aria-label="권역 목록">
              {zones.map((zone) => (
                <RankingZoneRow
                  key={zone.zoneId}
                  zone={zone}
                  collecting={collecting}
                  selected={selectedZoneId === zone.zoneId}
                  hasPreviousPublication={Boolean(
                    regionResult?.previousCompletedAt,
                  )}
                  onSelectZone={onSelectZone}
                />
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}
