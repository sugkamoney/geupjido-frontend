import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MapStatusSlot } from './map-status-slot';

afterEach(() => vi.unstubAllGlobals());

it('scrolls only when content exceeds the placement height, independent of prior overflow', () => {
  const resize = new Map<Element, () => void>();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}

      observe(element: Element) {
        resize.set(element, this.callback);
      }

      disconnect() {}
    },
  );
  vi.stubGlobal('fetch', async () => new Response(null, { status: 404 }));
  const client = new QueryClient();
  const { container } = render(
    <QueryClientProvider client={client}>
      <main className="app-shell">
        <div
          ref={(node) => {
            if (node)
              vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(
                new DOMRect(64, 0, 1856, 1080),
              );
          }}
        >
          <MapStatusSlot renderer={() => <button>상태</button>} />
        </div>
      </main>
    </QueryClientProvider>,
  );
  const slot = container.querySelector<HTMLElement>(
    '.exploration-status-card-slot',
  )!;
  const content = slot.firstElementChild!;
  const measure = vi.spyOn(content, 'getBoundingClientRect');
  resize.get(slot.parentElement!)!();
  expect(slot.style.maxHeight).toBe('458px');

  for (const [height, scrollable] of [
    [458, false],
    [459, true],
    [458, false],
    [462, true],
    [468, true],
    [462, true],
    [456, false],
    [458, false],
  ] as const) {
    measure.mockReturnValue(new DOMRect(0, 0, 440, height));
    resize.get(content)!();
    expect(
      slot.hasAttribute('data-scrollable'),
      `content height ${height}`,
    ).toBe(scrollable);
  }
});
