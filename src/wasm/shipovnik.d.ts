export interface ShipovnikModule {
  HEAPU8: Uint8Array;
  _malloc(size: number): number;
  _free(pointer: number): void;
  _tc26_shipovnik_public_key_bytes(): number;
  _tc26_shipovnik_secret_key_bytes(): number;
  _tc26_shipovnik_signature_max_bytes(): number;
  _tc26_shipovnik_keypair_entropy_bytes(): number;
  _tc26_shipovnik_sign_entropy_bytes(): number;
  _tc26_shipovnik_keypair(
    entropy: number,
    entropyLength: number,
    secretKey: number,
    publicKey: number,
  ): number;
  _tc26_shipovnik_sign(
    entropy: number,
    entropyLength: number,
    secretKey: number,
    message: number,
    messageLength: number,
    signature: number,
  ): number;
  _tc26_shipovnik_verify(
    publicKey: number,
    signature: number,
    message: number,
    messageLength: number,
  ): number;
}

export default function createShipovnikModule(): Promise<ShipovnikModule>;