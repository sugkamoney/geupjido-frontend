import type { components } from '../map-exploration/api/generated';

type Schemas = components['schemas'];
export type WeeklyReportSummary = Required<Schemas['WeeklyReportSummary']>;
export type WeeklyReportCollectingZone = Required<
  Schemas['WeeklyReportCollectingZone']
>;
export type WeeklyReportZoneChange = Required<
  Schemas['WeeklyReportZoneChange']
>;
export type WeeklyReportBoundaryZone = Required<
  Schemas['WeeklyReportBoundaryZone']
>;
export type WeeklyReportCityChange = Required<
  Schemas['WeeklyReportCityChange']
>;

export type WeeklyReportList = Omit<
  Required<Schemas['WeeklyReportListResponse']>,
  'reports' | 'collectingZones'
> & {
  reports: WeeklyReportSummary[];
  collectingZones: WeeklyReportCollectingZone[];
};

type DetailFields =
  | 'changedGradeZoneCount'
  | 'previousReportId'
  | 'nextReportId'
  | 'risenZones'
  | 'fallenZones'
  | 'nearBoundaryZones'
  | 'collectingZones'
  | 'cityChanges';

export type WeeklyReportDetail = Omit<
  Required<Schemas['WeeklyReportDetail']>,
  DetailFields
> & {
  changedGradeZoneCount: number | null;
  previousReportId: number | null;
  nextReportId: number | null;
  risenZones: WeeklyReportZoneChange[];
  fallenZones: WeeklyReportZoneChange[];
  nearBoundaryZones: WeeklyReportBoundaryZone[];
  collectingZones: WeeklyReportCollectingZone[];
  cityChanges: WeeklyReportCityChange[];
};

export function isWeeklyReportId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
