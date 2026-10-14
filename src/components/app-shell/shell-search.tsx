import { useRef, type KeyboardEvent, type RefObject } from 'react';
import { CloseButton, SearchField } from '../ui';
import type { DisplayLevel, ShellSearch } from './types';

export function ShellSearchRow({
  search,
  compact,
  editing,
  onEditingChange,
  onSelection,
  level,
  onLevelChange,
  inputRef,
}: {
  search: ShellSearch;
  compact: boolean;
  editing: boolean;
  onEditingChange: (open: boolean) => void;
  onSelection: () => void;
  level: DisplayLevel;
  onLevelChange: (level: DisplayLevel) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const suppressOpen = useRef(false);
  const close = () => {
    onEditingChange(false);
    search.onResultsOpenChange?.(false);
    suppressOpen.current = true;
    inputRef.current?.focus({ preventScroll: true });
    queueMicrotask(() => {
      suppressOpen.current = false;
    });
  };
  const finishSelection = () => {
    onSelection();
    close();
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
      return;
    if (event.key === 'Escape') {
      if (editing) {
        event.preventDefault();
        close();
      }
      return;
    }
    if (event.defaultPrevented || !editing || event.key !== 'Tab') return;
    const controls = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'input, button:not(:disabled), [tabindex="0"]',
      ),
    ].filter((element) => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  return (
    <div
      className="shell-search-row"
      data-editing={editing}
      data-layout-region
      role={editing ? 'dialog' : undefined}
      aria-modal={editing || undefined}
      aria-label={editing ? '지역 검색' : undefined}
      onKeyDown={keyboard}
      data-search-feature={search.resultsOpen !== undefined || undefined}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          search.onResultsOpenChange?.(false);
      }}
    >
      <div className="shell-search-input-row">
        {compact && (
          <img
            className="shell-search-symbol"
            src="/assets/images/shell-symbol.svg"
            alt=""
          />
        )}
        <SearchField
          {...search.inputProps}
          ref={inputRef}
          label="지역 검색"
          onKeyDown={(event) => {
            search.inputProps?.onKeyDown?.(event);
            search.onKeyDown?.(event, finishSelection);
            if (
              compact &&
              event.defaultPrevented &&
              !event.isPropagationStopped() &&
              (event.key === 'ArrowDown' || event.key === 'ArrowUp')
            )
              onEditingChange(true);
          }}
          value={search.value}
          onValueChange={(value) => {
            search.onValueChange(value);
            if (compact) onEditingChange(true);
          }}
          onFocus={() => {
            if (!suppressOpen.current) {
              search.onResultsOpenChange?.(true);
              if (compact) onEditingChange(true);
            }
          }}
          onPointerDown={() => {
            search.onResultsOpenChange?.(true);
            if (compact) onEditingChange(true);
          }}
        />
        {editing && <CloseButton label="검색 닫기" onClick={close} />}
      </div>
      {!editing && (
        <div
          className="shell-level-toggle"
          role="group"
          aria-label="지도 표시 단위"
        >
          <button
            aria-pressed={level === 'gu'}
            onClick={() => onLevelChange('gu')}
          >
            구
          </button>
          <button
            aria-pressed={level === 'zone'}
            onClick={() => onLevelChange('zone')}
          >
            권역
          </button>
        </div>
      )}
      {(search.resultsOpen ?? (editing || !!search.value)) && (
        <div
          className="shell-search-results"
          data-layout-region
          aria-label="검색 콘텐츠"
        >
          <SearchContent
            results={search.results}
            finishSelection={finishSelection}
            focusInput={() => inputRef.current?.focus({ preventScroll: true })}
          />
        </div>
      )}
    </div>
  );
}

function SearchContent({
  results,
  finishSelection,
  focusInput,
}: {
  results: ShellSearch['results'];
  finishSelection: () => void;
  focusInput: () => void;
}) {
  return typeof results === 'function'
    ? results({ finishSelection, focusInput })
    : (results ?? <p>검색을 준비하고 있어요.</p>);
}
