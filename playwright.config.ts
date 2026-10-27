import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const errorPort = port + 1;
const fixtureUrl = `http://127.0.0.1:${port}`;
const errorUrl = `http://127.0.0.1:${errorPort}`;

// E2E 빌드는 타입 검사(tsc -b) 없이 vite build만 호출한다. 타입 검사는 `pnpm check` 담당.
// naver-error 빌드는 가짜 ID를 쓰고 테스트가 oapi.map.naver.com을 route로 막는다.
const serve = (env: string, dir: string, p: number) =>
  `pnpm exec cross-env NODE_ENV=production ${env} pnpm exec vite build --outDir dist-e2e/${dir} && pnpm exec vite preview --outDir dist-e2e/${dir} --host 127.0.0.1 --port ${p} --strictPort`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: fixtureUrl, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: /naver-error/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile-chromium',
      testIgnore: /naver-error/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-webkit',
      testIgnore: /naver-error/,
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'naver-error-chromium',
      testMatch: /naver-error/,
      use: { ...devices['Desktop Chrome'], baseURL: errorUrl },
    },
    {
      name: 'naver-error-webkit',
      testMatch: /naver-error/,
      use: { ...devices['iPhone 13'], baseURL: errorUrl },
    },
  ],
  webServer: [
    {
      command: serve('VITE_MAP_PROVIDER=fixture', 'fixture', port),
      url: fixtureUrl,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: serve(
        'VITE_MAP_PROVIDER=naver VITE_NAVER_MAP_CLIENT_ID=e2e-fake',
        'naver-error',
        errorPort,
      ),
      url: errorUrl,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
