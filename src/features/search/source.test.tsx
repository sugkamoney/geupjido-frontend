import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { AppShell } from '../../components/app-shell/app-shell';
import { fixtures } from '../map-exploration/fixtures';
import { matchCatalog, type SearchGroup } from './model';
import type { SearchSource } from './source';
import { useSearch } from './use-search';
function Harness({ source }: { source: SearchSource }) {
  const search = useSearch(source, () => {});
  return <AppShell search={search} map={() => null} />;
}
it('aborts stale queries and ignores out-of-order results even when the source ignores cancellation', async () => {
  const requests: {
    query: string;
    signal: AbortSignal;
    resolve: (groups: SearchGroup[]) => void;
  }[] = [];
  const source: SearchSource = {
    search: (query, signal) =>
      new Promise((resolve) => {
        requests.push({ query, signal, resolve });
      }),
  };
  const view = render(<Harness source={source} />),
    user = userEvent.setup(),
    field = screen.getByRole('combobox');
  await user.type(field, '압');
  await waitFor(() => expect(requests).toHaveLength(1));
  await user.clear(field);
  await user.type(field, '청');
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[0]!.signal.aborted).toBe(true);
  await act(async () => requests[1]!.resolve(matchCatalog(fixtures, '청')));
  expect(screen.getByRole('option', { name: '청담 강남구' })).toBeVisible();
  await act(async () => requests[0]!.resolve(matchCatalog(fixtures, '압')));
  expect(
    screen.queryByRole('option', { name: '압구정 강남구' }),
  ).not.toBeInTheDocument();
  view.unmount();
  expect(requests[1]!.signal.aborted).toBe(true);
});
it('does not show a no-results claim on failure and retries the same query', async () => {
  let failed = true;
  const source: SearchSource = {
    search: async (query) => {
      if (failed) throw new Error('offline');
      return matchCatalog(fixtures, query);
    },
  };
  render(<Harness source={source} />);
  const user = userEvent.setup();
  await user.type(screen.getByRole('combobox'), '청담');
  expect(await screen.findByText(/검색을 불러오지 못했어요/)).toBeVisible();
  expect(screen.queryByText(/에 맞는 권역/)).not.toBeInTheDocument();
  failed = false;
  screen.getByRole('button', { name: '다시 검색' }).focus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('combobox')).toHaveFocus();
  expect(
    await screen.findByRole('option', { name: '청담 강남구' }),
  ).toBeVisible();
});
