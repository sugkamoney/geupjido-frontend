import {
  isWeeklyReportId,
  type WeeklyReportBoundaryZone,
  type WeeklyReportCityChange,
  type WeeklyReportCollectingZone,
  type WeeklyReportDetail,
  type WeeklyReportList,
  type WeeklyReportSummary,
  type WeeklyReportZoneChange,
} from './contracts';

export class WeeklyReportContractError extends Error {
  constructor(readonly path: string) {
    super(`Invalid weekly report API data at ${path}`);
    this.name = 'WeeklyReportContractError';
  }
}

type Parser<T> = (value: unknown, path: string) => T;

function object<T extends object>(fields: {
  [Key in keyof T]: Parser<T[Key]>;
}): Parser<T> {
  return (value, path) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new WeeklyReportContractError(path);
    const source = value as Record<string, unknown>;
    const result = {} as T;
    for (const key in fields) {
      result[key] = fields[key](source[key], `${path}.${key}`);
    }
    return result;
  };
}

function array<T>(parse: Parser<T>): Parser<T[]> {
  return (value, path) => {
    if (!Array.isArray(value)) throw new WeeklyReportContractError(path);
    return value.map((item, index) => parse(item, `${path}[${index}]`));
  };
}

function nullable<T>(parse: Parser<T>): Parser<T | null> {
  return (value, path) => (value === null ? null : parse(value, path));
}

function oneOf<T extends string>(values: readonly T[]): Parser<T> {
  return (value, path) => {
    const match = values.find((option) => option === value);
    if (match === undefined) throw new WeeklyReportContractError(path);
    return match;
  };
}

const text: Parser<string> = (value, path) => {
  if (typeof value !== 'string' || !value.trim())
    throw new WeeklyReportContractError(path);
  return value;
};

const boolean: Parser<boolean> = (value, path) => {
  if (typeof value !== 'boolean') throw new WeeklyReportContractError(path);
  return value;
};

const nonNegative: Parser<number> = (value, path) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new WeeklyReportContractError(path);
  return value;
};

const count: Parser<number> = (value, path) => {
  const number = nonNegative(value, path);
  if (!Number.isSafeInteger(number)) throw new WeeklyReportContractError(path);
  return number;
};

const reportId: Parser<number> = (value, path) => {
  if (!isWeeklyReportId(value)) throw new WeeklyReportContractError(path);
  return value;
};

const timestamp: Parser<string> = (value, path) => {
  const date = text(value, path);
  if (
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      date,
    ) ||
    !Number.isFinite(Date.parse(date))
  )
    throw new WeeklyReportContractError(path);
  const day = date.slice(0, 10);
  const utcDay = new Date(`${day}T00:00:00Z`);
  if (
    !Number.isFinite(utcDay.getTime()) ||
    utcDay.toISOString().slice(0, 10) !== day
  )
    throw new WeeklyReportContractError(path);
  return date;
};

const publicationFields = {
  reportId,
  periodStart: timestamp,
  periodEnd: timestamp,
  publishedAt: timestamp,
};

function validatePublication(
  report: Pick<
    WeeklyReportSummary,
    'periodStart' | 'periodEnd' | 'publishedAt'
  >,
  path: string,
) {
  const periodEnd = Date.parse(report.periodEnd);
  if (Date.parse(report.periodStart) >= periodEnd)
    throw new WeeklyReportContractError(`${path}.periodEnd`);
  const publicationDelayMs = 3 * 60 * 60 * 1000;
  if (Date.parse(report.publishedAt) < periodEnd + publicationDelayMs)
    throw new WeeklyReportContractError(`${path}.publishedAt`);
}

const summary = object<WeeklyReportSummary>({
  ...publicationFields,
  latest: boolean,
});

