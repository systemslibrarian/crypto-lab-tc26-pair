import { describe, expect, it } from 'vitest';

import {
  createSternTranscript,
  deriveFiatShamirChallenge,
  hammingWeight,
  syndrome,
  TEACHING_INSTANCE,
  TEACHING_SECRET,
  verifySternOpening,
  type Bit,
  type SternChallenge,
} from './stern';

const MASK: Bit[] = [1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1];
const PERMUTATION = [4, 9, 1, 7, 3, 11, 0, 8, 5, 2, 10, 6];

describe('reduced Stern identification round', () => {
  it.each([0, 1, 2] satisfies SternChallenge[])('accepts an honest challenge %i opening', (challenge) => {
    const transcript = createSternTranscript(
      TEACHING_INSTANCE,
      TEACHING_SECRET,
      MASK,
      PERMUTATION,
    );

    expect(verifySternOpening(
      TEACHING_INSTANCE,
      transcript.commitments,
      transcript.openings[challenge],
    )).toBe(true);
  });

  it('has a witness that is a low-weight vector, not a codeword', () => {
    // A codeword satisfies H*c = 0 by definition of the parity-check matrix, so
    // the thing proved here cannot be a codeword: the public syndrome is H
    // times the witness and it is non-zero. This is the syndrome-decoding
    // witness -- fixed weight, prescribed syndrome -- and the page and README
    // say vector for that reason.
    expect(hammingWeight(TEACHING_SECRET)).toBe(TEACHING_INSTANCE.weight);
    expect(TEACHING_INSTANCE.syndrome).toEqual(syndrome(TEACHING_INSTANCE.matrix, TEACHING_SECRET));
    expect(hammingWeight(TEACHING_INSTANCE.syndrome)).toBeGreaterThan(0);
  });

  it('catches a prover with a weight-correct vector that has the wrong public syndrome', () => {
    const fakeSecret: Bit[] = [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0];
    const transcript = createSternTranscript(
      TEACHING_INSTANCE,
      fakeSecret,
      MASK,
      PERMUTATION,
    );

    expect([0, 1, 2].map((challenge) => verifySternOpening(
      TEACHING_INSTANCE,
      transcript.commitments,
      transcript.openings[challenge as SternChallenge],
    ))).toEqual([true, false, true]);
  });

  it('rejects a tampered response', () => {
    const transcript = createSternTranscript(
      TEACHING_INSTANCE,
      TEACHING_SECRET,
      MASK,
      PERMUTATION,
    );
    const opening = transcript.openings[0];
    opening.mask[0] = opening.mask[0] === 0 ? 1 : 0;

    expect(verifySternOpening(TEACHING_INSTANCE, transcript.commitments, opening)).toBe(false);
  });

  it('derives a stable three-way Fiat-Shamir challenge from the message and commitments', () => {
    const transcript = createSternTranscript(
      TEACHING_INSTANCE,
      TEACHING_SECRET,
      MASK,
      PERMUTATION,
    );

    const challenge = deriveFiatShamirChallenge('TC26 teaching transcript', transcript.commitments);
    expect([0, 1, 2]).toContain(challenge);
    expect(deriveFiatShamirChallenge('TC26 teaching transcript', transcript.commitments)).toBe(challenge);
  });
});