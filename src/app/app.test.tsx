import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from './app';

describe('app routes', () => {
  it('opens the home route', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: '급지도' }),
    ).toBeVisible();
  });

  it('returns to home from an unknown URL', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/missing']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: '페이지를 찾을 수 없어요' }),
    ).toBeVisible();
    await user.click(screen.getByRole('link', { name: '홈으로 돌아가기' }));
    expect(
      screen.getByRole('heading', { level: 1, name: '급지도' }),
    ).toBeVisible();
  });
});
