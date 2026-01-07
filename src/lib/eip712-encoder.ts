/**
 * EIP-712 Encoder for Aztec Entrypoint Authorization
 *
 * Builds the EIP-712 typed data structure that matches what the Noir contract expects.
 * This encoder creates human-readable authorization requests for MetaMask signing.
 */

import {
  keccak256,
  encodePacked,
  concat,
  toHex,
  pad,
  type Hex,
} from 'viem';
import {
  EIP712_TYPES,
  EIP712_TYPES_5,
  EMPTY_FUNCTION_CALL,
  ACCOUNT_MAX_CALLS,
  DEFAULT_VERIFYING_CONTRACT,
  type FunctionCall,
  type AppDomain,
  type AuthwitAppDomain,
  type EntrypointAuthorization,
  type EntrypointAuthorization5,
  type FunctionCallAuthorization,
} from './eip712-types';

// =============================================================================
// Constants
// =============================================================================

export const MAX_SERIALIZED_ARGS = 20;
export const MAX_SIGNATURE_SIZE = 128;

// Default app domain for EIP-712 Aztec Wallet
export const DEFAULT_APP_DOMAIN: AppDomain = {
  name: 'EVM Aztec Wallet',
  version: '1.0.0',
  chainId: 31337n,
  salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
};

// EIP-712 domain for outer Aztec rollup (without verifyingContract - legacy)
export const AZTEC_DOMAIN = {
  name: 'Aztec',
  version: '1',
  chainId: 31337n,
} as const;

// EIP-712 domain for outer Aztec rollup (with verifyingContract - new)
export const AZTEC_DOMAIN_WITH_CONTRACT = {
  name: 'Aztec',
  version: '1',
  chainId: 31337n,
  verifyingContract: DEFAULT_VERIFYING_CONTRACT,
} as const;

// =============================================================================
// Type Hashes (pre-computed, must match Noir constants)
// =============================================================================

export const TYPE_HASHES = {
  FUNCTION_CALL: keccak256(
    encodePacked(['string'], ['FunctionCall(bytes32 contract,string functionSignature,uint256[] arguments)'])
  ),
  APP_DOMAIN: keccak256(
    encodePacked(['string'], ['AppDomain(string name,string version,uint256 chainId,bytes32 salt)'])
  ),
  // Single function call version (simplified - legacy)
  ENTRYPOINT_AUTHORIZATION: keccak256(
    encodePacked(['string'], [
      'EntrypointAuthorization(AppDomain appDomain,FunctionCall functionCall,uint256 txNonce)' +
      'AppDomain(string name,string version,uint256 chainId,bytes32 salt)' +
      'FunctionCall(bytes32 contract,string functionSignature,uint256[] arguments)'
    ])
  ),
  // 5 function calls version (new)
  ENTRYPOINT_AUTHORIZATION_5: keccak256(
    encodePacked(['string'], [
      'EntrypointAuthorization(AppDomain appDomain,FunctionCall[5] functionCalls,uint256 txNonce)' +
      'AppDomain(string name,string version,uint256 chainId,bytes32 salt)' +
      'FunctionCall(bytes32 contract,string functionSignature,uint256[] arguments)'
    ])
  ),
  // For individual authwits
  AUTHWIT_APP_DOMAIN: keccak256(
    encodePacked(['string'], ['AuthwitAppDomain(uint256 chainId,bytes32 verifyingContract)'])
  ),
  FUNCTION_CALL_AUTHORIZATION: keccak256(
    encodePacked(['string'], [
      'FunctionCallAuthorization(AuthwitAppDomain appDomain,FunctionCall functionCall)' +
      'AuthwitAppDomain(uint256 chainId,bytes32 verifyingContract)' +
      'FunctionCall(bytes32 contract,string functionSignature,uint256[] arguments)'
    ])
  ),
  // Domain with verifyingContract
  EIP712_DOMAIN_WITH_CONTRACT: keccak256(
    encodePacked(['string'], ['EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'])
  ),
} as const;

// Pre-computed hash of empty function call (for padding)
export const EMPTY_FUNCTION_CALL_HASH = (() => {
  const sigHash = keccak256(encodePacked(['string'], ['']));
  const argsHash = keccak256('0x');
  return keccak256(concat([
    TYPE_HASHES.FUNCTION_CALL,
    EMPTY_FUNCTION_CALL.contract,
    sigHash,
    argsHash,
  ]));
})();

// =============================================================================
// EIP-712 Encoder Class
// =============================================================================

export class Eip712Encoder {
  private appDomain: AppDomain;
  private chainId: bigint;

  constructor(options?: { appDomain?: Partial<AppDomain>; chainId?: bigint }) {
    this.chainId = options?.chainId ?? 31337n;
    this.appDomain = {
      ...DEFAULT_APP_DOMAIN,
      ...options?.appDomain,
      chainId: options?.appDomain?.chainId ?? this.chainId,
    };
  }

