import { useLayoutEffect, useRef } from 'react';
import { formatArea, formatPrice } from './model';
import type { Apartment } from './types';

export function ApartmentList({
  apartments,
  selected,
  onSelect,
}: {
  apartments: Apartment[];
  selected?: string;
  onSelect: (item: Apartment) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    const row = selectedRef.current;
    const list = row?.closest<HTMLElement>('.shell-panel-list');
    if (!row || !list) return;
    const centerRow = () => {
      if (!list.clientHeight) return;
      list.scrollTo?.({
        top:
          list.scrollTop +
          row.getBoundingClientRect().top -
          list.getBoundingClientRect().top -
          (list.clientHeight - row.offsetHeight) / 2,
        behavior: 'instant',
      });
    };
    centerRow();
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(centerRow)
        : undefined;
    observer?.observe(list);
    return () => observer?.disconnect();
  }, [selected, apartments]);
  if (!apartments.length)
    return <p className="shell-empty">이 권역에 표시할 단지가 없어요.</p>;
  return (
    <ol className="exploration-rank-list">
      {apartments.map((item, index) => (
        <li key={item.id}>
          <button
            ref={item.id === selected ? selectedRef : undefined}
            className="exploration-rank-row"
            aria-label={`목록 단지 ${item.name}`}
            aria-pressed={item.id === selected}
            data-selected={item.id === selected}
            onClick={() => onSelect(item)}
          >
            <span
              className="exploration-rank-number"
              data-top={
                item.live ? item.rank != null && item.rank <= 3 : index < 3
              }
            >
              {item.live ? (item.rank ?? '—') : index + 1}
            </span>
            <span className="exploration-rank-name">
              <span>{item.name}</span>
              <small>
                {item.year ? `${item.year}년 · ` : ''}
                {item.households.toLocaleString('ko-KR')}세대
                {item.live ? '' : ' · 예시'}
                {item.live && !item.point ? ' · 위치 정보 없음' : ''}
              </small>
            </span>
            <span className="exploration-rank-value">
              <span>{formatPrice(item.priceManwon)}</span>
              <small>{formatArea(item.areaM2)}</small>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
