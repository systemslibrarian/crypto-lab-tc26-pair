/**
 * Uniform draws, by rejection, for the Stern teaching transcript.
 *
 * `randomPermutation` shuffled with `random[index] % (index + 1)` over
 * `crypto.getRandomValues(new Uint32Array(length))`, and CodeQL flagged it:
 * js/biased-cryptographic-random, high, `src/main.ts:398`, raised 2026-10-28.
 *
 * The alert is real. 2^32 is not a multiple of 3, 5, 6, 7, 9, 10, 11 or 12, so for
 * most of the swaps this shuffle makes, the low residues are reachable by one more
 * 32-bit value than the high ones. The skew is about one part in 1.4 billion and
 * nobody would see it in this page — but the permutation is this exhibit's ZERO
 * KNOWLEDGE: it is the blinding that hides the witness in the two branches the
 * verifier does not open. A lab that teaches why that permutation must be uniform
 * should not sample it with a construction that is only nearly uniform, and
 * "nearly" here is an argument about magnitudes rather than a property.
 *
 * Rejection makes it a property. The accepted range is an exact multiple of the
 * bound, so every residue has exactly the same number of pre-images, for every
 * bound rather than for the lucky ones.
 */

/** The number of distinct values one 32-bit draw can take. */
export const DRAW_RANGE = 0x1_0000_0000;

/** Fills `out` with cryptographically random 32-bit values. */
export type Uint32Source = (out: Uint32Array<ArrayBuffer>) => void;

export const cryptoUint32Source: Uint32Source = (out) => {
  crypto.getRandomValues(out);
};

/**
 * The largest multiple of `bound` that fits in one 32-bit draw. Draws at or above
 * it are the tail that would make the low residues likelier, so they are rejected
 * and re-drawn.
 */
export function rejectionLimit(bound: number): number {
  return DRAW_RANGE - (DRAW_RANGE % bound);
}

/** A uniform integer in [0, bound), with no modulo bias for any bound in range. */
export function uniformBelow(bound: number, source: Uint32Source = cryptoUint32Source): number {
  if (!Number.isInteger(bound) || bound < 1 || bound > DRAW_RANGE) {
    throw new RangeError(`bound must be an integer in [1, ${DRAW_RANGE}]`);
  }
  const limit = rejectionLimit(bound);
  const draw = new Uint32Array(1) as Uint32Array<ArrayBuffer>;
  for (;;) {
    source(draw);
    if (draw[0] < limit) return draw[0] % bound;
  }
}

/** A uniformly random permutation of [0, length), by Fisher-Yates. */
export function randomPermutation(length: number, source: Uint32Source = cryptoUint32Source): number[] {
  const permutation = Array.from({ length }, (_, index) => index);
  for (let index = length - 1; index > 0; index -= 1) {
    const swapIndex = uniformBelow(index + 1, source);
    [permutation[index], permutation[swapIndex]] = [permutation[swapIndex], permutation[index]];
  }
  return permutation;
}
