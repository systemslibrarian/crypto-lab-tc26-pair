import createHypericumModule, { type HypericumModule } from '../wasm/hypericum.js';

export const HYPERICUM_M12820 = {
  name: 'm_128_20',
  publicKeyBytes: 64,
  secretKeyBytes: 128,
  signatureBytes: 9_772,
  seedBytes: 32,
  hypertreeHeight: 20,
  layers: 2,
  forsTreeHeight: 11,
  forsTrees: 13,
  winternitz: 16,
} as const;

export interface HypericumKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface HypericumSignedFixture extends HypericumKeyPair {
  signature: Uint8Array;
}

let modulePromise: Promise<HypericumModule> | undefined;

function loadModule(): Promise<HypericumModule> {
  modulePromise ??= createHypericumModule().then((module) => {
    const actual = [
      module._tc26_hypericum_public_key_bytes(),
      module._tc26_hypericum_secret_key_bytes(),
      module._tc26_hypericum_signature_bytes(),
      module._tc26_hypericum_seed_bytes(),
    ];
    const expected = [
      HYPERICUM_M12820.publicKeyBytes,
      HYPERICUM_M12820.secretKeyBytes,
      HYPERICUM_M12820.signatureBytes,
      HYPERICUM_M12820.seedBytes,
    ];
    if (actual.some((value, index) => value !== expected[index])) {
      throw new Error(`Hypericum WASM ABI mismatch: ${actual.join('/')}`);
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

function allocate(module: HypericumModule, length: number): number {
  const pointer = module._malloc(Math.max(1, length));
  if (pointer === 0) {
    throw new Error(`Hypericum WASM could not allocate ${length} bytes`);
  }
  return pointer;
}

function write(module: HypericumModule, pointer: number, value: Uint8Array): void {
  module.HEAPU8.set(value, pointer);
}

function read(module: HypericumModule, pointer: number, length: number): Uint8Array {
  return module.HEAPU8.slice(pointer, pointer + length);
}

function seedModule(module: HypericumModule, entropy: Uint8Array): void {
  assertLength(entropy, HYPERICUM_M12820.seedBytes, 'Hypericum entropy');
  const entropyPointer = allocate(module, entropy.length);
  try {
    write(module, entropyPointer, entropy);
    module._tc26_hypericum_seed(entropyPointer);
  } finally {
    module._free(entropyPointer);
  }
}

function generateKeyPair(module: HypericumModule): HypericumKeyPair {
  const publicKeyPointer = allocate(module, HYPERICUM_M12820.publicKeyBytes);
  const secretKeyPointer = allocate(module, HYPERICUM_M12820.secretKeyBytes);
  try {
    const result = module._tc26_hypericum_keypair(publicKeyPointer, secretKeyPointer);
    if (result !== 0) {
      throw new Error(`Hypericum key generation failed with code ${result}`);
    }
    return {
      publicKey: read(module, publicKeyPointer, HYPERICUM_M12820.publicKeyBytes),
      secretKey: read(module, secretKeyPointer, HYPERICUM_M12820.secretKeyBytes),
    };
  } finally {
    module._free(publicKeyPointer);
    module._free(secretKeyPointer);
  }
}

function sign(module: HypericumModule, secretKey: Uint8Array, message: Uint8Array): Uint8Array {
  assertLength(secretKey, HYPERICUM_M12820.secretKeyBytes, 'Hypericum secret key');
  const secretKeyPointer = allocate(module, secretKey.length);
  const messagePointer = allocate(module, message.length);
  const signaturePointer = allocate(module, HYPERICUM_M12820.signatureBytes);
  try {
    write(module, secretKeyPointer, secretKey);
    write(module, messagePointer, message);
    const result = module._tc26_hypericum_sign(
      secretKeyPointer,
      messagePointer,
      message.length,
      signaturePointer,
    );
    if (result !== 0) {
      throw new Error(`Hypericum signing failed with code ${result}`);
    }
    return read(module, signaturePointer, HYPERICUM_M12820.signatureBytes);
  } finally {
    module._free(secretKeyPointer);
    module._free(messagePointer);
    module._free(signaturePointer);
  }
}

export async function createHypericumKeyPair(entropy: Uint8Array): Promise<HypericumKeyPair> {
  const module = await loadModule();
  seedModule(module, entropy);
  return generateKeyPair(module);
}

export async function signHypericum(
  secretKey: Uint8Array,
  message: Uint8Array,
  entropy: Uint8Array,
): Promise<Uint8Array> {
  const module = await loadModule();
  seedModule(module, entropy);
  return sign(module, secretKey, message);
}

export async function createHypericumFixture(
  message: Uint8Array,
  entropy: Uint8Array,
): Promise<HypericumSignedFixture> {
  const module = await loadModule();
  seedModule(module, entropy);
  const keyPair = generateKeyPair(module);
  return { ...keyPair, signature: sign(module, keyPair.secretKey, message) };
}

export async function verifyHypericum(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  assertLength(publicKey, HYPERICUM_M12820.publicKeyBytes, 'Hypericum public key');
  assertLength(signature, HYPERICUM_M12820.signatureBytes, 'Hypericum signature');
  const module = await loadModule();
  const publicKeyPointer = allocate(module, publicKey.length);
  const messagePointer = allocate(module, message.length);
  const signaturePointer = allocate(module, signature.length);
  try {
    write(module, publicKeyPointer, publicKey);
    write(module, messagePointer, message);
    write(module, signaturePointer, signature);
    return module._tc26_hypericum_verify(
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