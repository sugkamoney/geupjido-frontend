import { useEffect, useRef, useState } from 'react';
import type { WorldcupApi } from './api/client';
import { WorldcupApiError } from './api/client';
import { WorldcupContractError } from './api/validation';
import type { Game, GameCard, GameRound, WorldcupZone } from './api/contracts';
import type { Choice, Match, MatchCard } from './source';
import { objectParticle, progressDelay, type Ratio } from './model';
export type WorldcupState = {
  phase:
    'loading' | 'ready' | 'pending' | 'feedback' | 'failed' | 'empty' | 'limit';
  match?: Match;
  choice?: Choice;
  ratio?: Ratio;
  message?: string;
  alternatives?: WorldcupZone[];
};
export function koreanDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
function gameCard(card: GameCard, scope?: string): MatchCard {
  return {
    zone: {
      id: scope ?? '',
      name: card.zoneName,
      district: card.cityName,
      value: card.zoneTier.toFixed(1),
      grade: Math.floor(card.zoneTier) as 1 | 2 | 3 | 4 | 5,
    },
    apartment: {
      id: card.complexId,
      zoneId: scope ?? '',
      name: card.name,
      households: card.households,
      year: card.approvalYear,
      priceManwon: card.representativeSale.priceTenThousandWon,
      areaM2: card.representativeSale.exclusiveAreaSquareMeters,
      live: true,
    },
    description: '',
    contractDate: card.representativeSale.contractDate,
  };
}
export function gameMatch(game: Game, round: GameRound, scope?: string): Match {
  return {
    id: `${game.baseZoneId}:${round.roundNumber}:${round.left.complexId}:${round.right.complexId}`,
    cursor: round.roundNumber - 1,
    kind: round.type === 'WITHIN_ZONE' ? 'apartment' : 'zone',
    cards: [gameCard(round.left, scope), gameCard(round.right, scope)],
  };
}
const sameGame = (a: Game, b: Game) =>
  JSON.stringify(a.matchups) === JSON.stringify(b.matchups) &&
  a.baseZoneId === b.baseZoneId &&
  a.selections.every((s) =>
    b.selections.some((t) => JSON.stringify(t) === JSON.stringify(s)),
  ) &&
  a.skips.every((s) =>
    b.skips.some((t) => JSON.stringify(t) === JSON.stringify(s)),
  );
const isError = (e: unknown, status: number, code?: string) =>
  e instanceof WorldcupApiError &&
  e.status === status &&
  (!code || e.code === code);
