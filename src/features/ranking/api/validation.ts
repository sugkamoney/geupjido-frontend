import type { RankingFilters, RankingResponse, RankingZone } from './contracts';

export class RankingContractError extends Error {
  constructor(readonly path: string) {
    super(`Invalid ranking API data at ${path}`);
    this.name = 'RankingContractError';
  }
}

type Parser<T> = (value: unknown, path: string) => T;

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RankingContractError(path);
  return value as Record<string, unknown>;
}

function array<T>(value: unknown, path: string, parse: Parser<T>): T[] {
  if (!Array.isArray(value)) throw new RankingContractError(path);
  return value.map((item, index) => parse(item, `${path}[${index}]`));
}

function nullable<T>(parse: Parser<T>): Parser<T | null> {
  return (value, path) => (value === null ? null : parse(value, path));
}

function oneOf<T extends string>(values: readonly T[]): Parser<T> {
  return (value, path) => {
    const match = values.find((option) => option === value);
    if (match === undefined) throw new RankingContractError(path);
    return match;
  };
}

const text: Parser<string> = (value, path) => {
  if (typeof value !== 'string' || !value.trim())
    throw new RankingContractError(path);
  return value;
};

const finite: Parser<number> = (value, path) => {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new RankingContractError(path);
  return value;
};

const count: Parser<number> = (value, path) => {
  const number = finite(value, path);
  if (!Number.isSafeInteger(number) || number < 0)
    throw new RankingContractError(path);
  return number;
};

const rank = nullable((value, path) => {
  const number = count(value, path);
  if (number === 0) throw new RankingContractError(path);
  return number;
});

const timestamp = nullable((value, path) => {
  const date = text(value, path);
  if (
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      date,
    ) ||
    !Number.isFinite(Date.parse(date))
  )
    throw new RankingContractError(path);
  const day = date.slice(0, 10);
  const utcDay = new Date(`${day}T00:00:00Z`);
  if (
    !Number.isFinite(utcDay.getTime()) ||
    utcDay.toISOString().slice(0, 10) !== day
  )
    throw new RankingContractError(path);
  return date;
});

const region = oneOf<RankingFilters['region']>([
  'ALL',
  'SEOUL',
  'GYEONGGI_INCHEON',
]);
const tab = oneOf<RankingFilters['tab']>([
  'GRADE_1',
  'GRADE_2',
  'GRADE_3',
  'GRADE_4',
  'GRADE_5',
  'COLLECTING',
]);
const sort = oneOf<RankingFilters['sort']>(['CURRENT', 'RISEN', 'FALLEN']);
const rankingBasis = oneOf<RankingZone['rankingBasis']>(['INITIAL', 'VOTE']);
const movement = oneOf<RankingZone['movement']>(['UP', 'DOWN', 'SAME', 'NONE']);
const nullableNumber = nullable(finite);
const tierDelta = nullable((value, path) => {
  const number = finite(value, path);
  if (number < 0) throw new RankingContractError(path);
  return number;
});

const zone: Parser<RankingZone> = (value, path) => {
  const row = object(value, path);
  return {
    zoneId: text(row.zoneId, `${path}.zoneId`),
    name: text(row.name, `${path}.name`),
    cityName: text(row.cityName, `${path}.cityName`),
    regionName: text(row.regionName, `${path}.regionName`),
    rankingBasis: rankingBasis(row.rankingBasis, `${path}.rankingBasis`),
    tier: nullableNumber(row.tier, `${path}.tier`),
    rank: rank(row.rank, `${path}.rank`),
    rankTotal: count(row.rankTotal, `${path}.rankTotal`),
    previousTier: nullableNumber(row.previousTier, `${path}.previousTier`),
    tierDelta: tierDelta(row.tierDelta, `${path}.tierDelta`),
    movement: movement(row.movement, `${path}.movement`),
    validVoteCount: count(row.validVoteCount, `${path}.validVoteCount`),
    participantCount: count(row.participantCount, `${path}.participantCount`),
    crossZoneVoteCount: count(
      row.crossZoneVoteCount,
      `${path}.crossZoneVoteCount`,
    ),
  };
};

const gradeCount: Parser<RankingResponse['gradeCounts'][number]> = (
  value,
  path,
) => {
  const entry = object(value, path);
  const grade = count(entry.grade, `${path}.grade`);
  if (grade < 1 || grade > 5) throw new RankingContractError(`${path}.grade`);
  return { grade, count: count(entry.count, `${path}.count`) };
};

export function parseRankingResponse(value: unknown): RankingResponse {
  const response = object(value, 'response');
  const gradeCounts = array(response.gradeCounts, 'gradeCounts', gradeCount);
  if (
    gradeCounts.length !== 5 ||
    new Set(gradeCounts.map(({ grade }) => grade)).size !== 5
  )
    throw new RankingContractError('gradeCounts');
  return {
    region: region(response.region, 'region'),
    tab: tab(response.tab, 'tab'),
    sort: sort(response.sort, 'sort'),
    totalZoneCount: count(response.totalZoneCount, 'totalZoneCount'),
    rankedZoneCount: count(response.rankedZoneCount, 'rankedZoneCount'),
    gradeCounts,
    collectingCount: count(response.collectingCount, 'collectingCount'),
    lastCompletedAt: timestamp(response.lastCompletedAt, 'lastCompletedAt'),
    previousCompletedAt: timestamp(
      response.previousCompletedAt,
      'previousCompletedAt',
    ),
    zones: array(response.zones, 'zones', zone),
  };
}
