import { queryOptions, useQuery } from '@tanstack/react-query';
import {
  fetchWeeklyReport,
  fetchWeeklyReportList,
  WeeklyReportApiError,
} from './client';
import { isWeeklyReportId } from './contracts';
import { WeeklyReportContractError } from './validation';

function retryWeeklyReport(attempt: number, error: Error): boolean {
  return (
    attempt < 1 &&
    !(
      error instanceof WeeklyReportContractError || error instanceof RangeError
    ) &&
    !(error instanceof WeeklyReportApiError && error.status < 500)
  );
}

export function weeklyReportListOptions(enabled = true) {
  return queryOptions({
    queryKey: ['weekly-report', 'list'],
    queryFn: ({ signal }) => fetchWeeklyReportList(signal),
    enabled,
    retry: retryWeeklyReport,
    retryDelay: 300,
  });
}

export function weeklyReportDetailOptions(
  reportId: number | null,
  enabled = true,
) {
  const selectedId = isWeeklyReportId(reportId) ? reportId : null;
  return queryOptions({
    queryKey: ['weekly-report', 'detail', selectedId],
    queryFn: ({ signal }) => fetchWeeklyReport(selectedId, signal),
    enabled: enabled && selectedId !== null,
    retry: retryWeeklyReport,
    retryDelay: 300,
  });
}

export function useWeeklyReportList(enabled = true) {
  return useQuery(weeklyReportListOptions(enabled));
}

export function useWeeklyReportDetail(reportId: number | null, enabled = true) {
  return useQuery(weeklyReportDetailOptions(reportId, enabled));
}