  /**
   * Build typed data for entrypoint authorization (single function call - legacy)
   */
  buildEntrypointTypedData(
    functionCall: FunctionCall,
    txNonce: bigint,
  ): {
    types: typeof EIP712_TYPES;
    primaryType: 'EntrypointAuthorization';
    domain: typeof AZTEC_DOMAIN;
    message: EntrypointAuthorization;
  } {
    return {
      types: EIP712_TYPES,
      primaryType: 'EntrypointAuthorization',
      domain: { ...AZTEC_DOMAIN, chainId: this.chainId },
      message: {
        appDomain: this.appDomain,
        functionCall,
        txNonce,
      },
    };
  }

  /**
   * Build typed data for entrypoint authorization (5 function calls - new)
   * Pads with empty function calls if fewer than 5 are provided.
   */
  buildEntrypointTypedData5(
    functionCalls: FunctionCall[],
    txNonce: bigint,
    verifyingContract: Hex = DEFAULT_VERIFYING_CONTRACT,
  ): {
    types: typeof EIP712_TYPES_5;
    primaryType: 'EntrypointAuthorization';
    domain: typeof AZTEC_DOMAIN_WITH_CONTRACT;
    message: EntrypointAuthorization5;
  } {
    // Pad to 5 calls
    const paddedCalls = [...functionCalls];
    while (paddedCalls.length < ACCOUNT_MAX_CALLS) {
      paddedCalls.push(EMPTY_FUNCTION_CALL);
    }
    if (paddedCalls.length > ACCOUNT_MAX_CALLS) {
      throw new Error(`Too many function calls: ${functionCalls.length} > ${ACCOUNT_MAX_CALLS}`);
    }

    return {
      types: EIP712_TYPES_5,
      primaryType: 'EntrypointAuthorization',
      domain: { ...AZTEC_DOMAIN_WITH_CONTRACT, chainId: this.chainId, verifyingContract },
      message: {
        appDomain: this.appDomain,
        functionCalls: paddedCalls,
        txNonce,
      },
    };
  }

  /**
   * Build typed data for individual authwit (FunctionCallAuthorization)
   */
  buildAuthwitTypedData(
    functionCall: FunctionCall,
    verifyingContract: Hex,
  ): {
    types: typeof EIP712_TYPES_5;
    primaryType: 'FunctionCallAuthorization';
    domain: typeof AZTEC_DOMAIN_WITH_CONTRACT;
    message: FunctionCallAuthorization;
  } {
    return {
      types: EIP712_TYPES_5,
      primaryType: 'FunctionCallAuthorization',
      domain: { ...AZTEC_DOMAIN_WITH_CONTRACT, chainId: this.chainId, verifyingContract },
      message: {
        appDomain: {
          chainId: this.chainId,
          verifyingContract: pad(verifyingContract, { size: 32 }),
        },
        functionCall,
      },
    };
  }

  /**
   * Create a function call from Aztec call details
   */
  static createFunctionCall(
    targetAddress: bigint | Hex,
    functionSignature: string,
    args: bigint[],
  ): FunctionCall {
    // Convert target address to bytes32
    const contract = typeof targetAddress === 'bigint'
      ? pad(toHex(targetAddress), { size: 32 })
      : pad(targetAddress as Hex, { size: 32 });

    // Validate args length
    if (args.length > MAX_SERIALIZED_ARGS) {
      throw new Error(`Too many arguments: ${args.length} > ${MAX_SERIALIZED_ARGS}`);
    }

    // Validate signature length
    if (functionSignature.length > MAX_SIGNATURE_SIZE) {
      throw new Error(`Function signature too long: ${functionSignature.length} > ${MAX_SIGNATURE_SIZE}`);
    }

    return {
      contract,
      functionSignature,
      arguments: args,
    };
  }

  /**
   * Compute the domain separator for the Aztec rollup
   */
  static computeDomainSeparator(chainId: bigint = 31337n): Hex {
    const typeHash = keccak256(
      encodePacked(['string'], ['EIP712Domain(string name,string version,uint256 chainId)'])
    );

    return keccak256(concat([
      typeHash,
      keccak256(encodePacked(['string'], [AZTEC_DOMAIN.name])),
      keccak256(encodePacked(['string'], [AZTEC_DOMAIN.version])),
      pad(toHex(chainId), { size: 32 }),
    ]));
  }

  /**
   * Compute hashStruct(FunctionCall)
   */
  static hashFunctionCall(call: FunctionCall): Hex {
    // Hash function signature string
    const sigHash = keccak256(encodePacked(['string'], [call.functionSignature]));

    // Hash arguments array
    const argsEncoded = call.arguments.length > 0
      ? concat(call.arguments.map(arg => pad(toHex(arg), { size: 32 })))
      : '0x';
    const argsHash = keccak256(argsEncoded);

    // hashStruct = keccak256(typeHash || contract || sigHash || argsHash)
    return keccak256(concat([
      TYPE_HASHES.FUNCTION_CALL,
      call.contract,
      sigHash,
      argsHash,
    ]));
  }

