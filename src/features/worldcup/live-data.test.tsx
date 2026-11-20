import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  renderHook,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DailyProgress, LiveTimeline } from './live-data';
import { useLiveTimeline } from './use-live-data';
import { createWorldcupApi } from './api/client';
import { progressRecord, timelineRecord } from './api/test-data';
const api = createWorldcupApi();
afterEach(() => vi.unstubAllGlobals());
it('hides sparse activity by the full list and retains an empty zone list when full activity is sufficient', async () => {
  let full = 4;
  vi.stubGlobal(
    'fetch',
    async (url: string) =>
      new Response(
        JSON.stringify({
          items: url.includes('?')
            ? []
            : Array.from({ length: full }, () => timelineRecord.items[0]),
        }),
      ),
  );
  const { result, rerender } = renderHook(
    ({ revision }) => useLiveTimeline(api, 'zone-a', revision),
    { initialProps: { revision: 0 } },
  );
  await waitFor(() => expect(result.current.all.data).toBeDefined());
  expect(result.current.visible).toBe(false);
  full = 5;
  rerender({ revision: 1 });
  await waitFor(() => expect(result.current.all.data).toBeDefined());
  expect(result.current.visible).toBe(true);
  expect(result.current.read.data?.items).toEqual([]);
});
it('discards a late response after switching timeline scopes', async () => {
  let release: (v: Response) => void = () => {};
  vi.stubGlobal('fetch', async (url: string) =>
    url.includes('zone-a')
      ? new Promise((r) => {
          release = r;
        })
      : new Response(
          JSON.stringify({
            items: url.includes('?')
              ? []
              : Array.from({ length: 5 }, () => timelineRecord.items[0]),
          }),
        ),
  );
  const { result, rerender } = renderHook(
    ({ scope }) => useLiveTimeline(api, scope, 0),
    { initialProps: { scope: 'zone-a' } },
  );
  await waitFor(() => expect(result.current.all.data).toBeDefined());
  rerender({ scope: 'zone-b' });
  await waitFor(() => expect(result.current.read.data).toBeDefined());
  await act(async () => release(new Response(JSON.stringify(timelineRecord))));
  expect(result.current.read.data?.items).toEqual([]);
});
it('shows server progress distinct from picks and refreshes after a success revision', async () => {
  let done = 0;
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          ...progressRecord,
          completedRounds: done,
          remainingRounds: 60 - done,
          roundsUntilNextMilestone: 30 - done,
        }),
      ),
  );
  const { rerender } = render(<DailyProgress api={api} revision={0} />);
  await screen.findByText('오늘 일반 월드컵 0 / 60판');
  done = 2;
  rerender(<DailyProgress api={api} revision={1} />);
  await screen.findByText('오늘 일반 월드컵 2 / 60판');
  expect(screen.getByText('30판까지 28판 남았어요.')).toBeVisible();
});
it('keeps a timeline failure retryable without injecting sample rows', async () => {
  let fail = true;
  vi.stubGlobal('fetch', async () =>
    fail
      ? new Response('{}', { status: 503 })
      : new Response(JSON.stringify({ items: [] })),
  );
  function View() {
    const model = useLiveTimeline(api, undefined, 0);
    return <LiveTimeline model={model} onZone={async () => {}} />;
  }
  render(<View />);
  await screen.findByRole('alert');
  expect(document.querySelectorAll('.worldcup-timeline-row')).toHaveLength(0);
  fail = false;
  fireEvent.click(
    screen.getByRole('button', { name: '타임라인 다시 불러오기' }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
  );
});
