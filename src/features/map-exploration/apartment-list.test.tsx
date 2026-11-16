import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApartmentList } from './apartment-list';
import { fixtures } from './fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('selected apartment row scrolling', () => {
  it('centers on selection, late row arrival and panel resize while preserving manual scroll on data refresh', () => {
    const scrollTo = vi.fn();
    const resizeCallbacks: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallbacks.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    const rows = fixtures.apartments.slice(0, 2);
    const page = (apartments = rows, selected = rows[0]!.id) => (
      <div
        className="shell-panel-list"
        ref={(node) => {
          if (!node) return;
          Object.defineProperty(node, 'clientHeight', {
            configurable: true,
            value: 400,
          });
          node.scrollTo = scrollTo;
        }}
      >
        <ApartmentList
          apartments={apartments}
          selected={selected}
          onSelect={() => {}}
        />
      </div>
    );
    const view = render(page([]));
    expect(scrollTo).not.toHaveBeenCalled();
    view.rerender(page());
    expect(scrollTo).toHaveBeenCalledTimes(1);
    const list = view.container.firstElementChild as HTMLElement;
    list.scrollTop = 100;
    view.rerender(page(rows.map((row) => ({ ...row }))));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(list.scrollTop).toBe(100);
    view.rerender(page(rows, rows[1]!.id));
    expect(scrollTo).toHaveBeenCalledTimes(2);
    act(() => resizeCallbacks.at(-1)!([], {} as ResizeObserver));
    expect(scrollTo).toHaveBeenCalledTimes(3);
  });
});
