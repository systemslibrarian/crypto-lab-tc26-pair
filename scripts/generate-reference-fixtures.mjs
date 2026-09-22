import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import createHypericumModule from '../src/wasm/hypericum.js';
import createShipovnikModule from '../src/wasm/shipovnik.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDirectory = resolve(root, 'public/fixtures');
const encoder = new TextEncoder();

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hex = (bytes) => Buffer.from(bytes).toString('hex');

function allocate(module, length) {
  const pointer = module._malloc(Math.max(1, length));
  if (pointer === 0) throw new Error(`WASM allocation failed for ${length} bytes`);
  return pointer;
}

async function generateHypericum() {
  const module = await createHypericumModule();
  const message = Uint8Array.from([
    ...encoder.encode('Example of Hypericum signature for parameter set m_128_20'),
    0,
  ]);
  const entropy = Uint8Array.from({ length: 32 }, (_, index) => index);
  const entropyPointer = allocate(module, entropy.length);
  const publicKeyPointer = allocate(module, 64);
  const secretKeyPointer = allocate(module, 128);
  const messagePointer = allocate(module, message.length);
  const signaturePointer = allocate(module, 9_772);
  try {
    module.HEAPU8.set(entropy, entropyPointer);
    module.HEAPU8.set(message, messagePointer);
    module._tc26_hypericum_seed(entropyPointer);
    if (module._tc26_hypericum_keypair(publicKeyPointer, secretKeyPointer) !== 0) {
      throw new Error('Hypericum reference key generation failed');
    }
    if (module._tc26_hypericum_sign(
      secretKeyPointer,
      messagePointer,
      message.length,
      signaturePointer,
    ) !== 0) {
      throw new Error('Hypericum reference signing failed');
    }
    if (module._tc26_hypericum_verify(
      publicKeyPointer,
      signaturePointer,
      messagePointer,
      message.length,
    ) !== 0) {
      throw new Error('Hypericum reference verification failed');
    }

    const publicKey = module.HEAPU8.slice(publicKeyPointer, publicKeyPointer + 64);
    const secretKey = module.HEAPU8.slice(secretKeyPointer, secretKeyPointer + 128);
    const signature = module.HEAPU8.slice(signaturePointer, signaturePointer + 9_772);
    const expectedPublicKey =
      'c76fde5cf91111b593abf833f7ef1047b5163550ca292ec778dbddb9ca05b28d'
      + '0edadfb42039a46a8d25043fed53bdd52442f6ef16a974b1509db10db9aeaafc';
    const expectedPrefix =
      '45d6fd0e5cd9f36a37140f16ae59f28ef004aff8de177236f643445b6bad9b70'
      + '000009ab';
    if (hex(publicKey) !== expectedPublicKey || !hex(signature).startsWith(expectedPrefix)) {
      throw new Error('Hypericum output differs from QApp output_m_128_20.txt');
    }
    return { message, publicKey, secretKey, signature };
  } finally {
    module._free(entropyPointer);
    module._free(publicKeyPointer);
    module._free(secretKeyPointer);
    module._free(messagePointer);
    module._free(signaturePointer);
  }
}

