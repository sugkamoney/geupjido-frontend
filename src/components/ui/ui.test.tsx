import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  Button,
  CloseButton,
  GradeChip,
  GradeStage,
  MapControl,
  PanelHandle,
  SearchField,
} from './index';

describe('common UI contracts', () => {
  it('keeps a read-only search value unchanged and removes its editing control', async () => {
    const user = userEvent.setup();
    function Example() {
      const [value, setValue] = useState('압구정');
      return (
        <SearchField
          label="읽기 전용 지역"
          value={value}
          onValueChange={setValue}
          readOnly
        />
      );
    }
    render(<Example />);
    const input = screen.getByRole('searchbox', { name: '읽기 전용 지역' });
    await user.type(input, '강남');
    expect(input).toHaveValue('압구정');
    expect(
      screen.queryByRole('button', { name: '검색어 지우기' }),
    ).not.toBeInTheDocument();
  });
  it('activates buttons by keyboard without accidentally submitting a form', async () => {
    const user = userEvent.setup();
    function Example() {
      const [count, setCount] = useState(0);
      const [submitted, setSubmitted] = useState(false);
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
          }}
        >
          <Button variant="Primary" onClick={() => setCount(count + 1)}>
            선택
          </Button>
          <Button disabled onClick={() => setCount(99)}>
            비활성
          </Button>
          <output>
            {count} / {String(submitted)}
          </output>
        </form>
      );
    }
    render(<Example />);
    await user.tab();
    await user.keyboard('{Enter} ');
    expect(screen.getByText('2 / false')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '비활성' }));
    expect(screen.getByText('2 / false')).toBeVisible();
  });

  it('clears controlled search and returns focus while retaining consumer keyboard handling', async () => {
    const user = userEvent.setup();
    function Example() {
      const [value, setValue] = useState('');
      const [key, setKey] = useState('');
      return (
        <>
          <SearchField
            label="지역 검색"
            value={value}
            onValueChange={setValue}
            onKeyDown={(event) => setKey(event.key)}
          />
          <output>{key}</output>
        </>
      );
    }
    render(<Example />);
    const input = screen.getByRole('searchbox', { name: '지역 검색' });
    expect(
      screen.queryByRole('button', { name: '검색어 지우기' }),
    ).not.toBeInTheDocument();
    await user.type(input, '강남');
    await user.keyboard('{Escape}');
    expect(screen.getByText('Escape')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('delivers input during Korean composition instead of filtering it out', () => {
    function Example() {
      const [value, setValue] = useState('');
      return (
        <SearchField label="지역 검색" value={value} onValueChange={setValue} />
      );
    }
    render(<Example />);
    const input = screen.getByRole('searchbox');
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'ㄱ' } });
    expect(input).toHaveValue('ㄱ');
    fireEvent.change(input, { target: { value: '강' } });
    expect(input).toHaveValue('강');
    fireEvent.compositionEnd(input);
  });

  it('takes an explicit grade and announces the current stage independently of thresholds', () => {
    const { rerender } = render(
      <>
        <GradeChip grade={5} value="5.9" />
        <GradeStage stage="Provisional" />
      </>,
    );
    expect(screen.getByLabelText('민심급지 5.9')).toBeVisible();
    expect(screen.getByText('잠정')).toHaveAttribute('aria-current', 'step');
    expect(
      screen.getByText('시세순 급지표와 사용자 비교 결과를 함께 반영했습니다.'),
    ).toBeVisible();
    rerender(<GradeStage stage="Confirmed" />);
    expect(screen.getByText('민심급지')).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('exposes control names and panel state to keyboard and assistive technology', async () => {
    const user = userEvent.setup();
    function Example() {
      const [open, setOpen] = useState(true);
      const [zoom, setZoom] = useState(0);
      return (
        <>
          <PanelHandle
            expanded={open}
            aria-controls="panel"
            onClick={() => setOpen(!open)}
          />
          {open && <section id="panel">패널</section>}
          <MapControl icon="Plus" onClick={() => setZoom(zoom + 1)} />
          <CloseButton label="예제 닫기" onClick={() => setZoom(0)} />
          <output>확대 {zoom}</output>
        </>
      );
    }
    render(<Example />);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.queryByText('패널')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '패널 펼치기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await user.tab();
    await user.keyboard(' ');
    expect(screen.getByText('확대 1')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '예제 닫기' }));
    expect(screen.getByText('확대 0')).toBeVisible();
  });
});
