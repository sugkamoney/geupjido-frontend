import { useEffect, useRef, useState } from 'react';
import type { Zone } from '../map-exploration/types';
import { objectParticle, progressDelay, type Ratio } from './model';
import type { Choice, Match, WorldcupSource } from './source';
type State = {
  phase: 'loading' | 'ready' | 'pending' | 'feedback' | 'failed' | 'empty';
  match?: Match;
  choice?: Choice;
  ratio?: Ratio;
};
export function useWorldcup(
  source: WorldcupSource,
  zone: Zone | undefined,
  onSuccess: (match: Match, choice: Choice) => void,
  reduced: boolean,
) {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [feedback, setFeedback] = useState('');
  const latest = useRef({ onSuccess, reduced });
  useEffect(() => {
    latest.current = { onSuccess, reduced };
  }, [onSuccess, reduced]);
  const actions = useRef({
    choose: (() => {}) as (choice: Choice) => void,
    retry: () => {},
  });
  useEffect(() => {
    let alive = true;
    let locked = true;
    let current: Match | undefined;
    let cursor = 0;
    let lastChoice: Choice | undefined;
    let request: AbortController | undefined;
    let advance: ReturnType<typeof setTimeout> | undefined;
    let reset: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      locked = true;
      current = undefined;
      lastChoice = undefined;
      setState({ phase: 'loading' });
      request?.abort();
      const controller = new AbortController();
      request = controller;
      try {
        const match = await source.loadMatch(zone, cursor, controller.signal);
        if (!alive || controller.signal.aborted) return;
        if (
          match &&
          (match.cards.some((card) => card.apartment.zoneId !== card.zone.id) ||
            match.cards[0].apartment.id === match.cards[1].apartment.id ||
            (match.kind === 'apartment' &&
              match.cards[0].zone.id !== match.cards[1].zone.id) ||
            (zone &&
              (match.kind !== 'apartment' ||
                match.cards.some((card) => card.zone.id !== zone.id))))
        ) {
          throw new Error('Match does not match the requested scope');
        }
        current = match ?? undefined;
        lastChoice = undefined;
        locked = !match;
        setState(match ? { phase: 'ready', match } : { phase: 'empty' });
      } catch {
        if (alive && !controller.signal.aborted) {
          current = undefined;
          setState({ phase: 'failed' });
        }
      }
    };
    const choose = async (choice: Choice) => {
      if (locked || !current) return;
      locked = true;
      lastChoice = choice;
      const match = current;
      setState({ phase: 'pending', match, choice });
      request?.abort();
      const controller = new AbortController();
      request = controller;
      try {
        const result = await source.submit(match, choice, controller.signal);
        if (!alive || controller.signal.aborted) return;
        setState({ phase: 'feedback', match, choice, ratio: result.ratio });
        const picked = choice === 'skip' ? undefined : match.cards[choice];
        const name =
          match.kind === 'zone' ? picked?.zone.name : picked?.apartment.name;
        clearTimeout(reset);
        setFeedback(
          name
            ? `‘${name}’${objectParticle(name)} 담았어요`
            : '넘긴 판은 담기지 않아요',
        );
        reset = setTimeout(() => {
          if (alive) setFeedback('');
        }, 2400);
        latest.current.onSuccess(match, choice);
        advance = setTimeout(
          () => {
            if (!alive) return;
            cursor = match.cursor + 1;
            void load();
          },
          progressDelay(result.ratio, latest.current.reduced),
        );
      } catch {
        if (alive && !controller.signal.aborted) {
          locked = false;
          setState({ phase: 'failed', match, choice });
        }
      }
    };
    actions.current = {
      choose: (choice) => {
        void choose(choice);
      },
      retry: () => {
        if (lastChoice !== undefined) {
          void choose(lastChoice);
        } else {
          void load();
        }
      },
    };
    queueMicrotask(() => {
      if (!alive) return;
      setFeedback('');
      void load();
    });
    return () => {
      alive = false;
      locked = true;
      request?.abort();
      clearTimeout(advance);
      clearTimeout(reset);
      actions.current = { choose: () => {}, retry: () => {} };
    };
  }, [source, zone]);
  return {
    state,
    feedback,
    choose: (choice: Choice) => actions.current.choose(choice),
    retry: () => actions.current.retry(),
  };
}
