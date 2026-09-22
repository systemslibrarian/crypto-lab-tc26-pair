import { streebog256, streebog512 } from '@li0ard/streebog';

export type StreebogVariant = 256 | 512;

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export function streebogDigest(input: Uint8Array, variant: StreebogVariant): Uint8Array {
  return variant === 256 ? streebog256(input) : streebog512(input);
}

export function streebogHex(input: Uint8Array, variant: StreebogVariant): string {
  return bytesToHex(streebogDigest(input, variant));
}