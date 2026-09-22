import { describe, expect, it } from 'vitest';

import {
  createSternTranscript,
  deriveFiatShamirChallenge,
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