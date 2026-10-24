import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  use: { baseURL: 'http://127.0.0.1:4178', headless: true, trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --port 4178', url: 'http://127.0.0.1:4178', reuseExistingServer: false, timeout: 30_000 },
  reporter: 'list',
  workers: 2,
});
