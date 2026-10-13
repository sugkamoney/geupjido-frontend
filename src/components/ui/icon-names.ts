export const iconNames = [
  'Search',
  'Plus',
  'Minus',
  'Expand',
  'Close',
  'Versus',
  'ChevronLeft16',
  'ChevronRight16',
  'Apartment16',
] as const;
export type IconName = (typeof iconNames)[number];
