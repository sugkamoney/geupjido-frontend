import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useWorldcup } from './use-worldcup';
import { createFixtureWorldcupSource, type WorldcupSource } from './source';
const source = createFixtureWorldcupSource();
const match = (await source.loadMatch(
  undefined,
  0,
  new AbortController().signal,
))!;
const base: WorldcupSource = { ...source, loadMatch: vi.fn(async () => match) };
afterEach(() => vi.useRealTimers());
it('locks rapid submissions, commits only success, and retries failure without advancing', async () => {
  let resolve: ((x: { ratio: { kind: 'hidden' } }) => void) | undefined;
  const submit = vi
    .fn()
    .mockRejectedValueOnce(new Error('fail'))
    .mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
  const onSuccess = vi.fn();
  const custom = { ...base, submit };
  const { result } = renderHook(() =>
    useWorldcup(custom, undefined, onSuccess, false),
  );
  await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  act(() => {
    result.current.choose(0);
    result.current.choose(1);
  });
  await waitFor(() => expect(result.current.state.phase).toBe('failed'));
  expect(submit).toHaveBeenCalledTimes(1);
  expect(onSuccess).not.toHaveBeenCalled();
  act(() => {
    result.current.retry();
    result.current.choose('skip');
  });
  expect(result.current.state.phase).toBe('pending');
  expect(submit).toHaveBeenCalledTimes(2);
  await act(async () => resolve!({ ratio: { kind: 'hidden' } }));
  expect(result.current.state.phase).toBe('feedback');
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(result.current.state.choice).toBe(0);
});
it('ignores stale source results on scope change and unmount even when source ignores abort', async () => {
  let resolve: ((x: { ratio: { kind: 'hidden' } }) => void) | undefined;
  const submit = vi.fn(
    () =>
      new Promise<{ ratio: { kind: 'hidden' } }>((r) => {
        resolve = r;
      }),
  );
  const onSuccess = vi.fn();
  const custom = {
    ...base,
    submit,
    loadMatch: async (
      zone: import('../map-exploration/types').Zone | undefined,
    ) =>
      zone
        ? {
            ...match,
            kind: 'apartment' as const,
            cards: [
              match.cards[0],
              {
                ...match.cards[0],
                apartment: { ...match.cards[0].apartment, id: 'other' },
              },
            ] as const,
          }
        : match,
  };
  const { result, rerender, unmount } = renderHook(
    ({ zone }) => useWorldcup(custom, zone, onSuccess, false),
    {
      initialProps: {
        zone: undefined as (typeof match.cards)[0]['zone'] | undefined,
      },
    },
  );
  await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  act(() => result.current.choose(0));
  rerender({ zone: match!.cards[0].zone });
  await act(async () => resolve!({ ratio: { kind: 'hidden' } }));
  expect(onSuccess).not.toHaveBeenCalled();
  await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  act(() => result.current.choose(1));
  unmount();
  await act(async () => resolve!({ ratio: { kind: 'hidden' } }));
  expect(onSuccess).not.toHaveBeenCalled();
});
it('advances at 1100ms or 600ms and resets feedback separately at 2400ms', async () => {
  vi.useFakeTimers();
  const custom = {
    ...base,
    submit: vi.fn(async () => ({
      ratio: { kind: 'visible' as const, values: [53, 47] as const },
    })),
  };
  const { result, unmount } = renderHook(() =>
    useWorldcup(custom, undefined, vi.fn(), false),
  );
  await act(async () => {});
  await act(async () => result.current.choose('skip'));
  expect(result.current.feedback).toBe('넘긴 판은 담기지 않아요');
  await act(async () => vi.advanceTimersByTime(1099));
  expect(result.current.state.phase).toBe('feedback');
  await act(async () => vi.advanceTimersByTime(1));
  expect(result.current.state.phase).toBe('ready');
  expect(result.current.feedback).toBe('넘긴 판은 담기지 않아요');
  await act(async () => vi.advanceTimersByTime(1300));
  expect(result.current.feedback).toBe('');
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  const hidden = {
    ...base,
    submit: vi.fn(async () => ({ ratio: { kind: 'unavailable' as const } })),
  };
  const next = renderHook(() => useWorldcup(hidden, undefined, vi.fn(), false));
  await act(async () => {});
  await act(async () => next.result.current.choose(0));
  await act(async () => vi.advanceTimersByTime(599));
  expect(next.result.current.state.phase).toBe('feedback');
  await act(async () => vi.advanceTimersByTime(1));
  expect(next.result.current.state.phase).toBe('ready');
  next.unmount();
  const reduced = renderHook(() =>
    useWorldcup(custom, undefined, vi.fn(), true),
  );
  await act(async () => {});
  await act(async () => reduced.result.current.choose(0));
  await act(async () => vi.advanceTimersByTime(600));
  expect(reduced.result.current.state.phase).toBe('ready');
  reduced.unmount();
});
it('rejects a source match outside the requested zone instead of submitting it', async () => {
  const invalid = {
    ...base,
    loadMatch: vi.fn(async () => match),
    submit: vi.fn(),
  };
  const onSuccess = vi.fn();
  const { result } = renderHook(() =>
    useWorldcup(invalid, match.cards[0].zone, onSuccess, false),
  );
  await waitFor(() => expect(result.current.state.phase).toBe('failed'));
  act(() => result.current.choose(0));
  expect(invalid.submit).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
});
it('retries a failed next-match request instead of resubmitting the previous vote', async () => {
  vi.useFakeTimers();
  const loadMatch = vi
    .fn()
    .mockResolvedValueOnce(match)
    .mockRejectedValueOnce(new Error('next match failed'))
    .mockResolvedValue(match);
  const submit = vi.fn(async () => ({ ratio: { kind: 'hidden' as const } }));
  const custom = { ...base, loadMatch, submit };
  const success = vi.fn();
  const { result, unmount } = renderHook(() =>
    useWorldcup(custom, undefined, success, false),
  );
  await act(async () => {});
  await act(async () => result.current.choose(0));
  await act(async () => vi.advanceTimersByTime(600));
  expect(result.current.state.phase).toBe('failed');
  await act(async () => result.current.retry());
  expect(result.current.state.phase).toBe('ready');
  expect(submit).toHaveBeenCalledTimes(1);
  expect(success).toHaveBeenCalledTimes(1);
  unmount();
});
