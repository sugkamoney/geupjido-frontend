import { setupServer } from 'msw/node';

// 제품 API 계약이 확정되면 테스트가 필요한 handler를 추가합니다.
export const server = setupServer();
