import { streebogHex } from '../hypericum/streebog';

export type Bit = 0 | 1;
export type SternChallenge = 0 | 1 | 2;

export interface SternInstance {
  matrix: Bit[][];
  syndrome: Bit[];
  weight: number;
}

export interface SternCommitments {
  permutationAndSyndrome: string;
  permutedMask: string;
  permutedMaskedSecret: string;
}

export type SternOpening =
  | { challenge: 0; permutation: number[]; mask: Bit[] }
  | { challenge: 1; permutation: number[]; maskedSecret: Bit[] }
  | { challenge: 2; permutedMask: Bit[]; permutedSecret: Bit[] };

export interface SternOpenings {
  0: Extract<SternOpening, { challenge: 0 }>;
  1: Extract<SternOpening, { challenge: 1 }>;
  2: Extract<SternOpening, { challenge: 2 }>;
}

export interface SternTranscript {
  commitments: SternCommitments;
  openings: SternOpenings;
}

const encoder = new TextEncoder();

function isBit(value: number): value is Bit {
  return value === 0 || value === 1;
}

function validVector(value: readonly number[], length: number): value is Bit[] {
  return value.length === length && value.every(isBit);
}

function validPermutation(permutation: readonly number[], length: number): boolean {
  return permutation.length === length
    && permutation.every((value) => Number.isInteger(value) && value >= 0 && value < length)
    && new Set(permutation).size === length;
}

function encodeParts(label: string, parts: readonly (readonly number[])[]): Uint8Array {
  const values: number[] = [...encoder.encode(label), 0];
  for (const part of parts) {
    values.push((part.length >>> 8) & 0xff, part.length & 0xff, ...part);
  }
  return Uint8Array.from(values);
}

function commit(label: string, ...parts: readonly number[][]): string {
  return streebogHex(encodeParts(label, parts), 512);
}

export function xorBits(left: readonly Bit[], right: readonly Bit[]): Bit[] {
  if (left.length !== right.length) {
    throw new RangeError('Bit vectors must have equal length');
  }
  return left.map((value, index) => (value ^ right[index]) as Bit);
}

export function hammingWeight(vector: readonly Bit[]): number {
  return vector.reduce<number>((weight, value) => weight + value, 0);
}

export function syndrome(matrix: readonly Bit[][], vector: readonly Bit[]): Bit[] {
  if (matrix.length === 0 || matrix.some((row) => row.length !== vector.length)) {
    throw new RangeError('Parity-check matrix dimensions do not match the vector');
  }
  return matrix.map((row) => row.reduce<number>(
    (sum, value, index) => sum ^ (value & vector[index]),
    0,
  ) as Bit);
}

export function permute(vector: readonly Bit[], permutation: readonly number[]): Bit[] {
  if (!validPermutation(permutation, vector.length)) {
    throw new RangeError('Invalid permutation');
  }
  return permutation.map((sourceIndex) => vector[sourceIndex]);
}

export function createSternTranscript(
  instance: SternInstance,
  secret: readonly Bit[],
  mask: readonly Bit[],
  permutation: readonly number[],
): SternTranscript {
  const length = instance.matrix[0]?.length ?? 0;
  if (!validVector(secret, length) || !validVector(mask, length)) {
    throw new RangeError('Secret and mask must be binary vectors matching the code length');
  }
  if (!validPermutation(permutation, length)) {
    throw new RangeError('Permutation must contain every code position exactly once');
  }

  const maskedSecret = xorBits(mask, secret);
  const permutedMask = permute(mask, permutation);
  const permutedSecret = permute(secret, permutation);
  const commitments: SternCommitments = {
    permutationAndSyndrome: commit('stern-c0', [...permutation], syndrome(instance.matrix, mask)),
    permutedMask: commit('stern-c1', permutedMask),
    permutedMaskedSecret: commit('stern-c2', xorBits(permutedMask, permutedSecret)),
  };

  return {
    commitments,
    openings: {
      0: { challenge: 0, permutation: [...permutation], mask: [...mask] },
      1: { challenge: 1, permutation: [...permutation], maskedSecret },
      2: { challenge: 2, permutedMask, permutedSecret },
    },
  };
}

export function verifySternOpening(
  instance: SternInstance,
  commitments: SternCommitments,
  opening: SternOpening,
): boolean {
  const length = instance.matrix[0]?.length ?? 0;
  if (length === 0 || !validVector(instance.syndrome, instance.matrix.length)) {
    return false;
  }

  if (opening.challenge === 0) {
    if (!validPermutation(opening.permutation, length) || !validVector(opening.mask, length)) {
      return false;
    }
    return commitments.permutationAndSyndrome
        === commit('stern-c0', opening.permutation, syndrome(instance.matrix, opening.mask))
      && commitments.permutedMask
        === commit('stern-c1', permute(opening.mask, opening.permutation));
  }

  if (opening.challenge === 1) {
    if (!validPermutation(opening.permutation, length) || !validVector(opening.maskedSecret, length)) {
      return false;
    }
    const recoveredMaskSyndrome = xorBits(
      syndrome(instance.matrix, opening.maskedSecret),
      instance.syndrome,
    );
    return commitments.permutationAndSyndrome
        === commit('stern-c0', opening.permutation, recoveredMaskSyndrome)
      && commitments.permutedMaskedSecret
        === commit('stern-c2', permute(opening.maskedSecret, opening.permutation));
  }

  if (!validVector(opening.permutedMask, length)
      || !validVector(opening.permutedSecret, length)
      || hammingWeight(opening.permutedSecret) !== instance.weight) {
    return false;
  }
  return commitments.permutedMask === commit('stern-c1', opening.permutedMask)
    && commitments.permutedMaskedSecret
      === commit('stern-c2', xorBits(opening.permutedMask, opening.permutedSecret));
}

export function deriveFiatShamirChallenge(
  message: string,
  commitments: SternCommitments,
): SternChallenge {
  const digest = streebogHex(
    encoder.encode(`${message}\u0000${commitments.permutationAndSyndrome}${commitments.permutedMask}${commitments.permutedMaskedSecret}`),
    512,
  );
  for (let offset = 0; offset < digest.length; offset += 2) {
    const value = Number.parseInt(digest.slice(offset, offset + 2), 16);
    if (value < 255) {
      return (value % 3) as SternChallenge;
    }
  }
  throw new Error('Streebog digest did not contain a usable challenge byte');
}

export const TEACHING_MATRIX: Bit[][] = [
  [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1],
  [0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1],
  [1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1],
  [0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 1, 0],
  [1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0],
  [0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 0],
];

export const TEACHING_SECRET: Bit[] = [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0];

export const TEACHING_INSTANCE: SternInstance = {
  matrix: TEACHING_MATRIX,
  syndrome: syndrome(TEACHING_MATRIX, TEACHING_SECRET),
  weight: hammingWeight(TEACHING_SECRET),
};