import { bytesToHex, streebogDigest } from './streebog';

export type Streebog256 = (input: Uint8Array) => Uint8Array;

export interface HypertreeNode {
  id: string;
  level: number;
  index: number;
  label: string;
  inputHex: string;
  digestHex: string;
}

export interface TeachingHypertree {
  leaves: HypertreeNode[];
  parents: HypertreeNode[];
  root: HypertreeNode;
}

const encoder = new TextEncoder();
const defaultHash: Streebog256 = (input) => streebogDigest(input, 256);

function concatenate(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function digestNode(
  id: string,
  level: number,
  index: number,
  label: string,
  input: Uint8Array,
  hash: Streebog256,
): HypertreeNode {
  return {
    id,
    level,
    index,
    label,
    inputHex: bytesToHex(input),
    digestHex: bytesToHex(hash(input)),
  };
}

function digestBytes(node: HypertreeNode): Uint8Array {
  return Uint8Array.from(node.digestHex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}

export function hashParent(
  left: HypertreeNode,
  right: HypertreeNode,
  level: number,
  index: number,
  hash: Streebog256 = defaultHash,
): HypertreeNode {
  const input = concatenate(
    Uint8Array.of(0x01, level, index),
    digestBytes(left),
    digestBytes(right),
  );
  return digestNode(
    `node-${level}-${index}`,
    level,
    index,
    `XMSS level ${level}, node ${index}`,
    input,
    hash,
  );
}

export function buildTeachingHypertree(
  message: string,
  hash: Streebog256 = defaultHash,
): TeachingHypertree {
  const messageBytes = encoder.encode(message);
  const leafLabels = ['FORS root', 'WOTS+C key', 'auth node A', 'auth node B'];
  const leaves = leafLabels.map((label, index) => {
    const input = concatenate(
      Uint8Array.of(0x00, index),
      encoder.encode(label),
      Uint8Array.of(0),
      messageBytes,
    );
    return digestNode(`leaf-${index}`, 0, index, label, input, hash);
  });
  const parents = [
    hashParent(leaves[0], leaves[1], 1, 0, hash),
    hashParent(leaves[2], leaves[3], 1, 1, hash),
  ];
  const root = hashParent(parents[0], parents[1], 2, 0, hash);
  return { leaves, parents, root };
}

export function verifyTeachingHypertree(
  message: string,
  expectedRootHex: string,
  hash: Streebog256 = defaultHash,
): boolean {
  return buildTeachingHypertree(message, hash).root.digestHex === expectedRootHex;
}