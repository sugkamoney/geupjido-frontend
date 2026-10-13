import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
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
