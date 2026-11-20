import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ExplorationPage } from './exploration-page';
import { FixtureMapAdapter } from './fixture-adapter';
import { fixtures, fixtureSource } from './fixtures';
import { createFixtureSearchSource } from '../search/source';
import { createLiveWorldcupSource } from '../worldcup/live-source';
import { createWorldcupApi } from '../worldcup/api/client';
import type { ZoneDetail } from './types';
afterEach(() => vi.unstubAllGlobals());

const a = fixtures.zones[0]!,
  b = fixtures.zones[1]!;
it.each([
  'same-zone-search',
  'apartment',
  'close',
  'pan',
  'zoom',
  'prior-animation',
] as const)(
  'keeps the latest navigation intent across %s even if its source ignores abort',
  async (intent) => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      addEventListener() {},
      removeEventListener() {},
    }));
    const map = new FixtureMapAdapter();
    map.setViewport(
      { width: 1000, height: 800 },
      { x: 0, y: 0, width: 1000, height: 800 },
    );
    map.center(b.point, 13);
    let release: (detail: ZoneDetail) => void = () => {};
    let signal: AbortSignal | undefined;
    const source = {
      loadZone: (id: string, requestSignal: AbortSignal) =>
        id === a.id
          ? new Promise<ZoneDetail>((resolve) => {
              release = resolve;
              signal = requestSignal;
            })
          : fixtureSource.loadZone(id, requestSignal),
    };
    const api = {
      ...createWorldcupApi(),
      timeline: async () => ({
        items: Array.from({ length: 5 }, () => ({
          displayName: '나',
          mine: true,
          selectedAt: '2026-11-20T01:00:00Z',
          left: {
            complexId: 'left',
            name: '왼쪽단지',
            zoneId: a.id,
            zoneName: a.name,
          },
          right: {
            complexId: 'right',
            name: '오른쪽단지',
            zoneId: b.id,
            zoneName: b.name,
          },
          selectedComplexId: 'left',
        })),
      }),
    };
    render(
      <ExplorationPage
        live
        adapter={map}
        source={source}
        data={fixtures}
        searchSource={createFixtureSearchSource(fixtures)}
        worldcupSource={createLiveWorldcupSource(api)}
      />,
    );
    const field = screen.getByRole('combobox', { name: '지역 검색' });
    const selectB = async () => {
      fireEvent.change(field, { target: { value: '' } });
      fireEvent.change(field, { target: { value: b.name } });
      fireEvent.click(
        await screen.findByRole('option', {
          name: `${b.name} ${b.district}`,
        }),
      );
      await screen.findByRole('heading', { name: b.name });
    };
    await selectB();
    if (intent === 'prior-animation')
      act(() => {
        vi.stubGlobal('matchMedia', () => ({
          matches: false,
          addEventListener() {},
          removeEventListener() {},
        }));
        map.center(
          { lat: b.point.lat + 0.01, lng: b.point.lng + 0.01 },
          13,
          true,
        );
      });
    fireEvent.click(screen.getByRole('button', { name: '월드컵' }));
    fireEvent.click(
      (
        await screen.findAllByRole('button', {
          name: `${a.name} 왼쪽단지 권역 상세`,
        })
      )[0]!,
    );
    await waitFor(() => expect(signal).toBeDefined());
    expect(signal!.aborted).toBe(false);
    if (intent === 'prior-animation') {
      await act(async () => {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      });
      expect(signal!.aborted).toBe(false);
      await act(async () =>
        release(
          await fixtureSource.loadZone(a.id, new AbortController().signal),
        ),
      );
      await screen.findByRole('heading', { name: a.name });
      return;
    }
    if (intent === 'same-zone-search') await selectB();
    else if (intent === 'apartment')
      fireEvent.click(
        (await screen.findAllByRole('button', { name: /^목록 단지 / }))[0]!,
      );
    else if (intent === 'close')
      fireEvent.click(screen.getByRole('button', { name: '권역 상세 닫기' }));
    else {
      const region = screen.getByRole('region', { name: '지도' });
      if (intent === 'pan') fireEvent.keyDown(region, { key: 'ArrowRight' });
      else
        fireEvent.wheel(region, { deltaY: -100, clientX: 100, clientY: 100 });
    }
    expect(signal!.aborted).toBe(true);
    const camera = map.getSnapshot();
    await act(async () =>
      release(await fixtureSource.loadZone(a.id, new AbortController().signal)),
    );
    expect(map.getSnapshot()).toEqual(camera);
    expect(
      screen.queryByRole('heading', { name: a.name }),
    ).not.toBeInTheDocument();
    if (intent !== 'close')
      expect(screen.getByRole('heading', { name: b.name })).toBeVisible();
  },
);
