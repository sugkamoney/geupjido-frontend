import {
  isWeeklyReportId,
  type WeeklyReportDetail,
  type WeeklyReportList,
} from './contracts';
import {
  parseWeeklyReportDetail,
  parseWeeklyReportList,
  WeeklyReportContractError,
} from './validation';

const reportsPath = '/api/v1/reports';

export class WeeklyReportApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`Weekly report API request failed (${status})`);
    this.name = 'WeeklyReportApiError';
  }
}

export function isWeeklyReportNotFound(error: unknown): boolean {
  return (
    error instanceof WeeklyReportApiError &&
    error.status === 404 &&
    error.code === 'REPORT_NOT_FOUND'
  );
}

async function fetchReportJson(
  path: string,
  signal: AbortSignal,
): Promise<unknown> {
  signal.throwIfAborted();
  const response = await fetch(path, {
    method: 'GET',
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  signal.throwIfAborted();

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    signal.throwIfAborted();
    const code =
      body &&
      typeof body === 'object' &&
      'code' in body &&
      typeof body.code === 'string'
        ? body.code
        : undefined;
    throw new WeeklyReportApiError(response.status, code);
  }

  try {
    const body: unknown = await response.json();
    signal.throwIfAborted();
    return body;
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof SyntaxError)
      throw new WeeklyReportContractError('response');
    throw error;
  }
}

export async function fetchWeeklyReportList(
  signal: AbortSignal,
): Promise<WeeklyReportList> {
  return parseWeeklyReportList(await fetchReportJson(reportsPath, signal));
}

export async function fetchWeeklyReport(
  reportId: number | null,
  signal: AbortSignal,
): Promise<WeeklyReportDetail> {
  if (!isWeeklyReportId(reportId))
    throw new RangeError('Expected a positive safe integer report ID');
  return parseWeeklyReportDetail(
    await fetchReportJson(`${reportsPath}/${reportId}`, signal),
    reportId,
  );
}
