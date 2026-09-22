export interface HypericumModule {
  HEAPU8: Uint8Array;
  _malloc(size: number): number;
  _free(pointer: number): void;
  _tc26_hypericum_public_key_bytes(): number;
  _tc26_hypericum_secret_key_bytes(): number;
  _tc26_hypericum_signature_bytes(): number;
  _tc26_hypericum_seed_bytes(): number;
  _tc26_hypericum_seed(entropy: number): void;
  _tc26_hypericum_keypair(publicKey: number, secretKey: number): number;
  _tc26_hypericum_sign(
    secretKey: number,
    message: number,
    messageLength: number,
    signature: number,
  ): number;
  _tc26_hypericum_verify(
    publicKey: number,
    signature: number,
    message: number,
    messageLength: number,
  ): number;
}

export default function createHypericumModule(): Promise<HypericumModule>;