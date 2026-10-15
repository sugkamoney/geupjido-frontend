import { expect, it, vi } from 'vitest';
it('claims once when storage is blocked and preserves the stored first-display marker', async () => {
  vi.resetModules();
  const { claimIntroduction } = await import('./intro');
  const storage = {
    getItem: vi.fn(() => {
      throw new Error('blocked');
    }),
    setItem: vi.fn(),
  };
  expect(claimIntroduction(storage)).toBe(true);
  expect(claimIntroduction(storage)).toBe(false);
  vi.resetModules();
  const next = await import('./intro');
  expect(next.claimIntroduction({ getItem: () => '1', setItem: vi.fn() })).toBe(
    false,
  );
  vi.resetModules();
  const fresh = await import('./intro');
  const setItem = vi.fn();
  expect(fresh.claimIntroduction({ getItem: () => null, setItem })).toBe(true);
  expect(setItem).toHaveBeenCalledWith('geupjido.worldcup.intro.v1', '1');
});
