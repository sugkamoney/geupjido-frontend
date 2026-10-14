import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFixtureSearchSource } from './source';
import { ExplorationPage } from '../map-exploration/exploration-page';
import { FixtureMapAdapter } from '../map-exploration/fixture-adapter';
import { fixtures } from '../map-exploration/fixtures';
import type { ExplorationSource } from '../map-exploration/types';
const detailSource: ExplorationSource = {
  loadZone: async (id) => ({
    zone: fixtures.zones.find((x) => x.id === id)!,
    apartments: fixtures.apartments.filter((x) => x.zoneId === id),
  }),
};
function setup() {
  const adapter = new FixtureMapAdapter(fixtures.overview);
  adapter.setViewport(
    { width: 1280, height: 720 },
    { x: 80, y: 68, width: 1100, height: 600 },
  );
  adapter.center({ x: 0, y: 0 }, 13);
  render(<ExplorationPage adapter={adapter} source={detailSource} />);
  return { adapter, user: userEvent.setup() };
}
describe('search interaction in exploration', () => {
  it('wraps arrows, exposes active option, chooses active or first, and restores the search origin', async () => {
    const { user } = setup();
    const field = screen.getByRole('combobox', { name: '지역 검색' });
    await user.type(field, '압');
    await screen.findByRole('listbox');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(7);
    await user.keyboard('{ArrowUp}');
    expect(field).toHaveAttribute('aria-activedescendant', options[6]!.id);
    await user.keyboard('{ArrowDown}');
    expect(field).toHaveAttribute('aria-activedescendant', options[0]!.id);
    await user.keyboard('{Enter}');
    expect(field).toHaveValue('압구정');
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '권역 상세 닫기' }));
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.type(field, '청담');
    await screen.findByRole('listbox');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: '청담' })).toBeVisible();
  });
  it('updates during composition but ignores IME Enter including 229 and post-composition confirmation', async () => {
    setup();
    const field = screen.getByRole('combobox');
    field.focus();
    fireEvent.compositionStart(field);
    fireEvent.change(field, { target: { value: '청담' } });
    await screen.findByRole('option', { name: /청담 강남구/ });
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    expect(
      screen.queryByRole('heading', { name: '청담' }),
    ).not.toBeInTheDocument();
    fireEvent.compositionEnd(field);
    fireEvent.keyDown(field, { key: 'Enter', keyCode: 229 });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(
      screen.queryByRole('heading', { name: '청담' }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(await screen.findByRole('heading', { name: '청담' })).toBeVisible();
  });
  it('closes results before leaving on Escape and preserves focus on clear with exact empty copy', async () => {
    const { user } = setup();
    const field = screen.getByRole('combobox');
    await user.type(field, '없는 이름');
    expect(
      await screen.findByText("'없는 이름'에 맞는 권역 · 구 · 단지가 없습니다"),
    ).toBeVisible();
    await user.keyboard('{Escape}');
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{Escape}');
    expect(field).not.toHaveFocus();
    await user.click(field);
    await user.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
  it('selects a touch result on pointerup once and ignores scrolling', async () => {
    const { adapter, user } = setup();
    const field = screen.getByRole('combobox');
    await user.type(field, '청담');
    const option = await screen.findByRole('option', { name: /청담 강남구/ });
    const pointer = (type: string, y: number) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        clientX: 10,
        clientY: y,
      });
      Object.defineProperties(event, {
        pointerType: { value: 'touch' },
        pointerId: { value: 1 },
      });
      fireEvent(option, event);
    };
    pointer('pointerdown', 10);
    pointer('pointermove', 30);
    pointer('pointerup', 30);
    expect(
      screen.queryByRole('heading', { name: '청담' }),
    ).not.toBeInTheDocument();
    pointer('pointerdown', 10);
    option.focus();
    pointer('pointerup', 10);
    expect(await screen.findByRole('heading', { name: '청담' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '권역 상세 닫기' }));
    expect(field).toHaveFocus();
    const revision = adapter.getSnapshot().revision;
    fireEvent.click(option, { detail: 1 });
    expect(adapter.getSnapshot().revision).toBe(revision);
  });
  it('fits a district and searches an apartment outside the current viewport then selects detail/list/pin at zoom >=15', async () => {
    const { adapter, user } = setup();
    const field = screen.getByRole('combobox');
    await user.type(field, '성동구');
    await screen.findByRole('listbox');
    await user.click(screen.getByRole('option', { name: /성동구 권역/ }));
    expect(adapter.getSnapshot().zoom).toBeGreaterThanOrEqual(12.55);
    expect(adapter.getSnapshot().zoom).toBeLessThanOrEqual(13.5);
    act(() => adapter.center({ x: 100000, y: 100000 }, 17));
    expect(
      screen.queryByRole('button', { name: '지도 단지 청담 검토 단지' }),
    ).not.toBeInTheDocument();
    await user.clear(field);
    await user.type(field, '청담 검토');
    await user.click(
      await screen.findByRole('option', { name: /청담 검토 단지/ }),
    );
    expect(adapter.getSnapshot().zoom).toBe(17);
    expect(
      await screen.findByRole('button', { name: '목록 단지 청담 검토 단지' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      await screen.findByRole('button', { name: '지도 단지 청담 검토 단지' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() =>
      expect(field).toHaveAttribute('aria-expanded', 'false'),
    );
  });
});

it('search source can select a zone and apartment absent from viewport data', async () => {
  const adapter = new FixtureMapAdapter();
  adapter.setViewport(
    { width: 1000, height: 800 },
    { x: 0, y: 0, width: 1000, height: 800 },
  );
  adapter.center({ x: 10000, y: 10000 }, 13);
  render(
    <ExplorationPage
      adapter={adapter}
      data={{ ...fixtures, zones: [], apartments: [] }}
      source={detailSource}
      searchSource={createFixtureSearchSource(fixtures)}
    />,
  );
  const user = userEvent.setup(),
    field = screen.getByRole('combobox');
  await user.type(field, '청담 검토');
  await user.click(
    await screen.findByRole('option', { name: /청담 검토 단지/ }),
  );
  expect(await screen.findByRole('heading', { name: '청담' })).toBeVisible();
  expect(
    await screen.findByRole('button', { name: '목록 단지 청담 검토 단지' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(
    await screen.findByRole('button', { name: '지도 단지 청담 검토 단지' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await waitFor(() => expect(adapter.getSnapshot().zoom).toBe(15));
});

it.each(['청담', '압구정', '압구정 검토 단지 1'])(
  'restores search focus when choosing %s with a detail already open',
  async (query) => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: '권역 압구정' }));
    const field = screen.getByRole('combobox');
    await user.type(field, query);
    await screen.findByRole('listbox');
    await user.keyboard('{Enter}');
    await screen.findByRole('heading', {
      name: query.includes('검토') ? '압구정' : query,
    });
    await user.click(screen.getByRole('button', { name: '권역 상세 닫기' }));
    expect(field).toHaveFocus();
  },
);
