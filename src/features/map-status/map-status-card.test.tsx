import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { MapStatusCard } from './map-status-card';
import { mapStatusFixture as data } from './map-status-card.fixture';

afterEach(() => vi.useRealTimers());

it('shows the initial distribution in grade order, including zero', () => {
  render(
    <MapStatusCard
      basis="initial"
      data={data}
      phase="ready"
      onRetry={vi.fn()}
    />,
  );
  const trigger = screen.getByRole('button', { name: '초기 급지 지도 상태' });
  expect(trigger).toHaveTextContent('초기 급지 5 / 6곳');
  fireEvent.click(trigger);
  const panel = screen.getByRole('region', { name: '지금 지도 상태' });
  expect(panel.id).toBe(trigger.getAttribute('aria-controls'));
  expect(
    within(panel)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['1급지0곳', '2급지2곳', '3급지1곳', '4급지1곳', '5급지1곳']);
  expect(panel).toHaveTextContent('초기 급지 없음1곳');
  expect(panel).not.toHaveTextContent(/배치표|2026/);
});

it('supports Enter, Space, Escape with focus restoration and one outside action', async () => {
  const user = userEvent.setup();
  const outside = vi.fn();
  render(
    <>
      <MapStatusCard
        basis="initial"
        data={data}
        phase="ready"
        onRetry={vi.fn()}
      />
      <button onClick={outside}>지도 동작</button>
    </>,
  );
  const trigger = screen.getByRole('button', { name: '초기 급지 지도 상태' });
  await user.tab();
  expect(trigger).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await user.tab();
  expect(screen.getByRole('region')).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await user.keyboard(' ');
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await user.click(screen.getByRole('button', { name: '지도 동작' }));
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(outside).toHaveBeenCalledTimes(1);
});

it('keeps snapshots through refresh and gives a single sibling retry action', () => {
  const onRetry = vi.fn();
  const { rerender } = render(
    <MapStatusCard basis="initial" phase="loading" onRetry={onRetry} />,
  );
  const trigger = screen.getByRole('button', { name: '초기 급지 지도 상태' });
  expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
  expect(trigger).not.toHaveTextContent('0');
  rerender(<MapStatusCard basis="initial" phase="error" onRetry={onRetry} />);
  expect(screen.getByRole('status')).toHaveTextContent(
    '지도 상태를 불러오지 못했어요',
  );
  fireEvent.click(trigger);
  const retry = screen.getByRole('button', { name: '다시 불러오기' });
  expect(trigger).not.toContainElement(retry);
  fireEvent.click(retry);
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  rerender(
    <MapStatusCard
      basis="initial"
      data={data}
      phase="refreshing"
      onRetry={onRetry}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('갱신 중');
  expect(trigger).toHaveTextContent('5 / 6곳');
  expect(screen.queryByRole('button', { name: '다시 불러오기' })).toBeNull();
  rerender(
    <MapStatusCard
      basis="initial"
      data={data}
      phase="refresh-error"
      onRetry={onRetry}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    '마지막으로 불러온 정보 · 갱신 실패',
  );
  expect(screen.getByRole('region')).toHaveTextContent('초기 급지 없음1곳');
});

it('distinguishes a zero vote snapshot, first publication and absent schedule', () => {
  const first = {
    ...data,
    validVoteCount: 0,
    participantCount: 0,
    voteBasedZoneCount: 0,
    collectingZoneCount: 6,
    lastCompletedAt: null,
    nextScheduledAt: null,
  };
  const { rerender } = render(
    <MapStatusCard basis="vote" data={first} phase="ready" onRetry={vi.fn()} />,
  );
  const trigger = screen.getByRole('button', { name: '민심 급지 지도 상태' });
  expect(trigger).toHaveTextContent('0명 참여 · 0표');
  expect(trigger).toHaveTextContent('민심 급지 0 / 6곳');
  expect(trigger).toHaveTextContent('예정된 반영 없음');
  fireEvent.click(trigger);
  const panel = screen.getByRole('region');
  expect(panel).toHaveTextContent('아직 집계 전이에요');
  expect(panel).toHaveTextContent('예정된 반영 없음');
  expect(panel).not.toHaveTextContent('1급지');
  rerender(
    <MapStatusCard
      basis="vote"
      data={{ ...data, nextScheduledAt: null }}
      phase="ready"
      onRetry={vi.fn()}
    />,
  );
  expect(panel).toHaveTextContent('마지막 집계 11월 27일 오후 12:00');
  expect(panel).toHaveTextContent('예정된 반영 없음');
});

it('marks an elapsed reservation without inventing a completion or new reservation', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-27T05:20:00Z'));
  const onRetry = vi.fn();
  const { rerender } = render(
    <MapStatusCard basis="vote" data={data} phase="ready" onRetry={onRetry} />,
  );
  const trigger = screen.getByRole('button', { name: '민심 급지 지도 상태' });
  expect(trigger).toHaveTextContent('다음 반영 11월 27일 오후 3:00');
  fireEvent.click(trigger);
  const panel = screen.getByRole('region');
  expect(panel).toHaveTextContent('마지막 집계 11월 27일 오후 12:00');
  act(() => vi.advanceTimersByTime(41 * 60_000));
  expect(trigger).toHaveTextContent('예약 시각 경과');
  rerender(
    <MapStatusCard
      basis="vote"
      data={data}
      phase="refresh-error"
      onRetry={onRetry}
    />,
  );
  expect(panel).toHaveTextContent('11월 27일 오후 3:00');
  expect(panel).toHaveTextContent('예약 시각 경과');
  expect(panel).toHaveTextContent('마지막 집계 11월 27일 오후 12:00');
  expect(panel).not.toHaveTextContent('오후 6:00');
  expect(onRetry).not.toHaveBeenCalled();
});

