import { Button, GradeCard, GradeStage } from '../../components/ui';
import type { ShellDetail } from '../../components/app-shell/types';
import type { Apartment, Zone, ZoneDetail } from './types';
import { ApartmentList } from './apartment-list';

export function buildZoneDetail({
  zone,
  value,
  failed,
  retry,
  selected,
  onSelect,
  onCompare,
}: {
  zone: Zone;
  value?: ZoneDetail;
  failed: boolean;
  retry: () => void;
  selected?: Apartment;
  onSelect: (item: Apartment) => void;
  onCompare?: (origin: HTMLElement) => void;
}): ShellDetail {
  return {
    id: zone.id,
    title: zone.name,
    location: `${zone.region ?? '서울'} › ${zone.district ?? ''}`,
    summary: (
      <GradeCard
        grade={zone.grade}
        value={zone.value}
        label={zone.live ? '초기 급지' : undefined}
        rankText={
          zone.live ? zone.detail : '검토용 예시 · 실제 급지·순위 미연결'
        }
      />
    ),
    collapsedSelection: selected ? (
      <button
        className="exploration-selected-summary"
        onClick={() => onSelect(selected)}
        aria-label={`선택 단지 확대 ${selected.name}`}
      >
        {selected.name}
      </button>
    ) : undefined,
    expandedSummary: zone.live ? (
      <div className="exploration-data-note">
        <p>초기 급지는 현재 서비스의 편집값입니다.</p>
        {selected && !selected.point && (
          <p role="status">
            이 단지의 위치 정보가 없어 지도를 이동할 수 없어요.
          </p>
        )}
      </div>
    ) : zone.stage ? (
      <GradeStage stage={zone.stage} />
    ) : (
      <p className="exploration-data-note">
        단계·가격 데이터는 아직 연결되지 않았어요.
      </p>
    ),
    actions: (
      <Button
        variant="Outline"
        className="w-full"
        disabled={!onCompare}
        onClick={(event) => onCompare?.(event.currentTarget)}
      >
        이 권역 단지 비교하기
      </Button>
    ),
    listTitle: (
      <>
        <h3>
          권역 안 단지 순위{' '}
          <span>{value ? `${value.apartments.length}곳` : ''}</span>
        </h3>
        <p>
          {zone.live
            ? `대표 거래가 · ${zone.rating?.rankingBasis === 'VOTE' ? '투표 점수 기준 순위' : '㎡당 대표 가격 기준 순위'} · 순위 없는 단지도 표시`
            : '현재 순위는 시세순입니다. 검토용 목록은 예시 순서입니다.'}
        </p>
      </>
    ),
    content: failed ? (
      <div className="shell-empty" role="status">
        <p>권역 정보를 불러오지 못했어요.</p>
        <Button variant="Subtle" onClick={retry}>
          다시 불러오기
        </Button>
      </div>
    ) : value ? (
      <ApartmentList
        apartments={value.apartments}
        selected={selected?.id}
        onSelect={onSelect}
      />
    ) : (
      <p className="shell-empty" role="status">
        권역 정보를 불러오고 있어요.
      </p>
    ),
  };
}
