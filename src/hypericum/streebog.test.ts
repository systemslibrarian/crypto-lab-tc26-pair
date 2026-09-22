import { describe, expect, it } from 'vitest';

import { streebogHex } from './streebog';

const EMPTY = new Uint8Array();

describe('Streebog hash slot', () => {
  it('matches the GOST R 34.11-2012 Streebog-256 empty-message vector', () => {
    expect(streebogHex(EMPTY, 256)).toBe(
      '3f539a213e97c802cc229d474c6aa32a825a360b2a933a949fd925208d9ce1bb',
    );
  });

  it('matches the GOST R 34.11-2012 Streebog-512 empty-message vector', () => {
    expect(streebogHex(EMPTY, 512)).toBe(
      '8e945da209aa869f0455928529bcae4679e9873ab707b55315f56ceb98bef0a7362f715528356ee83cda5f2aac4c6ad2ba3a715c1bcd81cb8e9f90bf4c1c1a8a',
    );
  });
});