export function useLiveWorldcup(
  api: WorldcupApi | undefined,
  zoneId: string | undefined,
  onSuccess: (match: Match, choice: Choice) => void,
  reduced: boolean,
  onRefresh?: () => void,
) {
  const [state, setState] = useState<WorldcupState>({ phase: 'loading' }),
    [feedback, setFeedback] = useState('');
  const latest = useRef({ onSuccess, reduced, onRefresh });
  useEffect(() => {
    latest.current = { onSuccess, reduced, onRefresh };
  }, [onSuccess, reduced, onRefresh]);
  const actions = useRef({
    choose: (() => {}) as (choice: Choice) => void,
    retry: () => {},
    alternative: (() => {}) as (id: string) => void,
  });
  useEffect(() => {
    if (!api) return;
    let alive = true,
      locked = true,
      canRetry = false,
      game: Game | undefined,
      scope = zoneId,
      loadedDate = koreanDate();
    let request: AbortController | undefined,
      advance: ReturnType<typeof setTimeout> | undefined,
      reset: ReturnType<typeof setTimeout> | undefined;
    let uncertain:
      { game: Game; round: number; choice: Choice; match: Match } | undefined;
    const begin = () => {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      return controller.signal;
    };
    const valid = (signal: AbortSignal) => alive && !signal.aborted;
    const show = (value: Game) => {
      if (
        scope &&
        (value.baseZoneId !== scope ||
          value.matchups.some((r) => r.type !== 'WITHIN_ZONE'))
      )
        throw new WorldcupContractError();
      game = value;
      loadedDate = koreanDate();
      const round = value.matchups.find(
        (r) => r.roundNumber === value.nextRoundNumber,
      );
      if (!round) throw new WorldcupContractError();
      locked = false;
      setState({ phase: 'ready', match: gameMatch(value, round, scope) });
    };
    const fail = (e: unknown, match?: Match) => {
      locked = true;
      canRetry = true;
      if (isError(e, 429, 'DAILY_GAME_LIMIT_REACHED'))
        setState({
          phase: 'limit',
          message:
            '오늘 일반 월드컵을 모두 마쳤어요. 한국 시간 자정부터 다시 참여할 수 있어요.',
        });
      else if (isError(e, 409, 'GAME_UNAVAILABLE'))
        setState({ phase: 'empty', message: '비교할 단지가 아직 부족해요.' });
      else
        setState({
          phase: 'failed',
          match,
          message: uncertain
            ? '선택 결과를 확인하지 못했어요. 다시 시도하면 저장 여부부터 확인해요.'
            : '대진을 불러오지 못했어요.',
        });
    };
    const start = async (signal: AbortSignal) => {
      if (scope) {
        const zones = await api.zones(signal);
        if (!valid(signal)) return null;
        const zone = zones.find((z) => z.zoneId === scope);
        if (!zone?.canStart) {
          const alternatives = await api.alternatives(scope, signal);
          if (valid(signal))
            setState({
              phase: 'empty',
              message: '이 권역은 비교할 단지가 아직 부족해요.',
              alternatives,
            });
          canRetry = true;
          return null;
        }
      }
      try {
        return await api.start(scope, signal);
      } catch (e) {
        if (scope && isError(e, 409, 'GAME_UNAVAILABLE')) {
          const alternatives = await api.alternatives(scope, signal);
          if (valid(signal))
            setState({
              phase: 'empty',
              message: '이 권역은 비교할 단지가 아직 부족해요.',
              alternatives,
            });
          canRetry = true;
          return null;
        }
        throw e;
      }
    };
    const currentOrStart = async (
      signal: AbortSignal,
    ): Promise<Game | null> => {
      const date = koreanDate();
      try {
        const current = await api.current(scope, signal);
        if (!valid(signal)) return null;
        if (!scope && date !== koreanDate()) return currentOrStart(signal);
        if (!current.completed) return current;
      } catch (e) {
        if (!isError(e, 404, 'GAME_NOT_FOUND')) throw e;
      }
      if (!valid(signal)) return null;
      if (!scope && date !== koreanDate()) return currentOrStart(signal);
      const started = await start(signal);
      if (valid(signal) && !scope && date !== koreanDate())
        return currentOrStart(signal);
      return started;
    };
    const load = async () => {
      locked = true;
      canRetry = false;
      setState({ phase: 'loading' });
      const signal = begin();
      try {
        const value = await currentOrStart(signal);
        if (valid(signal) && value) show(value);
      } catch (e) {
        if (valid(signal)) fail(e);
      }
    };
    const confirm = (
      value: Game,
      match: Match,
      choice: Choice,
      signal: AbortSignal,
      recovered = false,
    ) => {
      if (!valid(signal)) return;
      const round = match.cursor + 1;
      const recorded =
        choice === 'skip'
          ? value.skips.some((s) => s.roundNumber === round)
          : value.selections.some(
              (s) =>
                s.roundNumber === round &&
                s.selectedComplexId === match.cards[choice].apartment.id,
            );
      if (!game || !sameGame(game, value) || !recorded)
        throw new WorldcupContractError();
      if (!recovered && value.roundResult?.roundNumber !== round)
        throw new WorldcupContractError();
      game = value;
      uncertain = undefined;
      const result = value.roundResult;
      const ratio: Ratio =
        !recovered && result?.available
          ? {
              kind: 'visible',
              values: [result.leftPercent!, result.rightPercent!],
            }
          : { kind: 'hidden' };
      setState({ phase: 'feedback', match, choice, ratio });
      const picked = choice === 'skip' ? undefined : match.cards[choice];
      const name =
        match.kind === 'zone' ? picked?.zone.name : picked?.apartment.name;
      setFeedback(
        name
          ? `‘${name}’${objectParticle(name)} 담았어요`
          : '넘긴 판은 담기지 않아요',
      );
      clearTimeout(reset);
      reset = setTimeout(() => {
        if (alive) setFeedback('');
      }, 2400);
      latest.current.onSuccess(match, choice);
      latest.current.onRefresh?.();
      advance = setTimeout(
        () => {
          if (!alive) return;
          if (value.completed || (!scope && loadedDate !== koreanDate()))
            void load();
          else {
            try {
              show(value);
            } catch (e) {
              fail(e);
            }
          }
        },
        progressDelay(ratio, latest.current.reduced),
      );
    };
    const resync = async (signal: AbortSignal, message: string) => {
      uncertain = undefined;
      const value = await currentOrStart(signal);
      if (!valid(signal)) return;
      latest.current.onRefresh?.();
      if (value) show(value);
      setFeedback(message);
    };
    const send = async (choice: Choice, match: Match, signal: AbortSignal) => {
      if (!game) return;
      uncertain = { game, round: match.cursor + 1, choice, match };
      try {
        const value = await api.submit(
          scope,
          match.cursor + 1,
          choice === 'skip' ? 'skip' : match.cards[choice].apartment.id,
          signal,
        );
        if (valid(signal)) confirm(value, match, choice, signal);
      } catch (e) {
        if (!valid(signal)) return;
        if (isError(e, 409) || isError(e, 404, 'GAME_NOT_FOUND')) {
          try {
            await resync(
              signal,
              '다른 요청으로 진행이 바뀌어 최신 대진을 불러왔어요.',
            );
          } catch (error) {
            if (valid(signal)) fail(error);
          }
        } else fail(e, match);
      }
    };
    const choose = async (choice: Choice) => {
      if (locked || !game || game.nextRoundNumber === null) return;
      locked = true;
      const match = gameMatch(
        game,
        game.matchups[game.nextRoundNumber - 1]!,
        scope,
      );
      setState({ phase: 'pending', match, choice });
      const signal = begin();
      if (!scope && loadedDate !== koreanDate()) {
        try {
          await resync(
            signal,
            '한국 날짜가 바뀌어 오늘 대진을 다시 불러왔어요.',
          );
        } catch (e) {
          if (valid(signal)) fail(e);
        }
        return;
      }
      await send(choice, match, signal);
    };
    const retry = async () => {
      if (!canRetry) return;
      canRetry = false;
      if (!uncertain) {
        await load();
        return;
      }
      const pending = uncertain;
      locked = true;
      setState({
        phase: 'pending',
        match: pending.match,
        choice: pending.choice,
      });
      const signal = begin();
      try {
        if (!scope && loadedDate !== koreanDate()) {
          await resync(
            signal,
            '한국 날짜가 바뀌어 오늘 대진을 다시 불러왔어요.',
          );
          return;
        }
        let current: Game;
        try {
          current = await api.current(scope, signal);
        } catch (e) {
          if (isError(e, 404, 'GAME_NOT_FOUND')) {
            await resync(signal, '최신 진행을 다시 불러왔어요.');
            return;
          }
          throw e;
        }
        if (!valid(signal)) return;
        if (!scope && loadedDate !== koreanDate()) {
          await resync(
            signal,
            '한국 날짜가 바뀌어 오늘 대진을 다시 불러왔어요.',
          );
          return;
        }
        if (!sameGame(pending.game, current)) {
          await resync(signal, '게임이 바뀌어 최신 진행을 불러왔어요.');
          return;
        }
        const selection = current.selections.find(
            (s) => s.roundNumber === pending.round,
          ),
          skip = current.skips.find((s) => s.roundNumber === pending.round);
        if (selection || skip) {
          if (
            (pending.choice === 'skip' && skip) ||
            (pending.choice !== 'skip' &&
              selection?.selectedComplexId ===
                pending.match.cards[pending.choice].apartment.id)
          ) {
            confirm(current, pending.match, pending.choice, signal, true);
          } else
            await resync(
              signal,
              '이미 확정된 판이 있어 최신 진행을 불러왔어요.',
            );
          return;
        }
        game = current;
        await send(pending.choice, pending.match, signal);
      } catch (e) {
        if (valid(signal)) fail(e, pending.match);
      }
    };
    actions.current = {
      choose: (c) => {
        void choose(c);
      },
      retry: () => {
        void retry();
      },
      alternative: (id) => {
        if (!locked) return;
        scope = id;
        game = undefined;
        uncertain = undefined;
        void load();
      },
    };
    queueMicrotask(() => {
      if (alive) {
        setFeedback('');
        void load();
      }
    });
    return () => {
      alive = false;
      locked = true;
      request?.abort();
      clearTimeout(advance);
      clearTimeout(reset);
      actions.current = {
        choose: () => {},
        retry: () => {},
        alternative: () => {},
      };
    };
  }, [api, zoneId]);
  return {
    state,
    feedback,
    choose: (choice: Choice) => actions.current.choose(choice),
    retry: () => actions.current.retry(),
    alternative: (id: string) => actions.current.alternative(id),
  };
}
