import { bytesToHex } from './hypericum/streebog';

export const HYPERICUM_KAT = {
  file: 'fixtures/hypericum-m-128-20.bin',
  message: 'Example of Hypericum signature for parameter set m_128_20',
  publicKeySha256: 'f591e16a03af3e45463f2ea63754400a202563e306e6f70a64f8d43b5274b039',
  signatureSha256: 'd4bf5798458d0738fc7a40fc7502eb43427ddf71fd426572a3a8604d03ac3b4e',
  secretKeyBytes: 128,
  publicKeyBytes: 64,
  signatureBytes: 9_772,
} as const;

export const SHIPOVNIK_KAT = {
  file: 'fixtures/shipovnik-zero-entropy.bin',
  message: 'test test test',
  publicKeySha256: 'c5f00cd65282c0508fabf52c2233ee1d9764e740a453877bb32963eea5a059d9',
  signatureSha256: '4750a3b3f94352927c866c97cd12d4c24d1fa85acf1c602a948d13bf3f9b56c4',
  secretKeyBytes: 362,
  publicKeyBytes: 181,
  signatureBytes: 805_868,
} as const;

export interface ReferenceFixture {
  message: Uint8Array;
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  signature: Uint8Array;
}

function parseFixture(
  bytes: Uint8Array,
  metadata: {
    message: string;
    secretKeyBytes: number;
    publicKeyBytes: number;
    signatureBytes: number;
  },
  trailingNull: boolean,
): ReferenceFixture {
  const expectedLength = metadata.secretKeyBytes + metadata.publicKeyBytes + metadata.signatureBytes;
  if (bytes.length !== expectedLength) {
    throw new Error(`Reference fixture has ${bytes.length} bytes; expected ${expectedLength}`);
  }
  const publicKeyOffset = metadata.secretKeyBytes;
  const signatureOffset = publicKeyOffset + metadata.publicKeyBytes;
  const encodedMessage = new TextEncoder().encode(metadata.message);
  return {
    secretKey: bytes.slice(0, publicKeyOffset),
    publicKey: bytes.slice(publicKeyOffset, signatureOffset),
    signature: bytes.slice(signatureOffset),
    message: trailingNull
      ? Uint8Array.from([...encodedMessage, 0])
      : encodedMessage,
  };
}

export function parseHypericumFixture(bytes: Uint8Array): ReferenceFixture {
  return parseFixture(bytes, HYPERICUM_KAT, true);
}

export function parseShipovnikFixture(bytes: Uint8Array): ReferenceFixture {
  return parseFixture(bytes, SHIPOVNIK_KAT, false);
}

export async function sha256Hex(value: Uint8Array): Promise<string> {
  const owned = new Uint8Array(value.length);
  owned.set(value);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', owned.buffer)));
}

async function loadFixture(path: string): Promise<Uint8Array> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Could not load ${path}: HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadHypericumFixture(): Promise<ReferenceFixture> {
  return parseHypericumFixture(await loadFixture(HYPERICUM_KAT.file));
}

export async function loadShipovnikFixture(): Promise<ReferenceFixture> {
  return parseShipovnikFixture(await loadFixture(SHIPOVNIK_KAT.file));
}