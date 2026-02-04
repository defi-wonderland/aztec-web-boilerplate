import type { ContractArtifact } from '@aztec/aztec.js/abi';
import type { SerializedArtifact } from '../../types/artifactRegistry';

interface SerializedBuffer {
  type: 'Buffer';
  data: number[];
}

function isSerializedBuffer(value: unknown): value is SerializedBuffer {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    (value as SerializedBuffer).type === 'Buffer' &&
    'data' in value &&
    Array.isArray((value as SerializedBuffer).data)
  );
}

function restoreBytecode(bytecode: unknown): Buffer {
  if (Buffer.isBuffer(bytecode)) {
    return bytecode;
  }
  if (typeof bytecode === 'string') {
    return Buffer.from(bytecode, 'base64');
  }
  if (bytecode instanceof Uint8Array) {
    return Buffer.from(bytecode);
  }
  if (isSerializedBuffer(bytecode)) {
    return Buffer.from(bytecode.data);
  }
  if (ArrayBuffer.isView(bytecode)) {
    return Buffer.from(
      bytecode.buffer,
      bytecode.byteOffset,
      bytecode.byteLength
    );
  }
  console.error(
    '[bytecodeSerializer] Unknown bytecode format:',
    typeof bytecode,
    bytecode
  );
  throw new Error(`Invalid bytecode format: ${typeof bytecode}`);
}

/**
 * Restores bytecode to Buffer from various formats:
 * - Base64 strings (from registry API or IndexedDB)
 * - Serialized Buffer objects (from IndexedDB: {type: "Buffer", data: [...]})
 * - Uint8Array or other typed arrays
 * - Actual Buffer instances (pass through)
 */
export function restoreBytecodeBuffers(
  artifact: SerializedArtifact
): ContractArtifact {
  return {
    ...artifact,
    functions: artifact.functions.map((fn) => ({
      ...fn,
      bytecode: restoreBytecode(fn.bytecode),
    })),
  } as ContractArtifact;
}

/**
 * Converts bytecode to base64 strings for consistent IndexedDB storage.
 * This avoids serialization issues with Buffer objects across browsers.
 */
export function prepareArtifactForStorage(
  artifact: ContractArtifact
): SerializedArtifact {
  return {
    ...artifact,
    functions: artifact.functions.map((fn) => ({
      ...fn,
      bytecode: Buffer.isBuffer(fn.bytecode)
        ? fn.bytecode.toString('base64')
        : String(fn.bytecode),
    })),
  };
}
