import { useEffect, useRef, useState } from 'react';
import { Button, CloseButton } from '../../components/ui';
import type { Zone } from '../map-exploration/types';
import type { Choice, Match, MatchCard, WorldcupSource } from './source';
import { useWorldcup } from './use-worldcup';

export function WorldcupDialog({
  source,
  zone,
  introduction,
  count,
  origin,
  onClose,
  onSuccess,
}: {
  source: WorldcupSource;
  zone?: Zone;
  introduction: boolean;
  count: number;
  origin: HTMLElement | null;
  onClose: () => void;
  onSuccess: (match: Match, choice: Choice) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const composition = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [intro, setIntro] = useState(introduction);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      const target =
        origin?.isConnected && origin.getClientRects().length
          ? origin
          : document.querySelector<HTMLElement>('.shell-nav-item');
      target?.focus({ preventScroll: true });
    };
  }, [origin]);
  return (
    <dialog
      ref={ref}
      className="worldcup-dialog"
      aria-labelledby="worldcup-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!composition.current) onClose();
      }}
      onCompositionStart={() => {
        composition.current = true;
      }}
      onCompositionEnd={() => {
        composition.current = false;
      }}
      onKeyDown={(event) => {
        if (event.key === 'Tab') {
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), [href], input:not(:disabled), [tabindex="0"]',
            ),
          ).filter((node) => node.getClientRects().length);
          if (buttons.length) {
            const current = buttons.indexOf(
              document.activeElement as HTMLElement,
            );
            const next = event.shiftKey
              ? current <= 0
                ? buttons.length - 1
                : current - 1
              : (current + 1) % buttons.length;
            event.preventDefault();
            buttons[next]?.focus();
          }
        }
        if (
          event.key === 'Escape' &&
          (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <div className="worldcup-layout">
        {intro ? (
          <section className="worldcup-window worldcup-introduction">
            <div className="worldcup-header">
              <CloseButton label="월드컵 닫기" onClick={onClose} />
            </div>
            <h2 id="worldcup-title">
              두 곳 중에
              <br />더 살고 싶은 곳을 고르세요
            </h2>
            <p>고른 결과는 모여 민심급지에 반영됩니다</p>
            <div className="worldcup-explanation">
              <img src="/assets/images/worldcup-explanation.png" alt="" />
            </div>
            <Button variant="Primary" autoFocus onClick={() => setIntro(false)}>
              시작하기
            </Button>
            <small className="worldcup-fixture-note">{source.label}</small>
          </section>
        ) : (
          <Play
            source={source}
            zone={zone}
            count={count}
            onClose={onClose}
            onSuccess={onSuccess}
            heading={heading}
          />
        )}
      </div>
    </dialog>
  );
}
function Play({
  source,
  zone,
  count,
  onClose,
  onSuccess,
  heading,
}: {
  source: WorldcupSource;
  zone?: Zone;
  count: number;
  onClose: () => void;
  onSuccess: (match: Match, choice: Choice) => void;
  heading: React.RefObject<HTMLHeadingElement | null>;
}) {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const { state, feedback, choose, retry } = useWorldcup(
    source,
    zone,
    onSuccess,
    reduced,
  );
  // Stable heading focus survives disabled actions and replacement of the next match.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [heading, state.phase]);
  const revealed = state.phase === 'feedback';
  const blocked = state.phase !== 'ready';
  return (
    <div className="worldcup-center">
      <section className="worldcup-window worldcup-play">
        <div className="worldcup-header">
          <CloseButton label="월드컵 닫기" onClick={onClose} />
        </div>
        <MyPicks count={count} feedback={feedback} />
        <h2 ref={heading} tabIndex={-1} id="worldcup-title">
          어디 살고 싶으세요?
        </h2>
        <p className="worldcup-record">
          고른 기록은 민심급지를 산정할 때 함께 쓰여요.
        </p>
        {state.match ? (
          <>
            <div
              className="worldcup-pair"
              data-skipped={revealed && state.choice === 'skip'}
              aria-busy={state.phase === 'pending'}
            >
              {state.match.cards.map((card, index) => (
                <MatchCardView
                  key={index}
                  card={card}
                  index={index}
                  revealed={revealed}
                  picked={revealed && state.choice === index}
                  dimmed={
                    revealed &&
                    state.choice !== 'skip' &&
                    state.choice !== index
                  }
                  blocked={blocked}
                  ratio={
                    revealed && state.ratio?.kind === 'visible'
                      ? state.ratio.values[index]
                      : undefined
                  }
                  onChoose={() => choose(index as 0 | 1)}
                />
              ))}
              <span className="worldcup-vs" aria-hidden="true">
                vs
              </span>
            </div>
            <button
              className="worldcup-skip"
              disabled={blocked}
              onClick={() => choose('skip')}
            >
              잘 모르겠어요
            </button>
          </>
        ) : state.phase === 'loading' ? (
          <p className="worldcup-state" role="status">
            대진을 불러오고 있어요.
          </p>
        ) : state.phase === 'empty' ? (
          <p className="worldcup-state" role="status">
            비교할 단지가 아직 부족해요.
          </p>
        ) : null}
        {state.phase === 'pending' && (
          <p className="worldcup-operation" role="status">
            선택을 보내고 있어요.
          </p>
        )}
        {state.phase === 'failed' && (
          <div className="worldcup-error" role="alert">
            <p>
              {state.match
                ? '선택을 보내지 못했어요. 다시 시도해 주세요.'
                : '대진을 불러오지 못했어요.'}
            </p>
            <Button variant="Subtle" onClick={retry}>
              다시 시도
            </Button>
          </div>
        )}
        <small className="worldcup-fixture-note">{source.label}</small>
      </section>
    </div>
  );
}
function MatchCardView({
  card,
  index,
  revealed,
  picked,
  dimmed,
  blocked,
  ratio,
  onChoose,
}: {
  card: MatchCard;
  index: number;
  revealed: boolean;
  picked: boolean;
  dimmed: boolean;
  blocked: boolean;
  ratio?: number;
  onChoose: () => void;
}) {
  const { zone, apartment: a } = card;
  return (
    <article
      className="worldcup-card"
      data-picked={picked}
      data-dimmed={dimmed}
      onClick={() => {
        if (!blocked) onChoose();
      }}
      aria-label={`${index === 0 ? '왼쪽' : '오른쪽'} ${zone.name} ${a.name}`}
    >
      <div
        className={`worldcup-band ${revealed ? 'ui-grade' : ''}`}
        data-grade={revealed ? zone.grade : undefined}
      >
        <img
          className="ui-grade-house"
          src="/assets/images/house-screen.png"
          alt=""
        />
        <span className="worldcup-district">{zone.district}</span>
        <div>
          <strong>{zone.name}</strong>
          {revealed && (
            <span aria-label={`민심급지 ${zone.value}`}>{zone.value}</span>
          )}
        </div>
      </div>
      <div className="worldcup-card-body">
        <div className="worldcup-apartment">
          <h3>{a.name}</h3>
          <p>
            {a.year === undefined ? '준공연도 —' : `${a.year}년`} ·{' '}
            {a.households.toLocaleString('ko-KR')}세대 ·{' '}
            {a.areaM2 === undefined ? '—' : a.areaM2}m²
          </p>
          <p>
            최근 거래{' '}
            {a.priceManwon === undefined
              ? '—'
              : `${(a.priceManwon / 10000).toFixed(2)}억`}
          </p>
          <p className="worldcup-station">가까운 역 —</p>
        </div>
        <p className="worldcup-description" title={card.description}>
          {card.description}
        </p>
        <Button
          variant={picked ? 'Primary' : 'Subtle'}
          crown={picked}
          className="w-full"
          aria-label={picked ? `${a.name} 선택했어요` : `${a.name} 선택`}
          disabled={blocked}
          onClick={(event) => {
            event.stopPropagation();
            onChoose();
          }}
        >
          {picked ? '선택했어요' : '선택'}
        </Button>
      </div>
      {ratio !== undefined && (
        <span className="worldcup-ratio" data-picked={picked}>
          {ratio}%
        </span>
      )}
    </article>
  );
}
export function MyPicks({
  count,
  feedback,
}: {
  count: number;
  feedback: string;
}) {
  return (
    <aside className="worldcup-picks" aria-label="내 선택 지도">
      <div>
        <h3>내 선택 지도</h3>
        <p className="worldcup-picks-count" aria-live="polite">
          {count ? `${count}개의 선택이 담겼어요` : '아직 담긴 선택이 없어요'}
        </p>
        <p className="worldcup-picks-feedback" role="status">
          {feedback ||
            (count >= 20
              ? '고른 곳은 계속 담겨요'
              : '고를 때마다 한 칸씩 채워져요')}
        </p>
      </div>
      <div className="worldcup-board" aria-hidden="true">
        <div>
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} data-filled={i < count} />
          ))}
        </div>
        <b>{count <= 20 ? `${count} / 20` : `${count}개`}</b>
      </div>
    </aside>
  );
}