async function generateShipovnik() {
  const module = await createShipovnikModule();
  const message = encoder.encode('test test test');
  const entropy = new Uint8Array(module._tc26_shipovnik_sign_entropy_bytes());
  const entropyPointer = allocate(module, entropy.length);
  const publicKeyPointer = allocate(module, 181);
  const secretKeyPointer = allocate(module, 362);
  const messagePointer = allocate(module, message.length);
  const signaturePointer = allocate(module, 1_072_662);
  try {
    module.HEAPU8.set(entropy, entropyPointer);
    module.HEAPU8.set(message, messagePointer);
    if (module._tc26_shipovnik_keypair(
      entropyPointer,
      11_584,
      secretKeyPointer,
      publicKeyPointer,
    ) !== 0) {
      throw new Error('Shipovnik reference key generation failed');
    }
    const signatureLength = module._tc26_shipovnik_sign(
      entropyPointer,
      entropy.length,
      secretKeyPointer,
      messagePointer,
      message.length,
      signaturePointer,
    );
    if (signatureLength !== 805_868) {
      throw new Error(`Unexpected Shipovnik signature length: ${signatureLength}`);
    }
    if (module._tc26_shipovnik_verify(
      publicKeyPointer,
      signaturePointer,
      messagePointer,
      message.length,
    ) !== 0) {
      throw new Error('Shipovnik reference verification failed');
    }
    const publicKey = module.HEAPU8.slice(publicKeyPointer, publicKeyPointer + 181);
    const secretKey = module.HEAPU8.slice(secretKeyPointer, secretKeyPointer + 362);
    const signature = module.HEAPU8.slice(signaturePointer, signaturePointer + signatureLength);
    if (sha256(publicKey) !== 'c5f00cd65282c0508fabf52c2233ee1d9764e740a453877bb32963eea5a059d9'
        || sha256(secretKey) !== 'ad6477e4e5cb4e0a03e50a3ad6652232d6de36e690673a11d0fec2a0a6666468'
        || sha256(signature) !== '4750a3b3f94352927c866c97cd12d4c24d1fa85acf1c602a948d13bf3f9b56c4') {
      throw new Error('Shipovnik deterministic fixture changed');
    }
    return { message, publicKey, secretKey, signature };
  } finally {
    module._free(entropyPointer);
    module._free(publicKeyPointer);
    module._free(secretKeyPointer);
    module._free(messagePointer);
    module._free(signaturePointer);
  }
}

await mkdir(fixtureDirectory, { recursive: true });
const [hypericum, shipovnik] = await Promise.all([
  generateHypericum(),
  generateShipovnik(),
]);

const hypericumBytes = Buffer.concat([
  Buffer.from(hypericum.secretKey),
  Buffer.from(hypericum.publicKey),
  Buffer.from(hypericum.signature),
]);
const shipovnikBytes = Buffer.concat([
  Buffer.from(shipovnik.secretKey),
  Buffer.from(shipovnik.publicKey),
  Buffer.from(shipovnik.signature),
]);

await writeFile(resolve(fixtureDirectory, 'hypericum-m-128-20.bin'), hypericumBytes);
await writeFile(resolve(fixtureDirectory, 'shipovnik-zero-entropy.bin'), shipovnikBytes);
await writeFile(resolve(fixtureDirectory, 'manifest.json'), `${JSON.stringify({
  hypericum: {
    source: 'QAPP-tech/hypericum_tc26 example_data/output_m_128_20.txt',
    upstreamCommit: 'f3f254038e5539132d112e8f97332a2a351131fe',
    parameterSet: 'm_128_20',
    messageUtf8: 'Example of Hypericum signature for parameter set m_128_20',
    messageIncludesTrailingNull: true,
    publicKeyBytes: 64,
    secretKeyBytes: 128,
    signatureBytes: 9_772,
    publicKeySha256: sha256(hypericum.publicKey),
    secretKeySha256: sha256(hypericum.secretKey),
    signatureSha256: sha256(hypericum.signature),
  },
  shipovnik: {
    source: 'QAPP-tech/shipovnik_tc26 deterministic /dev/zero KAT mechanism',
    upstreamCommit: 'a9139ef6178a6dfebac3ae328817a361f0e85256',
    messageUtf8: 'test test test',
    entropy: 'all zero bytes',
    publicKeyBytes: 181,
    secretKeyBytes: 362,
    signatureBytes: shipovnik.signature.length,
    signatureMaxBytes: 1_072_662,
    publicKeySha256: sha256(shipovnik.publicKey),
    secretKeySha256: sha256(shipovnik.secretKey),
    signatureSha256: sha256(shipovnik.signature),
  },
}, null, 2)}\n`);

console.log(`Hypericum fixture: ${hypericumBytes.length} bytes, signature sha256 ${sha256(hypericum.signature)}`);
console.log(`Shipovnik fixture: ${shipovnikBytes.length} bytes, signature sha256 ${sha256(shipovnik.signature)}`);