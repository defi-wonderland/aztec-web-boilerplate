/**
 * Serialization utilities for ContractConfig.
 *
 * Aztec types (Fr, AztecAddress) lose their prototypes when passed through
 * structured clone (postMessage). This module converts them to hex strings
 * before sending and reconstructs them on the other side.
 *
 * The contracts flow through TWO postMessages:
 *   1. SDK → iframe (IframeManager.connect)
 *   2. iframe main thread → Worker (PXEManager.initialize)
 *
 * We serialize once in the SDK and deserialize once in the Worker.
 */
import type { ContractConfig, SerializedContractConfig } from './types';

/** Tag used to identify serialized AztecAddress values in constructorArgs */
const AZTEC_ADDRESS_TAG = '__aztecAddress__';
/** Tag used to identify serialized Fr values in constructorArgs */
const FR_TAG = '__fr__';

/**
 * Serialize a ContractConfig into a form safe for structured clone.
 * Called in the SDK before the first postMessage.
 */
export function serializeContractConfig(config: ContractConfig): SerializedContractConfig {
  return {
    artifact: config.artifact,
    salt: config.salt.toString(),
    deployer: config.deployer.toString(),
    constructorArtifact: config.constructorArtifact,
    constructorArgs: config.constructorArgs.map(serializeArg),
  };
}

/**
 * Serialize a single constructor arg. Detects AztecAddress and Fr instances
 * by checking for characteristic methods, and converts them to tagged objects.
 */
function serializeArg(arg: unknown): unknown {
  if (arg === null || arg === undefined) return arg;

  // AztecAddress: has toString() and toField()
  if (
    typeof arg === 'object' &&
    'toField' in (arg as Record<string, unknown>) &&
    'toString' in (arg as Record<string, unknown>) &&
    typeof (arg as any).toString === 'function'
  ) {
    return { [AZTEC_ADDRESS_TAG]: (arg as any).toString() };
  }

  // Fr: has toBigInt() and toString()
  if (
    typeof arg === 'object' &&
    'toBigInt' in (arg as Record<string, unknown>) &&
    typeof (arg as any).toString === 'function'
  ) {
    return { [FR_TAG]: (arg as any).toString() };
  }

  return arg;
}

/**
 * Reconstruct Aztec types from a serialized contract config.
 * Called in the Worker after receiving the data via postMessage.
 *
 * @param Fr - The Fr class (imported dynamically in the worker)
 * @param AztecAddress - The AztecAddress class (imported dynamically in the worker)
 */
export function deserializeContractConfig(
  config: SerializedContractConfig,
  Fr: { fromHexString: (hex: string) => any },
  AztecAddress: { fromString: (hex: string) => any },
): {
  artifact: SerializedContractConfig['artifact'];
  salt: any;
  deployer: any;
  constructorArtifact: string;
  constructorArgs: unknown[];
} {
  return {
    artifact: config.artifact,
    salt: Fr.fromHexString(config.salt),
    deployer: AztecAddress.fromString(config.deployer),
    constructorArtifact: config.constructorArtifact,
    constructorArgs: config.constructorArgs.map((arg) => deserializeArg(arg, Fr, AztecAddress)),
  };
}

/**
 * Reconstruct a single arg from its serialized form.
 */
function deserializeArg(
  arg: unknown,
  Fr: { fromHexString: (hex: string) => any },
  AztecAddress: { fromString: (hex: string) => any },
): unknown {
  if (arg === null || arg === undefined) return arg;
  if (typeof arg !== 'object') return arg;

  const obj = arg as Record<string, unknown>;
  if (AZTEC_ADDRESS_TAG in obj) {
    return AztecAddress.fromString(obj[AZTEC_ADDRESS_TAG] as string);
  }
  if (FR_TAG in obj) {
    return Fr.fromHexString(obj[FR_TAG] as string);
  }

  return arg;
}
