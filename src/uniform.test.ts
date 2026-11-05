import { describe, expect, it } from 'vitest';

import { DRAW_RANGE, randomPermutation, rejectionLimit, uniformBelow, type Uint32Source } from './uniform';

/**
 * A source that hands out exactly the values it was given, counts the draws, and
 * THROWS when it runs dry. Repeating its last value would make a wrong bound spin
 * forever instead of failing, which is how a boundary test stops being one.
 */
function scripted(values: readonly number[]): { source: Uint32Source; draws: () => number } {
  let index = 0;
  return {
    source: (out) => {
      if (index >= values.length) throw new Error(`the scripted source ran dry after ${index} draws`);
      out[0] = values[index];
      if (out[0] !== values[index]) throw new Error(`${values[index]} does not fit a 32-bit draw`);
      index += 1;
    },
    draws: () => index,
  };
}

/** Derived here by a different route than the code's: floor division, not remainder. */
function expectedLimit(bound: number): number {
  return Math.floor(DRAW_RANGE / bound) * bound;
}

describe('uniform draws for the Stern permutation', () => {
  it('accepts exactly a whole number of copies of the bound, so every residue has equal pre-images', () => {
    // This IS the uniformity argument, asserted rather than sampled: an accepted
    // range that is an exact multiple of the bound gives each residue the same
    // count, and the rejected tail is smaller than one more copy of the bound.
    for (const bound of [1, 2, 3, 5, 6, 7, 11, 12, 255, 1000, 0xffff_ffff, DRAW_RANGE]) {
      const limit = rejectionLimit(bound);
      expect(limit).toBe(expectedLimit(bound));
      expect(limit % bound).toBe(0);
      expect(limit / bound).toBe(Math.floor(DRAW_RANGE / bound));
      expect(DRAW_RANGE - limit).toBeLessThan(bound);
    }
  });

  it('spends a draw on a value at the limit, and returns the next one below it', () => {
    const bound = 12;
    const limit = expectedLimit(bound);
    expect(limit).toBe(4_294_967_292);
    const { source, draws } = scripted([limit, limit + 3, 25]);
    expect(uniformBelow(bound, source)).toBe(1);
    expect(draws()).toBe(3);
  });

  it('accepts the value immediately below the limit, on the first draw', () => {
    const bound = 12;
    const { source, draws } = scripted([expectedLimit(bound) - 1]);
    expect(uniformBelow(bound, source)).toBe(11);
    expect(draws()).toBe(1);
  });

  it('maps a contiguous block of accepted draws onto each residue equally often', () => {
    const bound = 5;
    const counts = new Array<number>(bound).fill(0);
    for (let value = 0; value < bound * 400; value += 1) {
      counts[uniformBelow(bound, scripted([value]).source)] += 1;
    }
    expect(counts).toEqual([400, 400, 400, 400, 400]);
  });

  it('refuses a bound it cannot draw uniformly', () => {
    for (const bound of [0, -1, 1.5, Number.NaN, DRAW_RANGE + 1]) {
      expect(() => uniformBelow(bound, scripted([0]).source)).toThrow(/bound must be an integer/);
    }
  });

  it('shuffles with one accepted draw per swap, and returns a permutation', () => {
    // Fisher-Yates over length 4 makes three swaps, with bounds 4, 3 and 2. With
    // every draw 0 the expected result is derived by hand, not read back from a
    // run: [0,1,2,3] -> swap 3,0 -> [3,1,2,0] -> swap 2,0 -> [2,1,3,0] ->
    // swap 1,0 -> [1,2,3,0].
    const { source, draws } = scripted([0, 0, 0]);
    expect(randomPermutation(4, source)).toEqual([1, 2, 3, 0]);
    expect(draws()).toBe(3);

    const identity = scripted([3, 2, 1]);
    expect(randomPermutation(4, identity.source)).toEqual([0, 1, 2, 3]);

    // And over every scripted draw it stays a permutation of 0..11, the length
    // this exhibit actually uses.
    for (let seed = 0; seed < 50; seed += 1) {
      const values = Array.from({ length: 11 }, (_, step) => (seed * 7 + step * 13) >>> 0);
      const permutation = randomPermutation(12, scripted(values).source);
      expect([...permutation].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    }
  });
});
