import { expect, it } from 'vitest';
import { createFixtureWorldcupSource } from './source';
import { fixtures } from '../map-exploration/fixtures';
it('fixture supports mixed and scoped matches without asserting a server generation policy', async () => {
  const source = createFixtureWorldcupSource();
  const signal = new AbortController().signal;
  const mixed = await source.loadMatch(undefined, 0, signal);
  expect(mixed!.kind).toBe('zone');
  const apt = await source.loadMatch(undefined, 1, signal);
  expect(apt!.kind).toBe('apartment');
  for (const i of [0, 1, 9, 10, 20]) {
    const match = await source.loadMatch(fixtures.zones[0], i, signal);
    expect(
      match!.cards.every(
        (c) => c.zone.id === 'apgujeong' && c.apartment.zoneId === 'apgujeong',
      ),
    ).toBe(true);
    expect(match!.cards[0].apartment.id).not.toBe(match!.cards[1].apartment.id);
  }
  expect(await source.loadMatch(fixtures.zones[1], 0, signal)).toBeNull();
  expect(createFixtureWorldcupSource('sparse').timeline.visible).toBe(false);
});
it('aborts pending fixture work and exposes failure/retry and unavailable ratios explicitly', async () => {
  const source = createFixtureWorldcupSource('failure');
  const signal = new AbortController().signal;
  const match = (await source.loadMatch(undefined, 0, signal))!;
  await expect(source.submit(match, 0, signal)).rejects.toThrow('Fixture');
  expect((await source.submit(match, 0, signal)).ratio.kind).toBe('visible');
  const unavailable = createFixtureWorldcupSource('unavailable');
  expect((await unavailable.submit(match, 'skip', signal)).ratio.kind).toBe(
    'unavailable',
  );
  const controller = new AbortController();
  const task = createFixtureWorldcupSource('pending').submit(
    match,
    0,
    controller.signal,
  );
  controller.abort();
  await expect(task).rejects.toMatchObject({ name: 'AbortError' });
});
