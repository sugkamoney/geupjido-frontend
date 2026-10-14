import { StrictMode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExplorationPage } from './exploration-page';
import { FixtureMapAdapter } from './fixture-adapter';
import { fixtures } from './fixtures';
import type { ExplorationSource, ZoneDetail } from './types';

const immediate: ExplorationSource = {
  loadZone: async (id) => ({
    zone: fixtures.zones.find((z) => z.id === id)!,
    apartments: fixtures.apartments.filter((a) => a.zoneId === id),
  }),
};
function adapter(zoom = 12.9) {
  const map = new FixtureMapAdapter();
  map.setViewport(
    { width: 1000, height: 800 },
    { x: 0, y: 0, width: 1000, height: 800 },
  );
  map.center({ x: 0, y: 0 }, zoom);
  map.releaseAnchor();
  return map;
}
describe('exploration selection and lifecycle', () => {
  it('pin selection leaves camera still, list selection centers and closing clears all selections', async () => {
    const user = userEvent.setup(),
      map = adapter(14.5);
    render(<ExplorationPage adapter={map} source={immediate} />);
    const before = map.getSnapshot();
    await user.click(
      screen.getByRole('button', { name: '지도 단지 압구정 검토 단지 1' }),
    );
    expect(map.getSnapshot().center).toEqual(before.center);
    expect(map.getSnapshot().zoom).toBe(before.zoom);
    const row = await screen.findByRole('button', {
      name: '목록 단지 압구정 검토 단지 1',
    });
    expect(row).toHaveAttribute('aria-pressed', 'true');
    await user.click(
      screen.getByRole('button', { name: '목록 단지 압구정 검토 단지 2' }),
    );
    await waitFor(() => expect(map.getSnapshot().zoom).toBe(15));
    await user.click(screen.getByRole('button', { name: '권역 상세 닫기' }));
    expect(
      screen.queryByRole('heading', { name: '압구정' }),
    ).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-selected="true"]')).toHaveLength(0);
  });
  it('keeps selected pin below 14.5, and district switch clears detail and pin', async () => {
    const user = userEvent.setup(),
      map = adapter(14.5);
    render(<ExplorationPage adapter={map} source={immediate} />);
    await user.click(
      screen.getByRole('button', { name: '지도 단지 압구정 검토 단지 1' }),
    );
    await screen.findByRole('button', { name: '목록 단지 압구정 검토 단지 1' });
    act(() => map.zoom(-2.1));
    expect(screen.getAllByRole('button', { name: /^지도 단지/ })).toHaveLength(
      1,
    );
    expect(
      document.querySelector('[data-selected-polygon]'),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '구' }));
    expect(
      screen.queryByRole('heading', { name: '압구정' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^지도 단지/ }),
    ).not.toBeInTheDocument();
  });
  it('cancels prior detail and ignores stale responses even when source ignores abort', async () => {
    const requests: {
      id: string;
      signal: AbortSignal;
      resolve: (value: ZoneDetail) => void;
    }[] = [];
    const source: ExplorationSource = {
      loadZone: (id, signal) =>
        new Promise((resolve) => requests.push({ id, signal, resolve })),
    };
    const user = userEvent.setup(),
      map = adapter();
    render(<ExplorationPage adapter={map} source={source} />);
    await user.click(screen.getByRole('button', { name: '권역 압구정' }));
    await user.click(screen.getByRole('button', { name: '권역 청담' }));
    expect(requests[0]!.signal.aborted).toBe(true);
    await act(async () =>
      requests[0]!.resolve({
        zone: fixtures.zones[0]!,
        apartments: fixtures.apartments,
      }),
    );
    expect(
      screen.queryByRole('button', { name: /^목록 단지/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '권역 상세 닫기' }));
    expect(requests[1]!.signal.aborted).toBe(true);
    await act(async () =>
      requests[1]!.resolve({ zone: fixtures.zones[1]!, apartments: [] }),
    );
    expect(
      screen.queryByRole('heading', { name: '청담' }),
    ).not.toBeInTheDocument();
  });
  it('supports error retry, deduplicates list identities, and destroys resources on unmount', async () => {
    const map = adapter(),
      destroy = vi.spyOn(map, 'destroy');
    const source: ExplorationSource = {
      loadZone: vi
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue({
          zone: fixtures.zones[0],
          apartments: [fixtures.apartments[0], fixtures.apartments[0]],
        }),
    };
    const user = userEvent.setup(),
      view = render(<ExplorationPage adapter={map} source={source} />);
    await user.click(screen.getByRole('button', { name: '권역 압구정' }));
    await user.click(
      await screen.findByRole('button', { name: '다시 불러오기' }),
    );
    expect(
      await screen.findAllByRole('button', {
        name: '목록 단지 압구정 검토 단지 1',
      }),
    ).toHaveLength(1);
    view.unmount();
    await waitFor(() => expect(destroy).toHaveBeenCalledOnce());
  });
  it('activates touch selection once on pointerup without requiring a compatibility click', async () => {
    const map = adapter(),
      source = { loadZone: vi.fn(immediate.loadZone) };
    render(<ExplorationPage adapter={map} source={source} />);
    const label = screen.getByRole('button', { name: '권역 압구정' });
    const pointer = (type: string) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        clientX: 50,
        clientY: 50,
      });
      Object.defineProperties(event, {
        pointerType: { value: 'touch' },
        pointerId: { value: 1 },
      });
      fireEvent(label, event);
    };
    pointer('pointerdown');
    pointer('pointerup');
    await screen.findByRole('heading', { name: '압구정' });
    fireEvent.click(label, { detail: 1 });
    expect(source.loadZone).toHaveBeenCalledOnce();
  });
});

