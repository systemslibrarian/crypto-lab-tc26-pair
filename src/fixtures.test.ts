import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  HYPERICUM_KAT,
  parseHypericumFixture,
  parseShipovnikFixture,
  sha256Hex,
  SHIPOVNIK_KAT,
} from './fixtures';

const hypericumBytes = new Uint8Array(readFileSync(
  new URL('../public/fixtures/hypericum-m-128-20.bin', import.meta.url),
));
const shipovnikBytes = new Uint8Array(readFileSync(
  new URL('../public/fixtures/shipovnik-zero-entropy.bin', import.meta.url),
));

describe('pinned QApp fixture files', () => {
  it('parses and fingerprints the complete Hypericum fixture', async () => {
    const fixture = parseHypericumFixture(hypericumBytes);
    expect(fixture.secretKey).toHaveLength(HYPERICUM_KAT.secretKeyBytes);
    expect(fixture.publicKey).toHaveLength(HYPERICUM_KAT.publicKeyBytes);
    expect(fixture.signature).toHaveLength(HYPERICUM_KAT.signatureBytes);
    await expect(sha256Hex(fixture.publicKey)).resolves.toBe(HYPERICUM_KAT.publicKeySha256);
    await expect(sha256Hex(fixture.signature)).resolves.toBe(HYPERICUM_KAT.signatureSha256);
  });

  it('parses and fingerprints the complete Shipovnik fixture', async () => {
    const fixture = parseShipovnikFixture(shipovnikBytes);
    expect(fixture.secretKey).toHaveLength(SHIPOVNIK_KAT.secretKeyBytes);
    expect(fixture.publicKey).toHaveLength(SHIPOVNIK_KAT.publicKeyBytes);
    expect(fixture.signature).toHaveLength(SHIPOVNIK_KAT.signatureBytes);
    await expect(sha256Hex(fixture.publicKey)).resolves.toBe(SHIPOVNIK_KAT.publicKeySha256);
    await expect(sha256Hex(fixture.signature)).resolves.toBe(SHIPOVNIK_KAT.signatureSha256);
  });

  it('rejects truncated artifacts before they reach a C verifier', () => {
    expect(() => parseHypericumFixture(hypericumBytes.subarray(1))).toThrow(/expected/);
    expect(() => parseShipovnikFixture(shipovnikBytes.subarray(0, -1))).toThrow(/expected/);
  });
});