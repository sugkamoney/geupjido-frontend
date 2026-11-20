import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useLiveWorldcup } from './use-live-worldcup';
import { createWorldcupApi } from './api/client';
import { gameRecord, zoneSelectionRecord } from './api/test-data';
const api = createWorldcupApi();
const success = () => vi.fn();
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function server(
  handler: (path: string, init: RequestInit) => unknown | Promise<unknown>,
) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push(`${init.method} ${url}`);
    const value = await handler(url, init);
    return value instanceof Response
      ? value
      : new Response(JSON.stringify(value));
  });
  return calls;
}
it('resumes the server next round and locks rapid choices until server feedback', async () => {
  let stored = gameRecord(3);
  let release: () => void = () => {};
  const calls = server(async (_path, init) => {
    if (init.method === 'PUT') {
      await new Promise<void>((r) => {
        release = r;
      });
      stored = gameRecord(4);
      stored.roundResult = {
        roundNumber: 4,
        available: true,
        leftPercent: 53,
        rightPercent: 47,
      };
    }
    return stored;
  });
  const onSuccess = success();
  const { result } = renderHook(() =>
    useLiveWorldcup(api, undefined, onSuccess, false),
  );
  await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  expect(result.current.state.match?.cursor).toBe(3);
  act(() => {
    result.current.choose(0);
    result.current.choose(1);
  });
  await waitFor(() =>
    expect(calls.filter((c) => c.startsWith('PUT')).length).toBe(1),
  );
  expect(onSuccess).not.toHaveBeenCalled();
  await act(async () => release());
  expect(result.current.state.ratio).toEqual({
    kind: 'visible',
    values: [53, 47],
  });
  expect(onSuccess).toHaveBeenCalledTimes(1);
});
it('resynchronizes a 409 without claiming a new successful choice', async () => {
  let stored = gameRecord();
  server((_path, init) => {
    if (init.method === 'PUT') {
      stored = gameRecord(1);
      return new Response('{"code":"VOTE_ALREADY_RECORDED"}', { status: 409 });
    }
    return stored;
  });
  const onSuccess = success();
  const { result } = renderHook(() =>
    useLiveWorldcup(api, undefined, onSuccess, true),
  );
  await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  act(() => result.current.choose(1));
  await waitFor(() => expect(result.current.state.match?.cursor).toBe(1));
  expect(result.current.state.phase).toBe('ready');
  expect(onSuccess).not.toHaveBeenCalled();
});
it('reconciles a lost response before retry and does not write the round twice', async () => {
  let stored = gameRecord();
  let writes = 0;
  server((_path, init) => {
    if (init.method === 'PUT') {
      writes++;
      stored = gameRecord(1);
      throw new TypeError('connection lost');
    }
    return stored;
  });
  const onSuccess = success();
  const { result } = renderHook(() =>
    useLiveWorldcup(api, undefined, onSuccess, true),
  );
  await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  act(() => result.current.choose(0));
  await waitFor(() => expect(result.current.state.phase).toBe('failed'));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.state.phase).toBe('feedback'));
  expect(writes).toBe(1);
  expect(onSuccess).toHaveBeenCalledTimes(1);
});
it('starts the next set after ten rounds and displays a daily limit without retrying a vote', async () => {
  server((_path, init) =>
    init.method === 'POST'
      ? new Response('{"code":"DAILY_GAME_LIMIT_REACHED"}', { status: 429 })
      : gameRecord(10),
  );
  const { result } = renderHook(() =>
    useLiveWorldcup(api, undefined, success(), true),
  );
  await waitFor(() => expect(result.current.state.phase).toBe('limit'));
});
it('does not submit yesterday cards across Korean midnight', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-20T14:59:59Z'));
  const calls = server(() => gameRecord());
  const { result } = renderHook(() =>
    useLiveWorldcup(api, undefined, success(), true),
  );
  await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  vi.setSystemTime(new Date('2026-11-20T15:00:01Z'));
  act(() => result.current.choose(0));
  await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  expect(calls.filter((c) => c.startsWith('PUT'))).toHaveLength(0);
  expect(result.current.feedback).toContain('날짜');
});
it('uses zone flow and offers only server alternatives when the zone cannot start', async () => {
  const calls = server((path) =>
    path.endsWith('/alternatives')
      ? [{ ...zoneSelectionRecord, zoneId: 'zone-b', zoneName: '대안권역' }]
      : path.endsWith('/zones')
        ? [{ ...zoneSelectionRecord, canStart: false, activeComplexCount: 4 }]
        : new Response('{"code":"GAME_NOT_FOUND"}', { status: 404 }),
  );
  const { result } = renderHook(() =>
    useLiveWorldcup(api, 'zone-a', success(), false),
  );
  await waitFor(() => expect(result.current.state.phase).toBe('empty'));
  expect(result.current.state.alternatives?.[0]?.zoneId).toBe('zone-b');
  expect(calls.some((c) => c.startsWith('POST'))).toBe(false);
});
it('ignores old scope responses and late writes after unmount', async () => {
  let release: (v: unknown) => void = () => {};
  server((path, init) =>
    init.method === 'PUT'
      ? new Promise((r) => {
          release = r;
        })
      : path.endsWith('/zones')
        ? [zoneSelectionRecord]
        : path.includes('/zones/')
          ? gameRecord(0, 'zone-a')
          : gameRecord(),
  );
  const onSuccess = success();
  const { result, rerender, unmount } = renderHook(
    ({ scope }) => useLiveWorldcup(api, scope, onSuccess, true),
    { initialProps: { scope: undefined as string | undefined } },
  );
  await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  act(() => result.current.choose(0));
  rerender({ scope: 'zone-a' });
  await act(async () => release(gameRecord(1)));
  await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  expect(onSuccess).not.toHaveBeenCalled();
  act(() => result.current.choose(0));
  unmount();
  await act(async () => release(gameRecord(1, 'zone-a')));
  expect(onSuccess).not.toHaveBeenCalled();
});

