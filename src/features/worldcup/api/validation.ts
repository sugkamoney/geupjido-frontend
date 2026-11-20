import type {
  Game,
  GameCard,
  GameRound,
  Progress,
  WorldcupZone,
  LiveTimeline,
  TimelineCandidate,
} from './contracts';
export class WorldcupContractError extends Error {
  constructor() {
    super('Invalid worldcup API data');
    this.name = 'WorldcupContractError';
  }
}
function requireValue(condition: unknown): asserts condition {
  if (!condition) throw new WorldcupContractError();
}
function object(v: unknown): Record<string, unknown> {
  requireValue(v && typeof v === 'object' && !Array.isArray(v));
  return v as Record<string, unknown>;
}
function string(v: unknown): string {
  requireValue(typeof v === 'string' && v.trim());
  return v;
}
function number(v: unknown): number {
  requireValue(typeof v === 'number' && Number.isFinite(v));
  return v;
}
function count(v: unknown): number {
  const n = number(v);
  requireValue(Number.isSafeInteger(n) && n >= 0);
  return n;
}
function boolean(v: unknown): boolean {
  requireValue(typeof v === 'boolean');
  return v;
}
function array<T>(v: unknown, parse: (v: unknown) => T): T[] {
  requireValue(Array.isArray(v));
  return v.map(parse);
}
function nullable<T>(v: unknown, parse: (v: unknown) => T): T | null {
  return v === null ? null : parse(v);
}
function date(v: unknown): string {
  const s = string(v);
  requireValue(/^\d{4}-\d{2}-\d{2}$/.test(s));
  requireValue(new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s);
  return s;
}
function instant(v: unknown): string {
  const s = string(v);
  requireValue(
    /T.*(Z|[+-]\d{2}:\d{2})$/.test(s) && Number.isFinite(Date.parse(s)),
  );
  return s;
}
function card(v: unknown): GameCard {
  const x = object(v),
    sale = object(x.representativeSale);
  const result = {
    complexId: string(x.complexId),
    name: string(x.name),
    cityName: string(x.cityName),
    zoneName: string(x.zoneName),
    zoneTier: number(x.zoneTier),
    households: count(x.households),
    approvalYear: count(x.approvalYear),
    representativeSale: {
      exclusiveAreaSquareMeters: number(sale.exclusiveAreaSquareMeters),
      priceTenThousandWon: count(sale.priceTenThousandWon),
      contractDate: date(sale.contractDate),
    },
  };
  requireValue(
    result.zoneTier >= 1 &&
      result.zoneTier <= 5 &&
      result.representativeSale.exclusiveAreaSquareMeters > 0,
  );
  return result;
}
function round(v: unknown): GameRound {
  const x = object(v);
  requireValue(x.type === 'CROSS_ZONE' || x.type === 'WITHIN_ZONE');
  const r: GameRound = {
    roundNumber: count(x.roundNumber),
    type: x.type,
    left: card(x.left),
    right: card(x.right),
  };
  requireValue(r.left.complexId !== r.right.complexId);
  return r;
}
export function parseGame(v: unknown): Game {
  const x = object(v);
  const game: Game = {
    baseZoneId: string(x.baseZoneId),
    tierRangeUsed: nullable(x.tierRangeUsed, number),
    matchups: array(x.matchups, round),
    selections: array(x.selections, (v) => {
      const s = object(v);
      return {
        roundNumber: count(s.roundNumber),
        selectedComplexId: string(s.selectedComplexId),
        selectedAt: instant(s.selectedAt),
      };
    }),
    skips: array(x.skips, (v) => {
      const s = object(v);
      return {
        roundNumber: count(s.roundNumber),
        skippedAt: instant(s.skippedAt),
      };
    }),
    nextRoundNumber: nullable(x.nextRoundNumber, count),
    completed: boolean(x.completed),
    roundResult: null,
  };
  requireValue(
    game.matchups.length === 10 &&
      game.matchups.every((r, i) => r.roundNumber === i + 1),
  );
  const recorded = [...game.selections, ...game.skips]
    .map((s) => s.roundNumber)
    .sort((a, b) => a - b);
  requireValue(recorded.length <= 10 && recorded.every((n, i) => n === i + 1));
  requireValue(game.completed === (recorded.length === 10));
  requireValue(
    game.nextRoundNumber === (game.completed ? null : recorded.length + 1),
  );
  for (const s of game.selections) {
    const r = game.matchups[s.roundNumber - 1]!;
    requireValue(
      [r.left.complexId, r.right.complexId].includes(s.selectedComplexId),
    );
  }
  if (x.roundResult !== null) {
    const r = object(x.roundResult);
    const result = {
      roundNumber: count(r.roundNumber),
      available: boolean(r.available),
      leftPercent: nullable(r.leftPercent, count),
      rightPercent: nullable(r.rightPercent, count),
    };
    requireValue(result.roundNumber >= 1 && result.roundNumber <= 10);
    requireValue(
      result.available
        ? result.leftPercent !== null &&
            result.rightPercent !== null &&
            result.leftPercent + result.rightPercent === 100
        : result.leftPercent === null && result.rightPercent === null,
    );
    game.roundResult = result;
  }
  return game;
}
export function parseProgress(v: unknown): Progress {
  const x = object(v),
    next = nullable(x.nextMilestone, count);
  requireValue(next === null || next === 30 || next === 60);
  const p: Progress = {
    date: date(x.date),
    dailyLimit: count(x.dailyLimit),
    completedRounds: count(x.completedRounds),
    remainingRounds: count(x.remainingRounds),
    nextMilestone: next,
    roundsUntilNextMilestone: count(x.roundsUntilNextMilestone),
  };
  requireValue(
    p.dailyLimit === 60 &&
      p.completedRounds <= 60 &&
      p.remainingRounds === 60 - p.completedRounds &&
      next ===
        (p.completedRounds < 30 ? 30 : p.completedRounds < 60 ? 60 : null) &&
      p.roundsUntilNextMilestone ===
        (next === null ? 0 : next - p.completedRounds),
  );
  return p;
}
export function parseZones(v: unknown): WorldcupZone[] {
  return array(v, (v) => {
    const x = object(v);
    const z = {
      zoneId: string(x.zoneId),
      cityName: string(x.cityName),
      zoneName: string(x.zoneName),
      tier: nullable(x.tier, number),
      activeComplexCount: count(x.activeComplexCount),
      canStart: boolean(x.canStart),
    };
    requireValue(z.canStart === (z.tier !== null && z.activeComplexCount >= 5));
    return z;
  });
}
function candidate(v: unknown): TimelineCandidate {
  const x = object(v);
  return {
    complexId: string(x.complexId),
    name: string(x.name),
    zoneId: string(x.zoneId),
    zoneName: string(x.zoneName),
  };
}
export function parseTimeline(v: unknown): LiveTimeline {
  const x = object(v);
  const items = array(x.items, (v) => {
    const x = object(v);
    const row = {
      displayName: string(x.displayName),
      mine: boolean(x.mine),
      selectedAt: instant(x.selectedAt),
      left: candidate(x.left),
      right: candidate(x.right),
      selectedComplexId: string(x.selectedComplexId),
    };
    requireValue(
      row.left.complexId !== row.right.complexId &&
        [row.left.complexId, row.right.complexId].includes(
          row.selectedComplexId,
        ),
    );
    return row;
  });
  requireValue(items.length <= 20);
  return { items };
}
