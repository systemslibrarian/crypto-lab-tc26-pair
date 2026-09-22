import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

import { auditContrast, formatContrastFailures } from './contrast';
import { auditNonText, formatNonTextFailures } from './nontext';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
export const NARROW = { width: 380, height: 800 };

export function watchPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  return errors;
}

async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'));
}

async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow, `horizontal overflow in state: ${label}`).toBeLessThanOrEqual(1);
}

async function expectScrollersReachable(page: Page, label: string): Promise<void> {
  const unreachable = await page.evaluate(() => {
    const focusable = 'a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((item) => item.scrollWidth > item.clientWidth + 1 || item.scrollHeight > item.clientHeight + 1)
      .filter((item) => {
        const style = getComputedStyle(item);
        return ['auto', 'scroll'].includes(style.overflowX) || ['auto', 'scroll'].includes(style.overflowY);
      })
      .filter((item) => item.tabIndex < 0 && !item.querySelector(focusable))
      .map((item) => `${item.tagName.toLowerCase()}#${item.id}.${item.className}`);
  });
  expect(unreachable, `scrolling regions need a keyboard route in state: ${label}`).toEqual([]);
}

async function expectSingleBanner(page: Page): Promise<void> {
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.locator('main#app')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
}

export async function scan(page: Page, label: string): Promise<void> {
  await settle(page);
  const wcag = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const landmarks = await new AxeBuilder({ page }).withRules([
    'landmark-no-duplicate-banner',
    'landmark-unique',
    'landmark-one-main',
    'landmark-complementary-is-top-level',
  ]).analyze();
  const violations = [...wcag.violations, ...landmarks.violations].map((violation) => ({
    state: label,
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target.join(' ')).slice(0, 8),
  }));
  expect(violations, `axe violations in state: ${label}`).toEqual([]);

  const incomplete = [...wcag.incomplete, ...landmarks.incomplete]
    .filter((result) => result.id !== 'color-contrast')
    .map((result) => ({
      state: label,
      id: result.id,
      nodes: result.nodes.map((node) => node.target.join(' ')).slice(0, 8),
    }));
  expect(incomplete, `unresolved axe checks in state: ${label}`).toEqual([]);

  const contrast = Array.from(new Set(formatContrastFailures(await auditContrast(page))));
  expect(contrast, `measured text contrast in state: ${label}`).toEqual([]);

  const hiddenContrast = Array.from(new Set(formatContrastFailures(
    await auditContrast(page, '[aria-hidden="true"], [aria-hidden="true"] *', true),
  )));
  expect(hiddenContrast, `measured aria-hidden contrast in state: ${label}`).toEqual([]);

  const nonText = Array.from(new Set(formatNonTextFailures(await auditNonText(page))));
  expect(nonText, `measured non-text contrast in state: ${label}`).toEqual([]);
  await expectNoHorizontalOverflow(page, label);
  await expectScrollersReachable(page, label);
}

export async function boot(page: Page): Promise<string[]> {
  const errors = watchPageErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('.');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectSingleBanner(page);
  await expect(page.locator('#ship-kat-badge')).toHaveAttribute('data-state', 'pass', { timeout: 30_000 });
  await expect(page.locator('#panel-shipovnik')).toBeVisible();
  await expect(page.locator('#panel-hypericum')).toBeHidden();
  await expect(page.locator('#panel-mirror')).toBeHidden();
  return errors;
}

export async function driveAllStates(page: Page, viewportLabel: string): Promise<void> {
  await scan(page, `${viewportLabel}: arrival`);

  await page.keyboard.press('Tab');
  await expect(page.locator('.cl-skip-link')).toBeFocused();
  await scan(page, `${viewportLabel}: skip link focused`);

  await page.getByRole('button', { name: '1 permutation + masked secret' }).click();
  await expect(page.locator('#stern-status')).toHaveAttribute('data-tone', 'pass');
  await scan(page, `${viewportLabel}: honest Stern opening`);

  await page.getByRole('button', { name: 'Test a prover without the witness' }).click();
  await expect(page.locator('.branch-outcome')).toHaveCount(3);
  await scan(page, `${viewportLabel}: cheating prover`);

  await page.getByRole('button', { name: 'Derive Fiat-Shamir challenge' }).click();
  await expect(page.locator('#stern-status')).toHaveAttribute('data-tone', 'pass');
  await scan(page, `${viewportLabel}: Fiat-Shamir challenge`);

  await page.getByRole('button', { name: 'Change one signature byte' }).click();
  await expect(page.locator('#ship-result')).toContainText('Changed signature rejected');
  await scan(page, `${viewportLabel}: Shipovnik rejection`);

  await page.getByRole('tab', { name: 'Hypericum' }).click();
  await expect(page.locator('#hyper-kat-badge')).toHaveAttribute('data-state', 'pass', { timeout: 120_000 });
  await scan(page, `${viewportLabel}: Hypericum fixture`);

  await page.getByRole('button', { name: /WOTS\+C key/ }).click();
  await scan(page, `${viewportLabel}: hash slot selected`);

  await page.getByRole('button', { name: 'Change one signature byte' }).click();
  await expect(page.locator('#hyper-result')).toContainText('Changed signature rejected');
  await scan(page, `${viewportLabel}: Hypericum rejection`);

  await page.getByRole('tab', { name: 'The Mirror' }).click();
  await page.getByText('Sources and scope').click();
  await expect(page.locator('details.sources')).toHaveAttribute('open', '');
  await scan(page, `${viewportLabel}: mirror and sources`);
}