import createShipovnikModule, { type ShipovnikModule } from '../wasm/shipovnik.js';

export const SHIPOVNIK_PARAMETERS = {
  codeLength: 2_896,
  codeDimension: 1_448,
  secretWeight: 318,
  repetitions: 219,
  publicKeyBytes: 181,
  secretKeyBytes: 362,
  signatureMaxBytes: 1_072_662,
  keyPairEntropyBytes: 11_584,
  signEntropyBytes: 2_616_174,
} as const;

export interface ShipovnikKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

let modulePromise: Promise<ShipovnikModule> | undefined;

function loadModule(): Promise<ShipovnikModule> {
  modulePromise ??= createShipovnikModule().then((module) => {
    const actual = [
      module._tc26_shipovnik_public_key_bytes(),
      module._tc26_shipovnik_secret_key_bytes(),
      module._tc26_shipovnik_signature_max_bytes(),
      module._tc26_shipovnik_keypair_entropy_bytes(),
      module._tc26_shipovnik_sign_entropy_bytes(),
    ];
    const expected = [
      SHIPOVNIK_PARAMETERS.publicKeyBytes,
      SHIPOVNIK_PARAMETERS.secretKeyBytes,
      SHIPOVNIK_PARAMETERS.signatureMaxBytes,
      SHIPOVNIK_PARAMETERS.keyPairEntropyBytes,
      SHIPOVNIK_PARAMETERS.signEntropyBytes,
    ];
    if (actual.some((value, index) => value !== expected[index])) {
      throw new Error(`Shipovnik WASM ABI mismatch: ${actual.join('/')}`);
    }
    return module;
  });
  return modulePromise;
}

function assertLength(value: Uint8Array, length: number, label: string): void {
  if (value.length !== length) {
    throw new RangeError(`${label} must contain exactly ${length} bytes`);
  }
}

function allocate(module: ShipovnikModule, length: number): number {
  const pointer = module._malloc(Math.max(1, length));
  if (pointer === 0) {
    throw new Error(`Shipovnik WASM could not allocate ${length} bytes`);
  }
  return pointer;
}

function write(module: ShipovnikModule, pointer: number, value: Uint8Array): void {
  module.HEAPU8.set(value, pointer);
}

function read(module: ShipovnikModule, pointer: number, length: number): Uint8Array {
  return module.HEAPU8.slice(pointer, pointer + length);
}

export async function createShipovnikKeyPair(entropy: Uint8Array): Promise<ShipovnikKeyPair> {
  assertLength(entropy, SHIPOVNIK_PARAMETERS.keyPairEntropyBytes, 'Shipovnik key entropy');
  const module = await loadModule();
  const entropyPointer = allocate(module, entropy.length);
  const publicKeyPointer = allocate(module, SHIPOVNIK_PARAMETERS.publicKeyBytes);
  const secretKeyPointer = allocate(module, SHIPOVNIK_PARAMETERS.secretKeyBytes);
  try {
    write(module, entropyPointer, entropy);
    const result = module._tc26_shipovnik_keypair(
      entropyPointer,
      entropy.length,
      secretKeyPointer,
      publicKeyPointer,
    );
    if (result !== 0) {
      throw new Error('Shipovnik key generation exhausted its entropy input');
    }
    return {
      publicKey: read(module, publicKeyPointer, SHIPOVNIK_PARAMETERS.publicKeyBytes),
      secretKey: read(module, secretKeyPointer, SHIPOVNIK_PARAMETERS.secretKeyBytes),
    };
  } finally {
    module._free(entropyPointer);
    module._free(publicKeyPointer);
    module._free(secretKeyPointer);
  }
}

export async function signShipovnik(
  secretKey: Uint8Array,
  message: Uint8Array,
  entropy: Uint8Array,
): Promise<Uint8Array> {
  assertLength(secretKey, SHIPOVNIK_PARAMETERS.secretKeyBytes, 'Shipovnik secret key');
  assertLength(entropy, SHIPOVNIK_PARAMETERS.signEntropyBytes, 'Shipovnik signing entropy');
  const module = await loadModule();
  const entropyPointer = allocate(module, entropy.length);
  const secretKeyPointer = allocate(module, secretKey.length);
  const messagePointer = allocate(module, message.length);
  const signaturePointer = allocate(module, SHIPOVNIK_PARAMETERS.signatureMaxBytes);
  try {
    write(module, entropyPointer, entropy);
    write(module, secretKeyPointer, secretKey);
    write(module, messagePointer, message);
    const signatureLength = module._tc26_shipovnik_sign(
      entropyPointer,
      entropy.length,
      secretKeyPointer,
      messagePointer,
      message.length,
      signaturePointer,
    );
    if (signatureLength < 0 || signatureLength > SHIPOVNIK_PARAMETERS.signatureMaxBytes) {
      throw new Error('Shipovnik signing failed or returned an invalid length');
    }
    return read(module, signaturePointer, signatureLength);
  } finally {
    module._free(entropyPointer);
    module._free(secretKeyPointer);
    module._free(messagePointer);
    module._free(signaturePointer);
  }
}

export async function verifyShipovnik(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  assertLength(publicKey, SHIPOVNIK_PARAMETERS.publicKeyBytes, 'Shipovnik public key');
  if (signature.length === 0 || signature.length > SHIPOVNIK_PARAMETERS.signatureMaxBytes) {
    return false;
  }
  const module = await loadModule();
  const publicKeyPointer = allocate(module, publicKey.length);
  const messagePointer = allocate(module, message.length);
  const signaturePointer = allocate(module, SHIPOVNIK_PARAMETERS.signatureMaxBytes);
  try {
    module.HEAPU8.fill(
      0,
      signaturePointer,
      signaturePointer + SHIPOVNIK_PARAMETERS.signatureMaxBytes,
    );
    write(module, publicKeyPointer, publicKey);
    write(module, messagePointer, message);
    write(module, signaturePointer, signature);
    return module._tc26_shipovnik_verify(
      publicKeyPointer,
      signaturePointer,
      messagePointer,
      message.length,
    ) === 0;
  } finally {
    module._free(publicKeyPointer);
    module._free(messagePointer);
    module._free(signaturePointer);
  }
}

export function secureRandomBytes(length: number): Uint8Array {
  const output = new Uint8Array(length);
  for (let offset = 0; offset < output.length; offset += 65_536) {
    crypto.getRandomValues(output.subarray(offset, Math.min(offset + 65_536, output.length)));
  }
  return output;
}