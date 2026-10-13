import { createRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DetailPanel } from './shell-panels';

function SheetHarness() {
  const [expanded, setExpanded] = useState(false);
  return (
    <DetailPanel
      detail={{
        id: 'gesture-fixture',
        title: '검토 상세',
        location: '검토 위치',
        content: <p>목록</p>,
      }}
      compact
      expanded={expanded}
      onExpandedChange={setExpanded}
      onClose={() => {}}
      closeRef={createRef()}
      panelRef={createRef()}
    />
  );
}

function pointer(
  handle: HTMLElement,
  type: string,
  pointerType: string,
  clientY: number,
) {
  const event = new MouseEvent(type, { bubbles: true, clientY });
  Object.defineProperties(event, {
    pointerType: { value: pointerType },
    pointerId: { value: 7 },
  });
  fireEvent(handle, event);
}

function compatibilityClick(handle: HTMLElement, pointerType: string) {
  const event = new MouseEvent('click', { bubbles: true, detail: 1 });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  fireEvent(handle, event);
}

describe('sheet pointer release', () => {
  it.each(['touch', 'pen'])(
    'handles a %s tap after a drag even when the browser omits click',
    async (pointerType) => {
      render(<SheetHarness />);
      const handle = screen.getByRole('button', { name: '상세 펼치기' });
      // jsdom has no native pointer capture; events below still exercise the real handlers.
      Object.defineProperty(handle, 'setPointerCapture', { value: () => {} });
      pointer(handle, 'pointerdown', pointerType, 500);
      pointer(handle, 'pointerup', pointerType, 380);
      expect(handle).toHaveAttribute('aria-expanded', 'true');
      compatibilityClick(handle, pointerType);
      expect(handle).toHaveAttribute('aria-expanded', 'true');
      pointer(handle, 'pointerdown', pointerType, 140);
      pointer(handle, 'pointerup', pointerType, 140);
      // Pointer release must finish the tap; a compatibility click may never arrive.
      expect(handle).toHaveAttribute('aria-expanded', 'false');
      compatibilityClick(handle, pointerType);
      expect(handle).toHaveAttribute('aria-expanded', 'false');
      handle.focus();
      await userEvent.setup().keyboard('{Enter}');
      expect(handle).toHaveAttribute('aria-expanded', 'true');
    },
  );
});
