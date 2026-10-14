import { useRef } from 'react';
import { GradeChip } from '../../components/ui';
import type { HighlightPart, SearchGroup, SearchResult } from './model';
const labels = { zone: '권역', gu: '구', apartment: '단지' };
export function Highlight({ parts }: { parts: HighlightPart[] }) {
  return parts.map((part, i) =>
    part.match ? <strong key={i}>{part.text}</strong> : part.text,
  );
}
function ResultRow({
  result,
  id,
  active,
  onSelect,
}: {
  result: SearchResult;
  id: string;
  active: boolean;
  onSelect: () => void;
}) {
  const pointer = useRef<
    { id: number; x: number; y: number; moved: boolean } | undefined
  >(undefined);
  const suppressClick = useRef(false);
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      className="search-result"
      aria-label={`${result.name} ${result.context}`}
      title={`${result.name} ${result.context}`}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse') {
          event.preventDefault();
          suppressClick.current = false;
          return;
        }
        suppressClick.current = true;
        pointer.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        const p = pointer.current;
        if (
          p &&
          p.id === event.pointerId &&
          Math.hypot(event.clientX - p.x, event.clientY - p.y) > 8
        )
          p.moved = true;
      }}
      onPointerCancel={() => {
        pointer.current = undefined;
      }}
      onPointerUp={(event) => {
        const p = pointer.current;
        pointer.current = undefined;
        if (
          p &&
          p.id === event.pointerId &&
          !p.moved &&
          Math.hypot(event.clientX - p.x, event.clientY - p.y) <= 8
        )
          onSelect();
      }}
      onClick={(event) => {
        if (event.detail === 0 || !suppressClick.current) onSelect();
      }}
    >
      {result.target.kind === 'apartment' ? (
        <span className="search-apartment-icon">
          <img src="/assets/icons/search-apartment.svg" alt="" />
        </span>
      ) : (
        <GradeChip
          grade={result.target.item.grade}
          value={result.target.item.value}
          aria-label={`검토용 예시 급지 ${result.target.item.value}`}
        />
      )}
      <span className="search-result-name">
        <Highlight parts={result.nameParts} />
      </span>
      <span className="search-result-context">
        <Highlight parts={result.contextParts} />
      </span>
    </div>
  );
}
export function SearchResults({
  groups,
  listId,
  activeId,
  onSelect,
}: {
  groups: SearchGroup[];
  listId: string;
  activeId: string | undefined;
  onSelect: (result: SearchResult) => void;
}) {
  return (
    <div
      role="listbox"
      id={listId}
      aria-label="검색 결과"
      className="search-listbox"
    >
      {groups.map((group) => (
        <div
          key={group.kind}
          role="group"
          aria-labelledby={`${listId}-${group.kind}-title`}
        >
          <div
            id={`${listId}-${group.kind}-title`}
            className="search-group-title"
          >
            {labels[group.kind]}
          </div>
          {group.results.map((result) => {
            const id = `${listId}-${group.kind}-${encodeURIComponent(result.id)}`;
            return (
              <ResultRow
                key={result.id}
                result={result}
                id={id}
                active={id === activeId}
                onSelect={() => onSelect(result)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
