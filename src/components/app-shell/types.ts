import type { ReactNode } from 'react';

export type DisplayLevel = 'gu' | 'zone';
export type MapCommand = 'zoom-in' | 'zoom-out' | 'fit';
/** CSS pixels relative to the map slot; adapters can center inside this frame. */
export type MapFrame = { x: number; y: number; width: number; height: number };
export type ShellDetail = {
  id: string;
  title: string;
  location: string;
  summary?: ReactNode;
  expandedSummary?: ReactNode;
  actions?: ReactNode;
  listTitle?: ReactNode;
  content: ReactNode;
};
export type ShellSearch = {
  value: string;
  onValueChange: (value: string) => void;
  results?: ReactNode;
};
export type AppShellProps = {
  map: (context: { frame: MapFrame; level: DisplayLevel }) => ReactNode;
  timeline?: ReactNode;
  detail?: ShellDetail;
  onDetailClose?: () => void;
  search: ShellSearch;
  onLevelChange?: (level: DisplayLevel) => void;
  onMapCommand?: (command: MapCommand) => void;
  /** Only the review route exposes undecided menu placeholders. */
  review?: boolean;
};
