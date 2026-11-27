import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { AppShellProps } from '../../components/app-shell/types';
import { ExplorationPage } from './exploration-page';
import { FixtureMapAdapter } from './fixture-adapter';
import { createMapApi } from './api/client';
import { createLiveSources } from './api/live-source';
import { detailRecord as baseDetail } from './api/test-data';
import { responseBody } from '../ranking/api/test-data';
import { fixtureWorldcupSource, type WorldcupSource } from '../worldcup/source';
import { createLiveWorldcupSource } from '../worldcup/live-source';
import { createWorldcupApi } from '../worldcup/api/client';
import type { RankingFilters } from '../ranking/api/contracts';

const selected = vi.fn();
vi.mock('../../components/app-shell/app-shell', async () => {
  const { useLayoutEffect, useState } = await import('react');
  return {
    AppShell({
      detail,
      map,
      search,
      timeline,
      ranking,
    }: AppShellProps & {
      ranking?: (context: {
        signal: AbortSignal;
        onZoneSelected: () => void;
      }) => ReactNode;
    }) {
      const [session, setSession] = useState<AbortController>();
      useLayoutEffect(() => () => session?.abort(), [session]);
      const close = () => {
        session?.abort();
        setSession(undefined);
      };
      return (
        <>
          <button onClick={() => setSession(new AbortController())}>
            열기
          </button>
          <button onClick={close}>닫기</button>
          <button
            onClick={() => {
              session?.abort();
              setSession(new AbortController());
            }}
          >
            화면 전환
          </button>
          <input
            aria-label="검색"
            value={search.value}
            onChange={(event) => search.onValueChange(event.target.value)}
          />
          {session &&
            ranking?.({ signal: session.signal, onZoneSelected: selected })}
          {timeline}
          {detail && (
            <section>
              <h2>{detail.title}</h2>
              {detail.content}
            </section>
          )}
          {map({
            frame: { x: 0, y: 0, width: 1000, height: 800 },
            level: 'zone',
          })}
        </>
      );
    },
  };
});

afterEach(() => {
  selected.mockClear();
  vi.unstubAllGlobals();
});

const target = { lat: 37.3, lng: 127.4 };
const detailRecord = {
  ...baseDetail,
  zone: {
    ...baseDetail.zone,
    center: { latitude: target.lat, longitude: target.lng },
  },
};
const zoneB = { ...detailRecord.zone, id: 'zone-b', name: '두 번째 상세' };
const detailB = { ...detailRecord, zone: zoneB };
const rankingRow = {
  zoneId: detailRecord.zone.id,
  name: '지도 밖 랭킹 권역',
  cityName: '예시구',
  regionName: '서울특별시',
  rankingBasis: 'VOTE',
  rank: 1,
  rankTotal: 27,
  tier: 1.2,
  previousTier: null,
  tierDelta: null,
  movement: 'NONE',
  validVoteCount: 51,
  participantCount: 11,
  crossZoneVoteCount: 21,
};
const detailUrl = '/api/v1/map/zones/zone-a';

function start(
  detail: (url: string, signal: AbortSignal) => Promise<Response>,
  worldcupSource: WorldcupSource = fixtureWorldcupSource,
) {
  const fetchMock = vi.fn(async (url: string, { signal }: RequestInit) => {
    if (url.startsWith('/api/v1/rankings/zones?')) {
      const filters = Object.fromEntries(
        new URLSearchParams(url.split('?')[1]),
      ) as RankingFilters;
      return Response.json({
        ...responseBody(filters),
        zones: [
          rankingRow,
          { ...rankingRow, zoneId: zoneB.id, name: '두 번째 랭킹', rank: 2 },
        ],
      });
    }
    return detail(url, signal!);
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  const adapter = new FixtureMapAdapter();
  const center = vi.spyOn(adapter, 'center');
  const client = new QueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ExplorationPage
        live
        worldcupSource={worldcupSource}
        adapter={adapter}
        source={createLiveSources(createMapApi()).source}
      />
    </QueryClientProvider>,
  );
  const open = () =>
    fireEvent.click(screen.getByRole('button', { name: '열기' }));
  open();
  return { center, fetchMock, open, unmount: view.unmount };
}

const row = () => screen.findByRole('button', { name: /지도 밖 랭킹 권역/ });

it('loads a ranked zone outside viewport data and uses the same detail for camera and list', async () => {
  const { center, fetchMock } = start(async () => Response.json(detailRecord));
  fireEvent.click(await row());
  expect(
    await screen.findByRole('heading', { name: detailRecord.zone.name }),
  ).toBeVisible();
  expect(screen.getByText(detailRecord.complexes[0]!.name)).toBeVisible();
  const map = screen.getByRole('region', { name: '지도' });
  expect(Number(map.getAttribute('data-center-lat'))).toBeCloseTo(target.lat);
  expect(Number(map.getAttribute('data-center-lng'))).toBeCloseTo(target.lng);
  expect(center).toHaveBeenCalledWith(target, expect.any(Number), true);
  expect(
    screen.getByRole('button', { name: /지도 밖 랭킹 권역/ }),
  ).toHaveAttribute('aria-current', 'true');
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    '/api/v1/rankings/zones?region=ALL&tab=GRADE_1&sort=CURRENT',
    detailUrl,
  ]);
  expect(selected).toHaveBeenCalledTimes(1);
});

