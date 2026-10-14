import { useEffect, useId, useRef, useState } from 'react';
import type { ShellSearch } from '../../components/app-shell/types';
import {
  normalizeQuery,
  type SearchGroup,
  type SearchResult,
  type SearchTarget,
} from './model';
import { SearchResults } from './search-results';
import type { SearchSource } from './source';
type Response = {
  query: string;
  source: SearchSource;
  retry: number;
  groups?: SearchGroup[];
  failed?: boolean;
};
export function useSearch(
  source: SearchSource,
  onSelect: (target: SearchTarget) => void,
): ShellSearch {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number>();
  const [response, setResponse] = useState<Response>();
  const [retry, setRetry] = useState(0);
  const listId = `search-${useId()}`;
  const composing = useRef(false);
  const ended = useRef<number | undefined>(undefined);
  const nonempty = !!normalizeQuery(query);
  const current =
    response?.query === query &&
    response.source === source &&
    response.retry === retry
      ? response
      : undefined;
  const groups = current?.groups ?? [];
  const results = groups.flatMap((group) => group.results);
  const selected = active === undefined ? undefined : results[active];
  const activeId = selected
    ? `${listId}-${selected.target.kind}-${encodeURIComponent(selected.id)}`
    : undefined;
  useEffect(() => {
    if (!normalizeQuery(query)) return;
    const request = new AbortController();
    let valid = true;
    void Promise.resolve()
      .then(() => source.search(query, request.signal))
      .then((groups) => {
        if (valid && !request.signal.aborted)
          setResponse({ query, source, retry, groups });
      })
      .catch(() => {
        if (valid && !request.signal.aborted)
          setResponse({ query, source, retry, failed: true });
      });
    return () => {
      valid = false;
      request.abort();
    };
  }, [query, source, retry]);
  useEffect(() => {
    if (open && activeId)
      document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeId]);
  const close = () => {
    setOpen(false);
    setActive(undefined);
  };
  const choose = (result: SearchResult) => {
    setQuery(result.name);
    close();
    onSelect(result.target);
  };
  return {
    value: query,
    onValueChange: (value) => {
      setQuery(value);
      setActive(undefined);
      setOpen(!!normalizeQuery(value));
    },
    resultsOpen: open && nonempty,
    onResultsOpenChange: (value) => {
      setOpen(value && nonempty);
      if (!value) setActive(undefined);
    },
    inputProps: {
      role: 'combobox',
      'aria-autocomplete': 'list',
      'aria-haspopup': 'listbox',
      'aria-expanded': open && nonempty,
      'aria-controls': open && groups.length ? listId : undefined,
      'aria-activedescendant': open ? activeId : undefined,
      onCompositionStart: () => {
        composing.current = true;
        ended.current = undefined;
      },
      onCompositionEnd: () => {
        composing.current = false;
        ended.current = performance.now();
      },
    },
    onKeyDown: (event, finishSelection) => {
      if (
        composing.current ||
        event.nativeEvent.isComposing ||
        event.nativeEvent.keyCode === 229
      ) {
        event.stopPropagation();
        return;
      }
      if (
        event.key === 'Enter' &&
        ended.current !== undefined &&
        performance.now() - ended.current < 80
      ) {
        ended.current = undefined;
        event.preventDefault();
        return;
      }
      ended.current = undefined;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setOpen(nonempty);
        if (results.length)
          setActive((index) =>
            index === undefined
              ? event.key === 'ArrowDown'
                ? 0
                : results.length - 1
              : (index +
                  (event.key === 'ArrowDown' ? 1 : -1) +
                  results.length) %
                results.length,
          );
      } else if (event.key === 'Enter' && open && results.length) {
        event.preventDefault();
        choose(selected ?? results[0]!);
        finishSelection();
      } else if (event.key === 'Escape') {
        if (open && nonempty) {
          event.preventDefault();
          event.stopPropagation();
          close();
        } else {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }
    },
    results: ({ finishSelection, focusInput }) => {
      if (!nonempty || !open) return null;
      if (!current)
        return (
          <p className="search-message" role="status">
            검색 중이에요.
          </p>
        );
      if (current.failed)
        return (
          <div className="search-message" role="status">
            검색을 불러오지 못했어요.{' '}
            <button
              onClick={() => {
                setRetry((value) => value + 1);
                setActive(undefined);
                focusInput();
              }}
            >
              다시 검색
            </button>
          </div>
        );
      if (!groups.length)
        return (
          <p
            className="search-message"
            role="status"
          >{`'${query}'에 맞는 권역 · 구 · 단지가 없습니다`}</p>
        );
      return (
        <SearchResults
          groups={groups}
          listId={listId}
          activeId={activeId}
          onSelect={(result) => {
            choose(result);
            finishSelection();
          }}
        />
      );
    },
  };
}
