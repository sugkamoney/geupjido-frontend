import { queryOptions } from '@tanstack/react-query';
import { MapApiError } from '../map-exploration/api/client';
import { MapContractError } from '../map-exploration/api/validation';
import { fetchMapStatus } from './client';

export function mapStatusQueryOptions() {
  return queryOptions({
    queryKey: ['map', 'status'],
    queryFn: ({ signal }) => fetchMapStatus(signal),
    retry: (attempt, error) =>
      attempt < 1 &&
      !(error instanceof MapContractError) &&
      !(error instanceof MapApiError && error.status < 500),
    retryDelay: 300,
  });
}
