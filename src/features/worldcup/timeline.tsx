import { Fragment, useRef } from 'react';
import type { TimelineEntry } from './source';
import type { Zone } from '../map-exploration/types';
export function TimelineFilters({
  zone,
  filter,
  onChange,
}: {
  zone?: Zone;
  filter: 'all' | 'zone';
  onChange: (filter: 'all' | 'zone') => void;
}) {
  return (
    <div className="worldcup-filters">
      <button
        aria-pressed={filter === 'all' || !zone}
        onClick={() => onChange('all')}
      >
        전체
      </button>
      {zone && (
        <button
          aria-pressed={filter === 'zone'}
          onClick={() => onChange('zone')}
        >
          {zone.name} 대진
        </button>
      )}
    </div>
  );
}
export function Timeline({
  entries,
  zone,
  filter,
  onZone,
}: {
  entries: TimelineEntry[];
  zone?: Zone;
  filter: 'all' | 'zone';
  onZone: (zone: Zone) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(filter);
  // The list container remains mounted across zone changes; only chip changes reset it.
  const saveRef = (node: HTMLDivElement | null) => {
    ref.current = node;
    if (node && previous.current !== filter) {
      node.closest('.shell-panel-list')?.scrollTo({ top: 0 });
      previous.current = filter;
    }
  };
  const visible =
    filter === 'zone' && zone
      ? entries.filter((row) =>
          row.match.cards.some((card) => card.zone.id === zone.id),
        )
      : entries;
  return (
    <div className="worldcup-timeline" ref={saveRef}>
      {visible.length ? (
        visible.map((row) => (
          <article className="worldcup-timeline-row" key={row.id}>
            <header>
              <span>{row.author}</span>
              <span>{row.time}</span>
            </header>
            <div className="worldcup-timeline-pair">
              {row.match.cards.map((card, index) => (
                <Fragment key={index}>
                  {index === 1 && (
                    <span className="worldcup-timeline-vs">vs</span>
                  )}
                  <button
                    className="worldcup-timeline-cell"
                    data-picked={row.picked === index}
                    onClick={() => onZone(card.zone)}
                    aria-label={`${card.zone.name} ${card.apartment.name} 권역 상세`}
                  >
                    <span>
                      <i className="ui-grade" data-grade={card.zone.grade} />
                      <strong>{card.zone.name}</strong>
                      {row.picked === index && (
                        <img src="/assets/images/crown.png" alt="선택" />
                      )}
                    </span>
                    <small>{card.apartment.name}</small>
                  </button>
                </Fragment>
              ))}
            </div>
          </article>
        ))
      ) : (
        <p className="shell-empty">이 권역의 대진이 아직 없어요.</p>
      )}
    </div>
  );
}
