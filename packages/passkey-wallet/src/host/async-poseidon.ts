/**
 * Async Poseidon2 implementation using the Worker-based Barretenberg backend.
 *
 * This replaces @aztec/foundation/crypto/poseidon which uses BarretenbergSync
 * (requires SharedArrayBuffer on the main thread). The async backend delegates
 * to a Web Worker that handles its own cross-origin isolation.
 *
 * This module is aliased over @aztec/foundation/crypto/poseidon in the wallet
 * host's build config so the PXE uses async hashing transparently.
 */
import { Fr } from '@aztec/foundation/curves/bn254';
import { type Fieldable, serializeToFields } from '@aztec/foundation/serialize';

let bbInstance: any = null;
let bbInitPromise: Promise<any> | null = null;

async function getBarretenberg() {
  if (bbInstance) return bbInstance;
  if (bbInitPromise) return bbInitPromise;

  bbInitPromise = (async () => {
    const { Barretenberg } = await import('@aztec/bb.js');
    bbInstance = await Barretenberg.new();
    return bbInstance;
  })();

  return bbInitPromise;
}

export async function poseidon2Hash(input: Fieldable[]): Promise<Fr> {
  const inputFields = serializeToFields(input);
  const api = await getBarretenberg();
  const response = await api.poseidon2Hash({
    inputs: inputFields.map((i: Fr) => i.toBuffer()),
  });
  return Fr.fromBuffer(Buffer.from(response.hash));
}

export async function poseidon2HashWithSeparator(input: Fieldable[], separator: number): Promise<Fr> {
  const inputFields = serializeToFields(input);
  inputFields.unshift(new Fr(separator));
  const api = await getBarretenberg();
  const response = await api.poseidon2Hash({
    inputs: inputFields.map((i: Fr) => i.toBuffer()),
  });
  return Fr.fromBuffer(Buffer.from(response.hash));
}

export async function poseidon2Permutation(input: Fieldable[]): Promise<Fr[]> {
  const inputFields = serializeToFields(input);
  const api = await getBarretenberg();
  const response = await api.poseidon2Permutation({
    inputs: inputFields.map((i: Fr) => i.toBuffer()),
  });
  return response.outputs.map((o: Uint8Array) => Fr.fromBuffer(Buffer.from(o)));
}

export async function poseidon2HashBytes(input: Buffer): Promise<Fr> {
  const inputFields = [];
  for (let i = 0; i < input.length; i += 31) {
    const fieldBytes = Buffer.alloc(32, 0);
    input.slice(i, i + 31).copy(fieldBytes);
    fieldBytes.reverse();
    inputFields.push(Fr.fromBuffer(fieldBytes));
  }

  const api = await getBarretenberg();
  const response = await api.poseidon2Hash({
    inputs: inputFields.map((i: Fr) => i.toBuffer()),
  });
  return Fr.fromBuffer(Buffer.from(response.hash));
}
