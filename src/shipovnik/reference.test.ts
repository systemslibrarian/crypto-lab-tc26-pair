import { describe, expect, it } from 'vitest';

import { sha256Hex } from '../fixtures';
import {
  createShipovnikKeyPair,
  SHIPOVNIK_PARAMETERS,
  signShipovnik,
  verifyShipovnik,
} from './reference';

describe('QApp Shipovnik WebAssembly reference', () => {
  it('matches the deterministic zero-entropy fixture and rejects a changed signature', async () => {
    const message = new TextEncoder().encode('test test test');
    const keyPair = await createShipovnikKeyPair(
      new Uint8Array(SHIPOVNIK_PARAMETERS.keyPairEntropyBytes),
    );
    const signature = await signShipovnik(
      keyPair.secretKey,
      message,
      new Uint8Array(SHIPOVNIK_PARAMETERS.signEntropyBytes),
    );

    expect(signature).toHaveLength(805_868);
    await expect(sha256Hex(keyPair.publicKey)).resolves.toBe(
      'c5f00cd65282c0508fabf52c2233ee1d9764e740a453877bb32963eea5a059d9',
    );
    await expect(sha256Hex(signature)).resolves.toBe(
      '4750a3b3f94352927c866c97cd12d4c24d1fa85acf1c602a948d13bf3f9b56c4',
    );
    await expect(verifyShipovnik(keyPair.publicKey, message, signature)).resolves.toBe(true);

    const tampered = signature.slice();
    tampered[42_048] ^= 1;
    await expect(verifyShipovnik(keyPair.publicKey, message, tampered)).resolves.toBe(false);
  }, 30_000);
});