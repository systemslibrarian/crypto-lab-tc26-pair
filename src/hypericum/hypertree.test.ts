import { describe, expect, it } from 'vitest';

import {
  buildTeachingHypertree,
  hashParent,
  verifyTeachingHypertree,
  type Streebog256,
} from './hypertree';
import { streebogDigest } from './streebog';

const MESSAGE = 'National primitives, shared post-quantum structure';
const EXPECTED_ROOT = '9f1e0b3910c9afe759815de80d98f59116393210f6c35c50ea80577fdb398b38';

describe('Hypericum Streebog teaching slice', () => {
  it('matches its pinned root', () => {
    expect(buildTeachingHypertree(MESSAGE).root.digestHex).toBe(EXPECTED_ROOT);
    expect(verifyTeachingHypertree(MESSAGE, EXPECTED_ROOT)).toBe(true);
  });

  it('fails when the first Merkle edge is rewired', () => {
    const tree = buildTeachingHypertree(MESSAGE);
    const rewired = hashParent(tree.leaves[1], tree.leaves[0], 1, 0);
    expect(rewired.digestHex).not.toBe(tree.parents[0].digestHex);
  });

  it('fails when the Streebog slot is perturbed', () => {
    const perturbed: Streebog256 = (input) => {
      const output = streebogDigest(input, 256);
      output[0] ^= 1;
      return output;
    };
    expect(verifyTeachingHypertree(MESSAGE, EXPECTED_ROOT, perturbed)).toBe(false);
  });
});