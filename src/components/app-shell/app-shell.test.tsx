import { useState } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

function Harness() {
  const [detail, setDetail] = useState(false);
  const [query, setQuery] = useState('');
  return (
    <AppShell
      map={() => (
        <button onClick={() => setDetail(true)}>검토 상세 열기</button>
      )}
      timeline={<button>검토 타임라인 항목</button>}
      detail={
        detail
          ? {
              id: 'fixture',
              title: '검토 권역',
              location: '검토 위치',
              summary: <p>데이터 연결 전</p>,
              content: <button>검토 단지 항목</button>,
            }
          : undefined
      }
      onDetailClose={() => setDetail(false)}
      search={{ value: query, onValueChange: setQuery }}
    />
  );
}

describe('app shell boundaries', () => {
  it('collapses and restores the last panel without focusing hidden content', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(
      screen.queryByRole('button', { name: '검토 타임라인 항목' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '월드컵' }));
    expect(
      screen.getByRole('button', { name: '검토 타임라인 항목' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: '패널 접기' }));
    expect(
      screen.queryByRole('button', { name: '검토 타임라인 항목' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '패널 펼치기' }));
    expect(
      screen.getByRole('button', { name: '검토 타임라인 항목' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: '패널 접기' })).toHaveFocus();
  });

  it('closes a selected detail when choosing gu and restores focus on explicit close', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: '검토 상세 열기' });
    await user.click(trigger);
    const detail = screen.getByRole('region', { name: '검토 권역' });
    expect(
      within(detail).getByRole('button', { name: '권역 상세 닫기' }),
    ).toHaveFocus();
    await user.click(screen.getByRole('button', { name: '구' }));
    expect(
      screen.queryByRole('region', { name: '검토 권역' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '구' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(trigger);
    expect(screen.getByRole('button', { name: '권역' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: '권역 상세 닫기' }));
    expect(trigger).toHaveFocus();
  });

  it('uses the keyboard trigger after an earlier pointer interaction', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '월드컵' }));
    const trigger = screen.getByRole('button', { name: '검토 상세 열기' });
    trigger.focus();
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: '권역 상세 닫기' }));
    expect(trigger).toHaveFocus();
  });

  it('keeps the search text across panel changes and clears with input focus', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(
      screen.getByRole('searchbox', { name: '지역 검색' }),
      '검토 검색어',
    );
    await user.click(screen.getByRole('button', { name: '월드컵' }));
    expect(screen.getByRole('searchbox')).toHaveValue('검토 검색어');
    await user.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('does not invent map actions or expose undecided menus on the home shell', async () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: '지도 확대' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: /랭킹/ }),
    ).not.toBeInTheDocument();
    const command = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <AppShell
        map={() => null}
        search={{ value: '', onValueChange: vi.fn() }}
        onMapCommand={command}
        review
      />,
    );
    await user.click(
      within(view.container).getByRole('button', { name: '지도 전체 보기' }),
    );
    expect(command).toHaveBeenCalledWith('fit');
    expect(
      within(view.container).getByRole('button', { name: /랭킹/ }),
    ).toBeDisabled();
  });
});