it('keeps popover scrolling keys from reaching the map without canceling their default', () => {
  const onMapKeyDown = vi.fn();
  render(
    <div onKeyDown={onMapKeyDown}>
      <MapStatusCard
        basis="initial"
        data={data}
        phase="ready"
        onRetry={vi.fn()}
      />
    </div>,
  );
  fireEvent.click(screen.getByRole('button', { name: '초기 급지 지도 상태' }));
  const defaultAllowed = fireEvent.keyDown(screen.getByRole('region'), {
    key: 'ArrowDown',
  });
  expect(defaultAllowed).toBe(true);
  expect(onMapKeyDown).not.toHaveBeenCalled();
});

it('closes on Escape and returns focus after tabbing past the nonmodal popover', async () => {
  const user = userEvent.setup();
  render(
    <>
      <MapStatusCard
        basis="initial"
        data={data}
        phase="ready"
        onRetry={vi.fn()}
      />
      <button>다음 동작</button>
    </>,
  );
  const trigger = screen.getByRole('button', { name: '초기 급지 지도 상태' });
  await user.tab();
  await user.keyboard('{Enter}');
  await user.tab();
  await user.tab();
  expect(screen.getByRole('button', { name: '다음 동작' })).toHaveFocus();

  await user.keyboard('{Escape}');

  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(trigger).toHaveFocus();
});

it('leaves Escape available to an outside input during IME composition', () => {
  render(
    <>
      <MapStatusCard
        basis="initial"
        data={data}
        phase="ready"
        onRetry={vi.fn()}
      />
      <input aria-label="지도 검색" />
    </>,
  );
  const trigger = screen.getByRole('button', { name: '초기 급지 지도 상태' });
  fireEvent.click(trigger);
  const search = screen.getByRole('textbox', { name: '지도 검색' });
  search.focus();

  expect(fireEvent.keyDown(search, { key: 'Escape', isComposing: true })).toBe(
    true,
  );
  expect(fireEvent.keyDown(search, { key: 'Escape', keyCode: 229 })).toBe(true);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(search).toHaveFocus();
});