  /**
   * Compute hashStruct(AppDomain)
   */
  static hashAppDomain(domain: AppDomain): Hex {
    const nameHash = keccak256(encodePacked(['string'], [domain.name]));
    const versionHash = keccak256(encodePacked(['string'], [domain.version]));

    return keccak256(concat([
      TYPE_HASHES.APP_DOMAIN,
      nameHash,
      versionHash,
      pad(toHex(domain.chainId), { size: 32 }),
      domain.salt,
    ]));
  }

  /**
   * Compute hashStruct(EntrypointAuthorization) - single function call
   */
  static hashEntrypointAuthorization(
    appDomain: AppDomain,
    functionCall: FunctionCall,
    txNonce: bigint,
  ): Hex {
    return keccak256(concat([
      TYPE_HASHES.ENTRYPOINT_AUTHORIZATION,
      Eip712Encoder.hashAppDomain(appDomain),
      Eip712Encoder.hashFunctionCall(functionCall),
      pad(toHex(txNonce), { size: 32 }),
    ]));
  }

  /**
   * Hash an array of FunctionCall structs for EIP-712 encoding
   * enc(T[k]) = keccak256(enc(value[0]) || enc(value[1]) || ... || enc(value[k-1]))
   */
  static hashFunctionCallsArray(calls: FunctionCall[]): Hex {
    if (calls.length !== ACCOUNT_MAX_CALLS) {
      throw new Error(`Expected ${ACCOUNT_MAX_CALLS} calls, got ${calls.length}`);
    }
    const hashes = calls.map(call => Eip712Encoder.hashFunctionCall(call));
    return keccak256(concat(hashes));
  }

  /**
   * Compute hashStruct(EntrypointAuthorization) - 5 function calls
   */
  static hashEntrypointAuthorization5(
    appDomain: AppDomain,
    functionCalls: FunctionCall[],
    txNonce: bigint,
  ): Hex {
    return keccak256(concat([
      TYPE_HASHES.ENTRYPOINT_AUTHORIZATION_5,
      Eip712Encoder.hashAppDomain(appDomain),
      Eip712Encoder.hashFunctionCallsArray(functionCalls),
      pad(toHex(txNonce), { size: 32 }),
    ]));
  }

  /**
   * Compute hashStruct(AuthwitAppDomain)
   */
  static hashAuthwitAppDomain(chainId: bigint, verifyingContract: Hex): Hex {
    return keccak256(concat([
      TYPE_HASHES.AUTHWIT_APP_DOMAIN,
      pad(toHex(chainId), { size: 32 }),
      pad(verifyingContract, { size: 32 }),
    ]));
  }

  /**
   * Compute hashStruct(FunctionCallAuthorization)
   */
  static hashFunctionCallAuthorization(
    authwitDomain: AuthwitAppDomain,
    functionCall: FunctionCall,
  ): Hex {
    return keccak256(concat([
      TYPE_HASHES.FUNCTION_CALL_AUTHORIZATION,
      Eip712Encoder.hashAuthwitAppDomain(authwitDomain.chainId, authwitDomain.verifyingContract),
      Eip712Encoder.hashFunctionCall(functionCall),
    ]));
  }

  /**
   * Compute domain separator with verifyingContract
   */
  static computeDomainSeparatorWithContract(chainId: bigint, verifyingContract: Hex): Hex {
    return keccak256(concat([
      TYPE_HASHES.EIP712_DOMAIN_WITH_CONTRACT,
      keccak256(encodePacked(['string'], [AZTEC_DOMAIN.name])),
      keccak256(encodePacked(['string'], [AZTEC_DOMAIN.version])),
      pad(toHex(chainId), { size: 32 }),
      pad(verifyingContract, { size: 32 }),
    ]));
  }

  /**
   * Compute final EIP-712 payload (what gets signed)
   */
  static computeEip712Payload(domainSeparator: Hex, messageHash: Hex): Hex {
    return keccak256(concat(['0x1901', domainSeparator, messageHash]));
  }

  /**
   * Get pre-computed hashes for Noir constants
   */
  static getNoirConstants(): {
    appDomainNameHash: Hex;
    appDomainVersionHash: Hex;
    domainSeparator: Hex;
  } {
    return {
      appDomainNameHash: keccak256(encodePacked(['string'], [DEFAULT_APP_DOMAIN.name])),
      appDomainVersionHash: keccak256(encodePacked(['string'], [DEFAULT_APP_DOMAIN.version])),
      domainSeparator: Eip712Encoder.computeDomainSeparator(),
    };
  }
}

/**
 * Helper to convert hex to Noir byte array format
 */
export function hexToNoirArray(hex: Hex): string {
  const bytes = hex.slice(2).match(/.{2}/g)!;
  return `[${bytes.map(b => '0x' + b).join(', ')}]`;
}

/**
 * Helper to convert signature (r || s) to byte arrays for oracle
 */
export function parseSignature(signature: Hex): { r: Uint8Array; s: Uint8Array; v: number } {
  const sigBytes = Buffer.from(signature.slice(2), 'hex');
  return {
    r: sigBytes.slice(0, 32),
    s: sigBytes.slice(32, 64),
    v: sigBytes[64],
  };
}