it('keeps filters on reopening and retries a mismatched detail response', async () => {
  const detail = vi
    .fn()
    .mockResolvedValueOnce(Response.json(detailB))
    .mockResolvedValueOnce(Response.json(detailRecord));
  const { open, center, fetchMock } = start(detail);
  await row();
  fireEvent.click(screen.getByRole('button', { name: /^2급지/ }));
  fireEvent.change(screen.getByLabelText('지역'), {
    target: { value: 'SEOUL' },
  });
  fireEvent.click(screen.getByRole('button', { name: '많이 오른 곳' }));
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  open();
  expect(screen.getByLabelText('지역')).toHaveValue('SEOUL');
  expect(screen.getByRole('button', { name: /^2급지/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('button', { name: '많이 오른 곳' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.click(await row());
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/rankings/zones?region=SEOUL&tab=GRADE_2&sort=RISEN',
    expect.anything(),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '권역 정보를 불러오지 못했어요.',
  );
  expect(center).not.toHaveBeenCalled();
  expect(selected).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '권역 다시 시도' }));
  expect(
    await screen.findByRole('heading', { name: detailRecord.zone.name }),
  ).toBeVisible();
  expect(detail).toHaveBeenCalledTimes(2);
  expect(selected).toHaveBeenCalledTimes(1);
});

it.each([
  '닫기',
  '화면 전환',
  '지도 제스처',
  '검색',
  '필터 변경',
  '새 권역',
  'unmount',
])('discards a delayed ranking detail after %s', async (intent) => {
  let signal: AbortSignal | undefined;
  let finish!: (response: Response) => void;
  const { center, unmount } = start(async (url, requestSignal) => {
    if (url !== detailUrl) return Response.json(detailB);
    signal = requestSignal;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  fireEvent.click(await row());
  await waitFor(() => expect(signal).toBeDefined());
  if (intent === '지도 제스처')
    fireEvent.wheel(screen.getByRole('region', { name: '지도' }), {
      deltaY: -1,
    });
  else if (intent === '검색')
    fireEvent.change(screen.getByLabelText('검색'), {
      target: { value: '새 검색' },
    });
  else if (intent === '필터 변경')
    fireEvent.click(screen.getByRole('button', { name: /^2급지/ }));
  else if (intent === '새 권역')
    fireEvent.click(screen.getByRole('button', { name: /두 번째 랭킹/ }));
  else if (intent === 'unmount') unmount();
  else fireEvent.click(screen.getByRole('button', { name: intent }));
  expect(signal?.aborted).toBe(true);
  await act(async () => finish(Response.json(detailRecord)));
  expect(
    screen.queryByRole('heading', { name: detailRecord.zone.name }),
  ).toBeNull();
  if (intent === '새 권역') {
    expect(
      await screen.findByRole('heading', { name: zoneB.name }),
    ).toBeVisible();
    expect(selected).toHaveBeenCalledTimes(1);
  } else {
    expect(selected).not.toHaveBeenCalled();
    expect(center).not.toHaveBeenCalledWith(target, expect.any(Number), true);
  }
});

it('a ranking selection supersedes an in-flight timeline selection', async () => {
  let timelineSignal: AbortSignal | undefined;
  let finishTimeline!: (response: Response) => void;
  const timelineSource = createLiveWorldcupSource({
    ...createWorldcupApi(),
    timeline: async () => ({
      items: Array.from({ length: 5 }, (_, index) => ({
        displayName: '나',
        mine: true,
        selectedAt: '2026-11-20T01:00:00Z',
        left: {
          complexId: 'left',
          name: `왼쪽단지 ${index}`,
          zoneId: zoneB.id,
          zoneName: zoneB.name,
        },
        right: {
          complexId: 'right',
          name: '오른쪽단지',
          zoneId: detailRecord.zone.id,
          zoneName: detailRecord.zone.name,
        },
        selectedComplexId: 'left',
      })),
    }),
  });
  const { center } = start(async (url, signal) => {
    if (url === detailUrl) return Response.json(detailRecord);
    timelineSignal = signal;
    return new Promise((resolve) => {
      finishTimeline = resolve;
    });
  }, timelineSource);

  fireEvent.click(
    await screen.findByRole('button', {
      name: '두 번째 상세 왼쪽단지 0 권역 상세',
    }),
  );
  await waitFor(() => expect(timelineSignal).toBeDefined());
  fireEvent.click(await row());
  expect(
    await screen.findByRole('heading', { name: detailRecord.zone.name }),
  ).toBeVisible();
  expect(timelineSignal?.aborted).toBe(true);
  await act(async () => finishTimeline(Response.json(detailB)));
  expect(screen.queryByRole('heading', { name: zoneB.name })).toBeNull();
  expect(center).toHaveBeenCalledTimes(1);
  expect(selected).toHaveBeenCalledTimes(1);
});

it('commits only the latest click when the same row is selected twice', async () => {
  let firstSignal: AbortSignal | undefined;
  let finishFirst!: (response: Response) => void;
  const { center } = start(async (_, signal) => {
    if (firstSignal) return Response.json(detailRecord);
    firstSignal = signal;
    return new Promise((resolve) => {
      finishFirst = resolve;
    });
  });
  const button = await row();
  fireEvent.click(button);
  await waitFor(() => expect(firstSignal).toBeDefined());
  fireEvent.click(button);
  expect(
    await screen.findByRole('heading', { name: detailRecord.zone.name }),
  ).toBeVisible();
  expect(firstSignal?.aborted).toBe(true);
  await act(async () => finishFirst(Response.json(detailRecord)));
  expect(center).toHaveBeenCalledTimes(1);
  expect(selected).toHaveBeenCalledTimes(1);
});