it('rechecks a general game when an in-flight load crosses Korean midnight', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-20T14:59:59Z'));
  let release: (value: unknown) => void = () => {};
  let reads = 0;
  server(() => {
    reads++;
    return reads === 1
      ? new Promise((r) => {
          release = r;
        })
      : gameRecord(2);
  });
  const { result } = renderHook(() =>
    useLiveWorldcup(api, undefined, success(), true),
  );
  await waitFor(() => expect(reads).toBe(1));
  vi.setSystemTime(new Date('2026-11-20T15:00:01Z'));
  await act(async () => release(gameRecord()));
  await waitFor(() => expect(result.current.state.match?.cursor).toBe(2));
});
it('does not repeat POST when the start response was lost after creating a game', async () => {
  let created = false;
  let starts = 0;
  server((_path, init) => {
    if (init.method === 'POST') {
      starts++;
      created = true;
      throw new TypeError('response lost');
    }
    return created
      ? gameRecord(2)
      : new Response('{"code":"GAME_NOT_FOUND"}', { status: 404 });
  });
  const { result } = renderHook(() =>
    useLiveWorldcup(api, undefined, success(), true),
  );
  await waitFor(() => expect(result.current.state.phase).toBe('failed'));
  act(() => {
    result.current.retry();
    result.current.retry();
  });
  await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  expect(result.current.state.match?.cursor).toBe(2);
  expect(starts).toBe(1);
});
it('does not claim a recovered vote if the server recorded a skip instead', async () => {
  let stored = gameRecord();
  let writes = 0;
  server((_path, init) => {
    if (init.method === 'PUT') {
      writes++;
      stored = {
        ...gameRecord(),
        skips: [{ roundNumber: 1, skippedAt: '2026-11-20T01:00:00Z' }],
        nextRoundNumber: 2,
      };
      throw new TypeError('lost');
    }
    return stored;
  });
  const onSuccess = success();
  const { result } = renderHook(() =>
    useLiveWorldcup(api, undefined, onSuccess, true),
  );
  await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  act(() => result.current.choose(0));
  await waitFor(() => expect(result.current.state.phase).toBe('failed'));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.state.match?.cursor).toBe(1));
  expect(onSuccess).not.toHaveBeenCalled();
  expect(writes).toBe(1);
});

it('restarts reconciliation if a retry GET crosses Korean midnight', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-20T14:59:58Z'));
  let release: (value: unknown) => void = () => {};
  let reads = 0,
    writes = 0;
  server((_path, init) => {
    if (init.method === 'PUT') {
      writes++;
      throw new TypeError('lost');
    }
    reads++;
    return reads === 2
      ? new Promise((r) => {
          release = r;
        })
      : gameRecord();
  });
  const onSuccess = success();
  const { result } = renderHook(() =>
    useLiveWorldcup(api, undefined, onSuccess, true),
  );
  await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  act(() => result.current.choose(0));
  await waitFor(() => expect(result.current.state.phase).toBe('failed'));
  act(() => result.current.retry());
  await waitFor(() => expect(reads).toBe(2));
  vi.setSystemTime(new Date('2026-11-20T15:00:01Z'));
  await act(async () => release(gameRecord()));
  await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  expect(writes).toBe(1);
  expect(onSuccess).not.toHaveBeenCalled();
});

it('keeps the same zone game across Korean midnight instead of using general day reset', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-20T14:59:59Z'));
  const calls = server((path, init) => {
    if (init.method === 'PUT') {
      const value = gameRecord(1, 'zone-a');
      value.roundResult = {
        roundNumber: 1,
        available: false,
        leftPercent: null,
        rightPercent: null,
      };
      return value;
    }
    if (path.endsWith('/zones')) return [zoneSelectionRecord];
    return gameRecord(0, 'zone-a');
  });
  const onSuccess = success();
  const { result } = renderHook(() =>
    useLiveWorldcup(api, 'zone-a', onSuccess, true),
  );
  await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  vi.setSystemTime(new Date('2026-11-20T15:00:01Z'));
  act(() => result.current.choose(0));
  await waitFor(() => expect(result.current.state.phase).toBe('feedback'));
  expect(calls.filter((c) => c.startsWith('PUT'))).toEqual([
    'PUT /api/v1/worldcup/zones/zone-a/games/current/rounds/1/vote',
  ]);
  expect(onSuccess).toHaveBeenCalledTimes(1);
});
