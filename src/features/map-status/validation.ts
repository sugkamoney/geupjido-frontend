import type { components } from '../map-exploration/api/generated';
import {
  array,
  count,
  MapContractError,
  nullable,
  object,
} from '../map-exploration/api/validation';

export type MapStatus = components['schemas']['Status'];

function instant(value: unknown, path: string): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new MapContractError(path);
  }
  const calendarDate = value.slice(0, 10);
  const midnight = new Date(`${calendarDate}T00:00:00Z`);
  if (
    !Number.isFinite(midnight.getTime()) ||
    midnight.toISOString().slice(0, 10) !== calendarDate
  ) {
    throw new MapContractError(path);
  }
  return value;
}

export function parseMapStatus(value: unknown): MapStatus {
  const status = object(value, 'status');
  const initialGradeCounts = array(
    status.initialGradeCounts,
    'status.initialGradeCounts',
    (item, path) => {
      const entry = object(item, path);
      const grade = count(entry.grade, `${path}.grade`);
      if (grade < 1 || grade > 5) throw new MapContractError(`${path}.grade`);
      return { grade, count: count(entry.count, `${path}.count`) };
    },
  );
  if (
    initialGradeCounts.length !== 5 ||
    new Set(initialGradeCounts.map(({ grade }) => grade)).size !== 5
  ) {
    throw new MapContractError('status.initialGradeCounts');
  }
  return {
    zoneCount: count(status.zoneCount, 'status.zoneCount'),
    initialTierZoneCount: count(
      status.initialTierZoneCount,
      'status.initialTierZoneCount',
    ),
    missingInitialTierZoneCount: count(
      status.missingInitialTierZoneCount,
      'status.missingInitialTierZoneCount',
    ),
    voteBasedZoneCount: count(
      status.voteBasedZoneCount,
      'status.voteBasedZoneCount',
    ),
    collectingZoneCount: count(
      status.collectingZoneCount,
      'status.collectingZoneCount',
    ),
    initialGradeCounts,
    validVoteCount: count(status.validVoteCount, 'status.validVoteCount'),
    participantCount: count(status.participantCount, 'status.participantCount'),
    lastCompletedAt: nullable(
      status.lastCompletedAt,
      'status.lastCompletedAt',
      instant,
    ),
    nextScheduledAt: nullable(
      status.nextScheduledAt,
      'status.nextScheduledAt',
      instant,
    ),
  };
}
