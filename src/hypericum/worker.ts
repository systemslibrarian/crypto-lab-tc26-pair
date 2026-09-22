import {
  HYPERICUM_KAT,
  loadHypericumFixture,
  sha256Hex,
  type ReferenceFixture,
} from '../fixtures';
import { signHypericum, verifyHypericum } from './reference';

type Request =
  | { id: number; action: 'kat' }
  | { id: number; action: 'sign'; message: string }
  | { id: number; action: 'tamper' };

interface WorkerScope {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage(message: unknown): void;
}

const scope = self as unknown as WorkerScope;
const encoder = new TextEncoder();
let fixturePromise: Promise<ReferenceFixture> | undefined;
let current: ReferenceFixture | undefined;

function loadFixture(): Promise<ReferenceFixture> {
  fixturePromise ??= loadHypericumFixture();
  return fixturePromise;
}

async function runKat(): Promise<Record<string, unknown>> {
  const fixture = await loadFixture();
  const [publicKeyHash, signatureHash, verified] = await Promise.all([
    sha256Hex(fixture.publicKey),
    sha256Hex(fixture.signature),
    verifyHypericum(fixture.publicKey, fixture.message, fixture.signature),
  ]);
  const passed = publicKeyHash === HYPERICUM_KAT.publicKeySha256
    && signatureHash === HYPERICUM_KAT.signatureSha256
    && verified;
  if (passed) current = fixture;
  return { passed, publicKeyHash, signatureHash, verified, signatureBytes: fixture.signature.length };
}

async function sign(message: string): Promise<Record<string, unknown>> {
  const fixture = await loadFixture();
  const messageBytes = encoder.encode(message);
  const entropy = crypto.getRandomValues(new Uint8Array(32));
  const signature = await signHypericum(fixture.secretKey, messageBytes, entropy);
  const verified = await verifyHypericum(fixture.publicKey, messageBytes, signature);
  current = { ...fixture, message: messageBytes, signature };
  return { verified, signatureBytes: signature.length, signatureHash: await sha256Hex(signature) };
}

async function tamper(): Promise<Record<string, unknown>> {
  current ??= await loadFixture();
  const signature = current.signature.slice();
  signature[48] ^= 1;
  const accepted = await verifyHypericum(current.publicKey, current.message, signature);
  current = { ...current, signature };
  return { accepted, changedByte: 48 };
}

scope.onmessage = (event) => {
  const { id, action } = event.data;
  const operation = action === 'kat'
    ? runKat()
    : action === 'sign'
      ? sign(event.data.message)
      : tamper();
  void operation.then(
    (payload) => scope.postMessage({ id, ok: true, payload }),
    (error: unknown) => scope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
};