const zoneFields = { zoneId: text, zoneName: text, cityName: text };
const collectingZone = object<WeeklyReportCollectingZone>({
  ...zoneFields,
  regionName: text,
  rankingBasis: oneOf(['INITIAL']),
  validVoteCount: count,
  participantCount: count,
  crossZoneVoteCount: count,
  requiredValidVoteCount: count,
  requiredParticipantCount: count,
  requiredCrossZoneVoteCount: count,
});
const zoneChange = object<WeeklyReportZoneChange>({
  ...zoneFields,
  regionName: text,
  previousTier: nonNegative,
  currentTier: nonNegative,
  tierDelta: nonNegative,
});
const boundaryZone = object<WeeklyReportBoundaryZone>({
  ...zoneFields,
  currentTier: nonNegative,
  upperGradeBoundary: nonNegative,
  distance: nonNegative,
});
const cityChange = object<WeeklyReportCityChange>({
  cityId: text,
  cityName: text,
  regionName: text,
  previousAverageTier: nonNegative,
  currentAverageTier: nonNegative,
  averageTierDelta: nonNegative,
  movement: oneOf(['UP', 'DOWN']),
  comparedZoneCount: count,
});

const list = object<WeeklyReportList>({
  state: oneOf(['COLLECTING', 'PREPARING', 'DELAYED', 'PUBLISHED']),
  expectedReleaseAt: timestamp,
  reports: array(summary),
  collectingZones: array(collectingZone),
});

const detail = object<WeeklyReportDetail>({
  ...publicationFields,
  cutoffCompletedAt: timestamp,
  participantCount: count,
  validVoteCount: count,
  changedGradeZoneCount: nullable(count),
  summary: text,
  previousReportId: nullable(reportId),
  nextReportId: nullable(reportId),
  risenZones: array(zoneChange),
  fallenZones: array(zoneChange),
  nearBoundaryZones: array(boundaryZone),
  collectingZones: array(collectingZone),
  cityChanges: array(cityChange),
});

export function parseWeeklyReportList(value: unknown): WeeklyReportList {
  const result = list(value, 'response');
  const ids = new Set<number>();
  for (const [index, report] of result.reports.entries()) {
    const path = `response.reports[${index}]`;
    validatePublication(report, path);
    if (ids.has(report.reportId))
      throw new WeeklyReportContractError(`${path}.reportId`);
    ids.add(report.reportId);
    if (report.latest !== (index === 0))
      throw new WeeklyReportContractError(`${path}.latest`);
  }
  const hasReports = ids.size > 0;
  if (
    (hasReports && result.state === 'COLLECTING') ||
    (!hasReports && result.state === 'PUBLISHED')
  )
    throw new WeeklyReportContractError('response.state');
  if (hasReports && result.collectingZones.length)
    throw new WeeklyReportContractError('response.collectingZones');
  return result;
}

export function parseWeeklyReportDetail(
  value: unknown,
  requestedId: number,
): WeeklyReportDetail {
  const result = detail(value, 'response');
  if (result.reportId !== requestedId)
    throw new WeeklyReportContractError('response.reportId');
  validatePublication(result, 'response');
  const completed = Date.parse(result.cutoffCompletedAt);
  if (
    completed < Date.parse(result.periodEnd) ||
    completed > Date.parse(result.publishedAt)
  )
    throw new WeeklyReportContractError('response.cutoffCompletedAt');
  const { previousReportId, nextReportId, changedGradeZoneCount } = result;
  if (previousReportId === requestedId)
    throw new WeeklyReportContractError('response.previousReportId');
  if (
    nextReportId === requestedId ||
    (nextReportId !== null && nextReportId === previousReportId)
  )
    throw new WeeklyReportContractError('response.nextReportId');
  if ((previousReportId === null) !== (changedGradeZoneCount === null))
    throw new WeeklyReportContractError('response.changedGradeZoneCount');
  if (previousReportId === null) {
    for (const key of ['risenZones', 'fallenZones', 'cityChanges'] as const) {
      if (result[key].length)
        throw new WeeklyReportContractError(`response.${key}`);
    }
  }
  return result;
}
