import { Button } from '../../components/ui';
import type { MapStatus } from './types';

const ERRORS = {
  'auth-error':
    '지도 인증에 실패했습니다. 등록된 주소에서 접속했는지 확인해 주세요.',
  'network-error':
    '지도를 불러오지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.',
  'config-error': '지도 설정이 없습니다.',
} as const;

/**
 * 지도 준비 전·실패 안내. 인증 실패와 설정 누락은 같은 페이지에서 재시도해도 회복되지
 * 않으므로 `다시 시도`가 페이지를 새로고침한다(`onReload`).
 */
export function MapStatusView({
  status,
  onRetry,
  onReload,
}: {
  status: MapStatus;
  onRetry: () => void;
  onReload: () => void;
}) {
  if (status === 'ready') return null;
  if (status === 'loading')
    return (
      <div className="exploration-map-status" role="status">
        <p>지도를 불러오는 중입니다.</p>
      </div>
    );
  return (
    <div className="exploration-map-status" role="alert">
      <p>{ERRORS[status]}</p>
      <Button
        variant="Subtle"
        onClick={status === 'network-error' ? onRetry : onReload}
      >
        다시 시도
      </Button>
    </div>
  );
}
