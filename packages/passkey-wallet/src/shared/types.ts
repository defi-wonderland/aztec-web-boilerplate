import type { ContractArtifact } from '@aztec/stdlib/abi';
import type { AztecAddress } from '@aztec/stdlib/aztec-address';
import type { Fr } from '@aztec/foundation/curves/bn254';

/** Configuration for the passkey wallet SDK. */
export interface PasskeyWalletConfig {
  network: 'devnet' | 'sandbox';
  /** Aztec node URL. Defaults based on network ('sandbox' → localhost:8080, 'devnet' → devnet.aztec-labs.com). */
  nodeUrl?: string;
  walletHost?: string;
  contracts: ContractConfig[];
}

export interface ContractConfig {
  artifact: ContractArtifact;
  salt: Fr;
  deployer: AztecAddress;
  constructorArtifact: string;
  constructorArgs: unknown[];
}

export interface ChannelMessage {
  id: string;
  dir: 'p2i' | 'i2p';
  iv: ArrayBuffer;
  ct: ArrayBuffer;
  version: 1;
}

export interface RPCRequest {
  method: string;
  params: unknown[];
}

export type RPCResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

export type PopupResponse =
  | {
      type: 'auth-keys';
      /** Base64-encoded uncompressed P-256 public key */
      publicKey: string;
      /** Base64-encoded credential ID */
      credentialId: string;
      /** Hex-encoded Fr (master secret for protocol keys) */
      masterSecret: string;
      // TIER-2-UPGRADE: Remove signingKey. Tier 2 uses hardware-bound WebAuthn signing.
      /** Base64-encoded 32-byte P-256 signing key */
      signingKey: string;
      /** Base64-encoded 32-byte AES encryption key */
      encryptionKey: string;
      /** Hex-encoded Fr (account salt) */
      accountSalt: string;
    }
  | { type: 'tx-approved' }
    // TIER-2-UPGRADE: Changes to { type: 'auth-witness'; signature: ArrayBuffer;
    //   authData: ArrayBuffer; clientDataJSON: ArrayBuffer }
  | { type: 'tx-cancelled' }
  | { type: 'read-approved' }
  | { type: 'read-cancelled' };

export type PopupFlow = 'connect' | 'sign' | 'read';

export interface TxSummary {
  contractAddress: string;
  methodName: string;
  args: unknown[];
  dappOrigin: string;
}

export interface ReadSummary {
  contractAddress: string;
  methodName: string;
  dappOrigin: string;
}

export interface InitMessage {
  type: 'INIT';
  contracts?: ContractConfig[];
  nodeUrl?: string;
}

export interface PopupInitMessage {
  type: 'POPUP_INIT';
  flow: PopupFlow;
  context?: TxSummary | ReadSummary;
  credentialId?: ArrayBuffer;
}
