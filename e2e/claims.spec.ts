import { streebog256 } from '@li0ard/streebog';
import { expect, test } from '@playwright/test';

const encoder = new TextEncoder();

function concatenate(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function expectedTeachingRoot(message: string): string {
  const labels = ['FORS root', 'WOTS+C key', 'auth node A', 'auth node B'];
  const leaves = labels.map((label, index) => streebog256(concatenate(
    Uint8Array.of(0, index),
    encoder.encode(label),
    Uint8Array.of(0),
    encoder.encode(message),
  )));
  const parent = (left: Uint8Array, right: Uint8Array, level: number, index: number) =>
    streebog256(concatenate(Uint8Array.of(1, level, index), left, right));
  return Array.from(
    parent(parent(leaves[0], leaves[1], 1, 0), parent(leaves[2], leaves[3], 1, 1), 2, 0),
    (value) => value.toString(16).padStart(2, '0'),
  ).join('');
}

test('rendered cryptographic claims agree with independent inputs and failure paths', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('.');
  await expect(page.locator('#ship-kat-badge')).toHaveAttribute('data-state', 'pass', { timeout: 30_000 });
  await expect(page.locator('#panel-hypericum')).toBeHidden();
  expect(await page.locator('#panel-hypericum').evaluate((panel) => getComputedStyle(panel).display)).toBe('none');
  await expect(page.locator('#panel-mirror')).toBeHidden();
  await expect(page.locator('#ship-result')).toContainText('805,868 bytes');
  await expect(page.locator('[data-negative-claim="shipovnik-size"]')).toBeVisible();
  await expect(page.locator('[data-negative-claim="shipovnik-size"]')).toContainText('1,072,662 bytes');

  for (const challenge of [0, 1, 2]) {
    await page.locator(`[data-challenge="${challenge}"]`).click();
    await expect(page.locator('#stern-status')).toHaveAttribute('data-tone', 'pass');
  }

  await page.getByRole('button', { name: 'Test a prover without the witness' }).click();
  const outcomes = await page.locator('.branch-outcome').allTextContents();
  const opened = outcomes.filter((outcome) => outcome.endsWith('opens')).length;
  const caught = outcomes.filter((outcome) => outcome.endsWith('caught')).length;
  expect({ opened, caught }).toEqual({ opened: 2, caught: 1 });
  await expect(page.locator('#caught-probability')).toHaveText(`${caught}/3 = ${((caught / 3) * 100).toFixed(1)}%`);
  await expect(page.locator('#repeated-soundness')).toContainText(((opened / 3) ** 219).toExponential(2));

  await page.getByRole('button', { name: 'Change one signature byte' }).click();
  await expect(page.locator('#ship-result')).toHaveAttribute('data-tone', 'fail');
  await expect(page.locator('#ship-result')).toContainText('Changed signature rejected');

  await page.reload();
  await expect(page.locator('#ship-kat-badge')).toHaveAttribute('data-state', 'pass', { timeout: 30_000 });
  const shipMessage = page.locator('#ship-message');
  await shipMessage.evaluate((input: HTMLTextAreaElement) => input.dispatchEvent(new Event('input', { bubbles: true })));
  await expect(page.locator('#ship-result')).toHaveAttribute('data-tone', 'pass');
  await shipMessage.fill('changed message');
  await expect(page.locator('#ship-result')).toHaveAttribute('data-tone', 'idle');
  await expect(page.locator('#ship-result')).toContainText('Previous verdict retired');

  await page.getByRole('tab', { name: 'Hypericum' }).click();
  await expect(page.locator('#hyper-kat-badge')).toHaveAttribute('data-state', 'pass', { timeout: 120_000 });
  const message = await page.locator('#hyper-message').inputValue();
  await expect(page.locator('#hash-output')).toHaveText(expectedTeachingRoot(message));
  await expect(page.locator('[data-negative-claim="hash-reduction"]')).toBeVisible();
  await page.getByRole('button', { name: 'Change one signature byte' }).click();
  await expect(page.locator('#hyper-result')).toHaveAttribute('data-tone', 'fail');
  await expect(page.locator('#hyper-result')).toContainText('Changed signature rejected');

  await page.getByRole('tab', { name: 'The Mirror' }).click();
  await expect(page.getByText('7,856 B', { exact: true })).toBeVisible();
  await expect(page.getByText('9,772 B', { exact: true })).toBeVisible();
  await expect(page.getByText('805,868 B', { exact: true })).toBeVisible();
  await page.getByText('Sources and scope').click();
  const noticeLink = page.getByRole('link', { name: 'BSD-2 attribution for the compiled reference code' });
  await expect(noticeLink).toHaveAttribute('href', './THIRD_PARTY_NOTICES.txt');
  const noticeResponse = await page.request.get(new URL('./THIRD_PARTY_NOTICES.txt', page.url()).href);
  expect(noticeResponse.ok()).toBe(true);
  expect(await noticeResponse.text()).toContain('Copyright (c) 2023, QApp');
});