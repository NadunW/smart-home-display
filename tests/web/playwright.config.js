// Behaviour tests for the family display (web/index.html). See README.md in this folder.
import { defineConfig, devices } from '@playwright/test';

// Locally you can use an installed Chrome instead of downloading Playwright's: PW_CHANNEL=chrome
const channel = process.env.PW_CHANNEL || undefined;
const common = { locale: 'en-GB', timezoneId: 'Europe/Stockholm', channel };

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    // The wall tablet (Lenovo Tab M10 Plus, landscape).
    { name: 'tablet', grepInvert: /@phone/, use: { ...devices['Desktop Chrome'], ...common, viewport: { width: 1280, height: 800 } } },
    // A phone: header wraps, one column, no slideshow. Only tests tagged @phone run here.
    { name: 'phone', grep: /@phone/, use: { ...devices['Pixel 7'], ...common } },
  ],
});
