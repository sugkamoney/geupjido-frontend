import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RankingPanel, type RankingPanelProps } from './ranking-panel';

const query = { region: 'ALL', tab: 'GRADE_1', sort: 'RISEN' } as const;
const zone = {
  zoneId: 'zone-a',
  name: '공식 권역 이름',
  cityName: '강남구',
  regionName: '서울',
  rank: 12,
  tier: 1.2,
  previousTier: 1.5,
  tierDelta: 0.3,
  movement: 'UP',
  validVoteCount: 49,
  participantCount: 9,
  crossZoneVoteCount: 19,
} as const;
const result = {
  ...query,
  gradeCounts: [{ grade: 1, count: 2 }],
  collectingCount: 1,
  lastCompletedAt: '2026-11-27T03:00:00Z',
  previousCompletedAt: null,
  zones: [zone, { ...zone, zoneId: 'zone-b', name: '두 번째 권역', rank: 1 }],
} as const;
function props() {
  return {
    query,
    result,
    status: 'ready',
    onQueryChange: vi.fn(),
    onSelectZone: vi.fn(),
    onRetry: vi.fn(),
  } satisfies RankingPanelProps;
}

describe('RankingPanel', () => {
  it('preserves response order, displayed rank and name, and selects by ID via keyboard', async () => {
    const input = props();
    const user = userEvent.setup();
    render(<RankingPanel {...input} />);
    const rows = within(screen.getByRole('list')).getAllByRole('button');
    expect(rows[0]).toHaveTextContent(
      /^12.*공식 권역 이름.*강남구.*▲ 0\.3.*1\.2$/,
    );
    expect(rows[1]).toHaveTextContent('두 번째 권역');
    rows[0]?.focus();
    await user.keyboard('{Enter}');
    expect(input.onSelectZone).toHaveBeenCalledWith('zone-a');
    expect(screen.getByText(/11월 27일 12:00/)).toBeVisible();
  });

  it('emits the complete controlled query and resets collecting sort', async () => {
    const input = props();
    const user = userEvent.setup();
    render(<RankingPanel {...input} />);
    await user.selectOptions(screen.getByLabelText('지역'), 'SEOUL');
    expect(input.onQueryChange).toHaveBeenLastCalledWith({
      ...query,
      region: 'SEOUL',
    });
    await user.click(screen.getByRole('button', { name: '많이 내린 곳' }));
    expect(input.onQueryChange).toHaveBeenLastCalledWith({
      ...query,
      sort: 'FALLEN',
    });
    expect(screen.getByRole('button', { name: /^2급지/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^모으는 중/ }));
    expect(input.onQueryChange).toHaveBeenLastCalledWith({
      ...query,
      tab: 'COLLECTING',
      sort: 'CURRENT',
    });
    expect(screen.getByRole('button', { name: /^1급지/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows all collecting thresholds and handles missing ranks, grades and publications', () => {
    const input = props();
    render(
      <RankingPanel
        {...input}
        query={{ ...query, tab: 'COLLECTING', sort: 'CURRENT' }}
        result={{
          ...result,
          tab: 'COLLECTING',
          sort: 'CURRENT',
          lastCompletedAt: null,
          zones: [
            {
              ...zone,
              tier: null,
              rank: null,
              previousTier: null,
              tierDelta: null,
              movement: 'NONE',
            },
          ],
        }}
      />,
    );
    expect(screen.queryByRole('button', { name: '많이 오른 곳' })).toBeNull();
    expect(screen.queryByRole('button', { name: '많이 내린 곳' })).toBeNull();
    expect(screen.getByText('유효표 49/50표')).toBeVisible();
    expect(screen.getByText('참여자 9/10명')).toBeVisible();
    expect(screen.getByText('권역 간 유효표 19/20표')).toBeVisible();
    expect(screen.getByLabelText('순위 미정')).toBeVisible();
    expect(screen.getByLabelText('급지 미정')).toBeVisible();
    expect(screen.getByText(/아직 발표된 랭킹이 없어요/)).toBeVisible();
  });

  it.each([
    { ...query, tab: 'COLLECTING', sort: 'CURRENT' },
    { ...query, sort: 'FALLEN' },
  ] as const)(
    'withholds stale rows while $tab $sort awaits a matching result',
    (nextQuery) => {
      const input = props();
      const { rerender } = render(<RankingPanel {...input} />);
      expect(
        screen.getByRole('button', { name: /공식 권역 이름/ }),
      ).toBeVisible();

      rerender(<RankingPanel {...input} query={nextQuery} />);
      expect(
        screen.queryByRole('button', { name: /공식 권역 이름/ }),
      ).toBeNull();
      expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
      expect(
        within(screen.getByRole('button', { name: /^1급지/ })).getByText('2'),
      ).toBeVisible();

      rerender(
        <RankingPanel
          {...input}
          query={nextQuery}
          result={{
            ...result,
            ...nextQuery,
            zones: [{ ...zone, name: '새 조건의 권역' }],
          }}
        />,
      );
      expect(
        screen.getByRole('button', { name: /새 조건의 권역/ }),
      ).toBeVisible();
    },
  );

  it('shows loading, empty results and a retryable error', async () => {
    const input = props();
    const { rerender } = render(<RankingPanel {...input} status="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
    expect(screen.queryByText(zone.name)).toBeNull();
    rerender(<RankingPanel {...input} result={{ ...result, zones: [] }} />);
    expect(screen.getByRole('status')).toHaveTextContent('권역이 없어요');
    rerender(<RankingPanel {...input} status="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('불러오지 못했어요');
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(input.onRetry).toHaveBeenCalledOnce();
  });
});
