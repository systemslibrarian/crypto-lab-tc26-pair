import { expect, test } from '@playwright/test';

import { boot, driveAllStates, NARROW } from './gate';

for (const viewport of [
  { name: 'desktop', size: { width: 1280, height: 900 } },
  { name: 'phone', size: NARROW },
]) {
  test(`zero WCAG A/AA violations across ${viewport.name} states`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport.size);
    const errors = await boot(page);
    await driveAllStates(page, viewport.name);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}