describe('ranking shell', () => {
  it('keeps ranking beside detail and aborts each session on navigation or unmount', async () => {
    const user = userEvent.setup();
    const signals: AbortSignal[] = [];
    const view = render(<RankingHarness signals={signals} />);
    const ranking = screen.getByRole('button', { name: '랭킹' });
    await user.click(ranking);
    await user.click(screen.getByRole('button', { name: '권역 선택' }));
    expect(screen.getByRole('region', { name: '랭킹' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: '권역 상세 닫기' }),
    ).toHaveFocus();
    const first = signals[0];
    expect(first?.aborted).toBe(false);
    await user.click(screen.getByRole('button', { name: '월드컵' }));
    expect(first?.aborted).toBe(true);
    expect(screen.getByText('검토 타임라인')).toBeVisible();
    await user.click(ranking);
    const second = signals.at(-1);
    expect(second).not.toBe(first);
    await user.click(screen.getByRole('button', { name: '지도' }));
    expect(second?.aborted).toBe(true);
    await user.click(ranking);
    const third = signals.at(-1);
    view.unmount();
    expect(third?.aborted).toBe(true);
  });

  it('blocks the background on mobile and restores focus after close or selection', async () => {
    const user = userEvent.setup();
    const signals: AbortSignal[] = [];
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    try {
      render(<RankingHarness signals={signals} />);
      const ranking = screen.getByRole('button', { name: '랭킹' });
      const map = screen.getByText('검토 지도');
      const search = screen.getByRole('searchbox');
      await user.click(ranking);
      const dialog = screen.getByRole('dialog', { name: '랭킹' });
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(map.closest('[inert]')).not.toBeNull();
      expect(search.closest('[inert]')).not.toBeNull();
      expect(ranking.closest('[inert]')).not.toBeNull();
      expect(
        within(dialog).getByRole('button', { name: '랭킹 닫기' }),
      ).toHaveFocus();
      await user.keyboard('{Shift>}{Tab}{/Shift}');
      expect(
        within(dialog).getByRole('button', { name: '권역 선택' }),
      ).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(signals[0]?.aborted).toBe(true);
      expect(ranking).toHaveFocus();
      await user.click(ranking);
      await user.click(screen.getByRole('button', { name: '권역 선택' }));
      expect(
        screen.queryByRole('dialog', { name: '랭킹' }),
      ).not.toBeInTheDocument();
      expect(signals.at(-1)?.aborted).toBe(true);
      expect(
        screen.getByRole('button', { name: '권역 상세 닫기' }),
      ).toHaveFocus();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('invalidates a pending selection on breakpoint change and ignores its late callback', async () => {
    const user = userEvent.setup();
    const sessions: { signal: AbortSignal; onZoneSelected: () => void }[] = [];
    let change: (() => void) | undefined;
    const media = {
      matches: false,
      addEventListener: (_type: string, callback: () => void) => {
        change = callback;
      },
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', () => media);
    try {
      render(
        <AppShell
          map={() => null}
          ranking={(session) => {
            sessions.push(session);
            return <button>선택 다시 시도</button>;
          }}
          search={{ value: '', onValueChange: vi.fn() }}
        />,
      );
      const ranking = screen.getByRole('button', { name: '랭킹' });
      await user.click(ranking);
      await user.click(screen.getByRole('button', { name: '선택 다시 시도' }));
      const previous = sessions.at(-1);
      expect(previous?.signal.aborted).toBe(false);
      act(() => {
        media.matches = true;
        change?.();
      });
      expect(previous?.signal.aborted).toBe(true);
      expect(screen.queryByRole('region', { name: '랭킹' })).toBeNull();
      expect(ranking).toHaveFocus();
      await user.click(ranking);
      act(() => previous?.onZoneSelected());
      expect(screen.getByRole('dialog', { name: '랭킹' })).toBeVisible();
      expect(sessions.at(-1)?.signal.aborted).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

function RankingHarness({ signals }: { signals: AbortSignal[] }) {
  const [selected, setSelected] = useState(false);
  return (
    <AppShell
      map={() => <button>검토 지도</button>}
      timeline={<p>검토 타임라인</p>}
      ranking={({ signal, onZoneSelected }) => {
        signals.push(signal);
        return (
          <button
            onClick={() => {
              setSelected(true);
              onZoneSelected();
            }}
          >
            권역 선택
          </button>
        );
      }}
      detail={
        selected
          ? {
              id: 'fixture',
              title: '검토 권역',
              location: '검토 위치',
              content: null,
            }
          : undefined
      }
      search={{ value: '', onValueChange: vi.fn() }}
    />
  );
}
