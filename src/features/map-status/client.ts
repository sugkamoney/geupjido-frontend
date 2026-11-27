import { getMap } from '../map-exploration/api/client';
import { parseMapStatus } from './validation';

export function fetchMapStatus(signal: AbortSignal) {
  return getMap('/status', signal, parseMapStatus);
}