it('renders a selected detail-only apartment and keeps it at lower zoom', async () => {
  const map = adapter();
  const external = {
    ...fixtures.apartments[0]!,
    id: 'detail-only',
    name: '상세 전용 검토 단지',
  };
  const source: ExplorationSource = {
    loadZone: async () => ({
      zone: fixtures.zones[0]!,
      apartments: [external],
    }),
  };
  const user = userEvent.setup();
  render(<ExplorationPage adapter={map} source={source} />);
  await user.click(screen.getByRole('button', { name: '권역 압구정' }));
  await user.click(
    await screen.findByRole('button', {
      name: '목록 단지 상세 전용 검토 단지',
    }),
  );
  act(() => map.zoom(-1));
  expect(
    screen.getByRole('button', { name: '지도 단지 상세 전용 검토 단지' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

it('does not reuse a closed selection response while a new request is pending', async () => {
  let resolve: ((value: ZoneDetail) => void) | undefined;
  const source: ExplorationSource = {
    loadZone: vi
      .fn()
      .mockResolvedValueOnce({
        zone: fixtures.zones[0]!,
        apartments: [fixtures.apartments[0]!],
      })
      .mockImplementation(
        () =>
          new Promise<ZoneDetail>((r) => {
            resolve = r;
          }),
      ),
  };
  const user = userEvent.setup(),
    map = adapter();
  render(<ExplorationPage adapter={map} source={source} />);
  await user.click(screen.getByRole('button', { name: '권역 압구정' }));
  await screen.findByRole('button', { name: '목록 단지 압구정 검토 단지 1' });
  await user.click(screen.getByRole('button', { name: '권역 상세 닫기' }));
  await user.click(screen.getByRole('button', { name: '권역 압구정' }));
  expect(
    screen.queryByRole('button', { name: /^목록 단지/ }),
  ).not.toBeInTheDocument();
  await act(async () =>
    resolve?.({ zone: fixtures.zones[0]!, apartments: [] }),
  );
});

it('aborts pending detail on unmount and survives strict effect replay', async () => {
  const requests: AbortSignal[] = [];
  const source: ExplorationSource = {
    loadZone: async (_id, signal) => {
      requests.push(signal);
      return new Promise<ZoneDetail>(() => {});
    },
  };
  const map = adapter(),
    user = userEvent.setup();
  const view = render(
    <StrictMode>
      <ExplorationPage adapter={map} source={source} />
    </StrictMode>,
  );
  await user.click(screen.getByRole('button', { name: '권역 압구정' }));
  expect(screen.getByRole('heading', { name: '압구정' })).toBeVisible();
  expect(requests.at(-1)?.aborted).toBe(false);
  view.unmount();
  expect(requests.at(-1)?.aborted).toBe(true);
  await act(async () => {});
  const last = map.getSnapshot();
  map.zoom(1);
  expect(map.getSnapshot()).toBe(last);
});

it('restores focus to the map menu when the selected low-zoom label is removed on close', async () => {
  const map = adapter(),
    user = userEvent.setup();
  render(<ExplorationPage adapter={map} source={immediate} />);
  const label = screen.getByRole('button', { name: '권역 압구정' });
  label.focus();
  await user.keyboard('{Enter}');
  act(() => map.zoom(-1));
  await user.click(screen.getByRole('button', { name: '권역 상세 닫기' }));
  expect(screen.getByRole('button', { name: '지도' })).toHaveFocus();
});

it('restores focus to the map menu when a selected pin is removed below 14.5 on close', async () => {
  const map = adapter(14.5),
    user = userEvent.setup();
  render(<ExplorationPage adapter={map} source={immediate} />);
  await user.click(
    screen.getByRole('button', { name: '지도 단지 압구정 검토 단지 1' }),
  );
  act(() => map.zoom(-1));
  await user.click(screen.getByRole('button', { name: '권역 상세 닫기' }));
  expect(screen.getByRole('button', { name: '지도' })).toHaveFocus();
});
