import { describe, expect, it } from 'vitest';

import { sha256Hex } from '../fixtures';
import { bytesToHex } from './streebog';
import { createHypericumFixture, verifyHypericum } from './reference';

const encoder = new TextEncoder();
const REFERENCE_MESSAGE = Uint8Array.from([
  ...encoder.encode('Example of Hypericum signature for parameter set m_128_20'),
  0,
]);
const REFERENCE_ENTROPY = Uint8Array.from({ length: 32 }, (_, index) => index);
const REFERENCE_PUBLIC_KEY =
  'c76fde5cf91111b593abf833f7ef1047b5163550ca292ec778dbddb9ca05b28d'
  + '0edadfb42039a46a8d25043fed53bdd52442f6ef16a974b1509db10db9aeaafc';
const REFERENCE_SIGNATURE_PREFIX =
  '45d6fd0e5cd9f36a37140f16ae59f28ef004aff8de177236f643445b6bad9b70'
  + '000009ab';

describe('QApp Hypericum m_128_20 WebAssembly reference', () => {
  it('matches the deterministic example and rejects a changed signature', async () => {
    const fixture = await createHypericumFixture(REFERENCE_MESSAGE, REFERENCE_ENTROPY);

    expect(bytesToHex(fixture.publicKey)).toBe(REFERENCE_PUBLIC_KEY);
    expect(bytesToHex(fixture.signature.slice(0, 36))).toBe(REFERENCE_SIGNATURE_PREFIX);
    await expect(sha256Hex(fixture.signature)).resolves.toBe(
      'd4bf5798458d0738fc7a40fc7502eb43427ddf71fd426572a3a8604d03ac3b4e',
    );
    await expect(verifyHypericum(
      fixture.publicKey,
      REFERENCE_MESSAGE,
      fixture.signature,
    )).resolves.toBe(true);

    const tampered = fixture.signature.slice();
    tampered[48] ^= 1;
    await expect(verifyHypericum(fixture.publicKey, REFERENCE_MESSAGE, tampered)).resolves.toBe(false);
  }, 120_000);
});