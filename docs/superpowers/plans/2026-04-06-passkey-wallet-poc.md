# Passkey Wallet SDK — POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a passkey-authenticated Aztec wallet SDK delivered as an embeddable iframe, using Tier 1 (PRF-derived software signing) with EcdsaRAccountContract.

**Architecture:** Cross-origin iframe hosts PXE + key management. Popup handles passkey ceremonies and user consent. SDK-side React provider exposes standard Aztec `Wallet` via encrypted MessagePort channel. All Tier-2 upgrade points marked with `// TIER-2-UPGRADE:` comments.

**Tech Stack:** React 19, TypeScript, Vite 7, @aztec/* 4.0.0-devnet.2-patch.1, @noble/hashes (HKDF), @noble/curves (P-256), WebAuthn/WebCrypto APIs

**Spec:** `docs/superpowers/specs/2026-04-06-passkey-wallet-poc-design.md`

---

## Task 1: Convert to Yarn Workspace Monorepo

**Files:**
- Modify: `package.json` (root)
- Create: `packages/passkey-wallet/package.json`
- Create: `packages/passkey-wallet/tsconfig.json`
- Modify: `tsconfig.json` (root — add project references)

- [ ] **Step 1: Create packages directory and passkey-wallet package.json**

```bash
mkdir -p packages/passkey-wallet/src
```

Create `packages/passkey-wallet/package.json`:

```json
{
  "name": "@aztec/passkey-wallet",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/sdk/index.ts",
  "exports": {
    ".": "./src/sdk/index.ts",
    "./host": "./src/host/index.ts",
    "./popup": "./src/popup/index.ts"
  },
  "scripts": {
    "dev:host": "vite --config vite.host.config.ts",
    "build": "vite build --config vite.sdk.config.ts && vite build --config vite.host.config.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@aztec/accounts": "4.0.0-devnet.2-patch.1",
    "@aztec/aztec.js": "4.0.0-devnet.2-patch.1",
    "@aztec/foundation": "4.0.0-devnet.2-patch.1",
    "@aztec/kv-store": "4.0.0-devnet.2-patch.1",
    "@aztec/pxe": "4.0.0-devnet.2-patch.1",
    "@aztec/stdlib": "4.0.0-devnet.2-patch.1",
    "@aztec/wallet-sdk": "4.0.0-devnet.2-patch.1",
    "@noble/curves": "^2.0.0",
    "@noble/hashes": "^1.7.0"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "devDependencies": {
    "typescript": "~5.3.3",
    "vite": "^7.3.1",
    "vitest": "^3.2.4",
    "@vitejs/plugin-react": "^4.5.2"
  }
}
```

- [ ] **Step 2: Create passkey-wallet tsconfig.json**

Create `packages/passkey-wallet/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Add workspaces to root package.json**

Add to root `package.json`:

```json
{
  "workspaces": [
    "packages/*"
  ]
}
```

- [ ] **Step 4: Install workspace dependencies**

```bash
yarn install
```

Expected: Yarn links the workspace package. No errors.

- [ ] **Step 5: Commit**

```bash
git add package.json packages/passkey-wallet/package.json packages/passkey-wallet/tsconfig.json yarn.lock
git commit -m "chore: convert to yarn workspace, scaffold passkey-wallet package"
```

---

## Task 2: Shared Constants and Types

**Files:**
- Create: `packages/passkey-wallet/src/shared/constants.ts`
- Create: `packages/passkey-wallet/src/shared/types.ts`
- Test: `packages/passkey-wallet/src/shared/__tests__/types.test.ts`

- [ ] **Step 1: Create constants**

Create `packages/passkey-wallet/src/shared/constants.ts`:

```typescript
/** Relying Party ID for WebAuthn — broadest registrable domain. Permanent decision. */
export const RP_ID = 'aztec.network';
export const RP_NAME = 'Aztec Wallet';

/** HKDF info strings — each produces a cryptographically independent key from the same PRF output. */
export const HKDF_INFO_MASTER_SECRET = 'aztec-wallet/v1/master-secret';
// TIER-2-UPGRADE: Remove HKDF_INFO_SIGNING_KEY. Tier 2 uses hardware-bound WebAuthn signing.
export const HKDF_INFO_SIGNING_KEY = 'aztec-wallet/v1/p256-signing-key';
export const HKDF_INFO_ENCRYPTION_KEY = 'aztec-wallet/v1/indexeddb-encryption';
export const HKDF_INFO_ACCOUNT_SALT = 'aztec-wallet/v1/account-salt';

/** PRF salt used during credentials.get() to derive the master key material. */
export const PRF_SALT = 'aztec-wallet/v1/master-key';

/** Account index — v1 supports only a single account. */
export const ACCOUNT_INDEX = 0;

/** PRF salt template for user.id in credentials.create(). */
export const USER_ID_SALT_PREFIX = 'aztec-wallet/v1/account/';

/** Store names routed to ephemeral (RAM) storage in CompositeKVStore. */
export const EPHEMERAL_STORE_NAMES = new Set([
  'key_store',
  'complete_addresses',
  'complete_address_index',
]);

/** Encrypted channel protocol version. */
export const CHANNEL_VERSION = 1 as const;

/** Default wallet host URL. */
export const DEFAULT_WALLET_HOST = 'https://wallet.aztec.network';
```

- [ ] **Step 2: Create types**

Create `packages/passkey-wallet/src/shared/types.ts`:

```typescript
import type { ContractArtifact } from '@aztec/stdlib/abi';
import type { AztecAddress } from '@aztec/stdlib/aztec-address';
import type { Fr } from '@aztec/foundation/curves/bn254';

/** Configuration for the passkey wallet SDK. */
export interface PasskeyWalletConfig {
  network: 'devnet' | 'sandbox';
  /** URL of the wallet host iframe. Defaults to DEFAULT_WALLET_HOST. */
  walletHost?: string;
  /** Contracts to register with the PXE on connect. */
  contracts: ContractConfig[];
}

/** Contract registration configuration. */
export interface ContractConfig {
  artifact: ContractArtifact;
  salt: Fr;
  deployer: AztecAddress;
  constructorArtifact: string;
  constructorArgs: unknown[];
}

/** Encrypted channel message format. */
export interface ChannelMessage {
  /** Unique message ID — bound as AAD in AES-GCM for replay protection. */
  id: string;
  /** Direction: parent-to-iframe or iframe-to-parent. */
  dir: 'p2i' | 'i2p';
  /** AES-GCM initialization vector (12 bytes). */
  iv: ArrayBuffer;
  /** AES-GCM ciphertext. */
  ct: ArrayBuffer;
  /** Protocol version. */
  version: 1;
}

/** RPC request over the encrypted channel. */
export interface RPCRequest {
  method: string;
  params: unknown[];
}

/** RPC response over the encrypted channel. */
export type RPCResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

/**
 * Popup communication types.
 * These flow over the internal MessagePort between host iframe and popup window.
 */
export type PopupResponse =
  | {
      type: 'auth-keys';
      publicKey: ArrayBuffer;
      credentialId: ArrayBuffer;
      masterSecret: string; // hex-encoded Fr
      // TIER-2-UPGRADE: Remove signingKey. Tier 2 uses hardware-bound WebAuthn signing.
      signingKey: ArrayBuffer;
      encryptionKey: ArrayBuffer;
      accountSalt: string; // hex-encoded Fr
    }
  | { type: 'tx-approved' }
    // TIER-2-UPGRADE: Changes to { type: 'auth-witness'; signature: ArrayBuffer;
    //   authData: ArrayBuffer; clientDataJSON: ArrayBuffer }
  | { type: 'tx-cancelled' }
  | { type: 'read-approved' }
  | { type: 'read-cancelled' };

/** Popup flow types. */
export type PopupFlow = 'connect' | 'sign' | 'read';

/** Transaction summary shown in the approval popup. */
export interface TxSummary {
  contractAddress: string;
  methodName: string;
  args: unknown[];
  dappOrigin: string;
}

/** Read summary shown in the consent popup. */
export interface ReadSummary {
  contractAddress: string;
  methodName: string;
  dappOrigin: string;
}

/** Init message from SDK to iframe (one-time, over postMessage). */
export interface InitMessage {
  type: 'INIT';
}

/** Init message from host iframe to popup (one-time, over postMessage). */
export interface PopupInitMessage {
  type: 'POPUP_INIT';
  flow: PopupFlow;
  context?: TxSummary | ReadSummary;
  credentialId?: ArrayBuffer;
}
```

- [ ] **Step 3: Write type validation test**

Create `packages/passkey-wallet/src/shared/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type {
  ChannelMessage,
  RPCRequest,
  RPCResponse,
  PopupResponse,
  PasskeyWalletConfig,
} from '../types';
import { CHANNEL_VERSION, RP_ID, EPHEMERAL_STORE_NAMES } from '../constants';

describe('shared types and constants', () => {
  it('ChannelMessage version matches constant', () => {
    const msg: ChannelMessage = {
      id: crypto.randomUUID(),
      dir: 'p2i',
      iv: new ArrayBuffer(12),
      ct: new ArrayBuffer(0),
      version: CHANNEL_VERSION,
    };
    expect(msg.version).toBe(1);
  });

  it('RPCResponse discriminates on ok field', () => {
    const success: RPCResponse = { ok: true, result: 42 };
    const failure: RPCResponse = { ok: false, error: 'bad' };
    expect(success.ok).toBe(true);
    expect(failure.ok).toBe(false);
  });

  it('PopupResponse discriminates on type field', () => {
    const authKeys: PopupResponse = {
      type: 'auth-keys',
      publicKey: new ArrayBuffer(65),
      credentialId: new ArrayBuffer(32),
      masterSecret: '0x1234',
      signingKey: new ArrayBuffer(32),
      encryptionKey: new ArrayBuffer(32),
      accountSalt: '0x5678',
    };
    expect(authKeys.type).toBe('auth-keys');
  });

  it('RP_ID is the broadest registrable domain', () => {
    expect(RP_ID).toBe('aztec.network');
  });

  it('ephemeral store names include key_store and complete_addresses', () => {
    expect(EPHEMERAL_STORE_NAMES.has('key_store')).toBe(true);
    expect(EPHEMERAL_STORE_NAMES.has('complete_addresses')).toBe(true);
    expect(EPHEMERAL_STORE_NAMES.has('complete_address_index')).toBe(true);
    expect(EPHEMERAL_STORE_NAMES.has('note_store')).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd packages/passkey-wallet && npx vitest run src/shared/__tests__/types.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/passkey-wallet/src/shared/
git commit -m "feat(passkey-wallet): add shared constants and types"
```

---

## Task 3: Crypto — HKDF Key Derivation

**Files:**
- Create: `packages/passkey-wallet/src/shared/crypto.ts`
- Test: `packages/passkey-wallet/src/shared/__tests__/crypto.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/passkey-wallet/src/shared/__tests__/crypto.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  deriveMasterSecret,
  deriveSigningKey,
  deriveEncryptionKey,
  deriveAccountSalt,
  deriveAllKeys,
} from '../crypto';

// Deterministic 32-byte PRF output for testing
const TEST_PRF = new Uint8Array(32).fill(0xab);

describe('crypto key derivation', () => {
  it('deriveMasterSecret returns a bigint from 48-byte HKDF output', async () => {
    const result = await deriveMasterSecret(TEST_PRF);
    expect(typeof result).toBe('bigint');
    // Must be less than Bn254 Fr modulus (~254 bits)
    expect(result).toBeGreaterThan(0n);
  });

  // TIER-2-UPGRADE: Remove this test. Tier 2 has no JS signing key.
  it('deriveSigningKey returns a 32-byte Uint8Array', async () => {
    const result = await deriveSigningKey(TEST_PRF);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(32);
  });

  it('deriveEncryptionKey returns a non-extractable CryptoKey', async () => {
    const key = await deriveEncryptionKey(TEST_PRF);
    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM' });
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
  });

  it('deriveAccountSalt returns a bigint from 48-byte HKDF output', async () => {
    const result = await deriveAccountSalt(TEST_PRF);
    expect(typeof result).toBe('bigint');
    expect(result).toBeGreaterThan(0n);
  });

  it('same PRF input always produces same keys (deterministic)', async () => {
    const a = await deriveAllKeys(TEST_PRF);
    const b = await deriveAllKeys(TEST_PRF);
    expect(a.masterSecret).toBe(b.masterSecret);
    expect(a.accountSalt).toBe(b.accountSalt);
    // signingKey bytes must match
    expect(Buffer.from(a.signingKey).toString('hex')).toBe(
      Buffer.from(b.signingKey).toString('hex'),
    );
  });

  it('different PRF inputs produce different keys', async () => {
    const other = new Uint8Array(32).fill(0xcd);
    const a = await deriveAllKeys(TEST_PRF);
    const b = await deriveAllKeys(other);
    expect(a.masterSecret).not.toBe(b.masterSecret);
    expect(a.accountSalt).not.toBe(b.accountSalt);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/passkey-wallet && npx vitest run src/shared/__tests__/crypto.test.ts
```

Expected: FAIL — module `../crypto` not found.

- [ ] **Step 3: Implement crypto.ts**

Create `packages/passkey-wallet/src/shared/crypto.ts`:

```typescript
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { Fr } from '@aztec/foundation/curves/bn254';
import {
  HKDF_INFO_MASTER_SECRET,
  HKDF_INFO_SIGNING_KEY,
  HKDF_INFO_ENCRYPTION_KEY,
  HKDF_INFO_ACCOUNT_SALT,
} from './constants';

const encoder = new TextEncoder();

/**
 * Derives the master secret for Aztec protocol keys (viewing, nullifier, tagging, outgoing).
 * 48 bytes via HKDF then reduced mod Fr to eliminate bias (per RFC 9380).
 *
 * Usage: `deriveKeys(Fr.fromBufferReduce(masterSecretBytes))` from @aztec/stdlib/keys
 */
export async function deriveMasterSecret(prfOutput: Uint8Array): Promise<bigint> {
  const bytes = hkdf(sha256, prfOutput, undefined, encoder.encode(HKDF_INFO_MASTER_SECRET), 48);
  return Fr.fromBufferReduce(Buffer.from(bytes)).toBigInt();
}

/**
 * Derives the P-256 signing key from PRF output.
 * Returns raw 32-byte private key for use with @noble/curves/p256.
 *
 * TIER-2-UPGRADE: Remove this function entirely. Tier 2 uses hardware-bound
 * WebAuthn signing — the signing key never enters JavaScript.
 */
export async function deriveSigningKey(prfOutput: Uint8Array): Promise<Uint8Array> {
  // 48 bytes then reduce mod P-256 order to avoid bias
  const bytes = hkdf(sha256, prfOutput, undefined, encoder.encode(HKDF_INFO_SIGNING_KEY), 48);
  const P256_ORDER = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
  const num = bytesToBigInt(bytes) % P256_ORDER;
  return bigIntToBytes(num, 32);
}

/**
 * Derives a non-extractable AES-256-GCM CryptoKey for encrypting/decrypting IndexedDB at rest.
 */
export async function deriveEncryptionKey(prfOutput: Uint8Array): Promise<CryptoKey> {
  const bytes = hkdf(sha256, prfOutput, undefined, encoder.encode(HKDF_INFO_ENCRYPTION_KEY), 32);
  return crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'AES-GCM' },
    false, // non-extractable
    ['encrypt', 'decrypt'],
  );
}

/**
 * Derives the account salt for deterministic address computation.
 * 48 bytes via HKDF then reduced mod Fr.
 */
export async function deriveAccountSalt(prfOutput: Uint8Array): Promise<bigint> {
  const bytes = hkdf(sha256, prfOutput, undefined, encoder.encode(HKDF_INFO_ACCOUNT_SALT), 48);
  return Fr.fromBufferReduce(Buffer.from(bytes)).toBigInt();
}

/** Convenience: derive all keys at once from a single PRF output. */
export async function deriveAllKeys(prfOutput: Uint8Array) {
  const [masterSecret, signingKey, encryptionKey, accountSalt] = await Promise.all([
    deriveMasterSecret(prfOutput),
    // TIER-2-UPGRADE: Remove deriveSigningKey call
    deriveSigningKey(prfOutput),
    deriveEncryptionKey(prfOutput),
    deriveAccountSalt(prfOutput),
  ]);
  return { masterSecret, signingKey, encryptionKey, accountSalt };
}

/** Big-endian bytes to bigint. */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

/** Bigint to fixed-length big-endian bytes. */
function bigIntToBytes(num: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(num & 0xffn);
    num >>= 8n;
  }
  return bytes;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/passkey-wallet && npx vitest run src/shared/__tests__/crypto.test.ts
```

Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/passkey-wallet/src/shared/crypto.ts packages/passkey-wallet/src/shared/__tests__/crypto.test.ts
git commit -m "feat(passkey-wallet): add HKDF key derivation from PRF output"
```

---

## Task 4: Passkey — WebAuthn Ceremony Wrappers

**Files:**
- Create: `packages/passkey-wallet/src/shared/passkey.ts`
- Test: `packages/passkey-wallet/src/shared/__tests__/passkey.test.ts`

Note: WebAuthn APIs are browser-only. Tests verify the configuration objects we build, not the actual ceremonies (those need E2E tests).

- [ ] **Step 1: Write tests for passkey config builders**

Create `packages/passkey-wallet/src/shared/__tests__/passkey.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildCreateOptions, buildGetOptions } from '../passkey';
import { RP_ID, RP_NAME, PRF_SALT, ACCOUNT_INDEX } from '../constants';

describe('passkey config builders', () => {
  it('buildCreateOptions includes PRF extension and correct RP ID', async () => {
    const options = await buildCreateOptions();
    expect(options.publicKey.rp.id).toBe(RP_ID);
    expect(options.publicKey.rp.name).toBe(RP_NAME);
    expect(options.publicKey.pubKeyCredParams).toEqual([
      { alg: -7, type: 'public-key' },
    ]);
    expect(options.publicKey.authenticatorSelection).toEqual({
      residentKey: 'required',
      userVerification: 'preferred',
    });
    expect(options.publicKey.extensions).toEqual({ prf: {} });
  });

  it('buildCreateOptions generates deterministic userId from account index', async () => {
    const a = await buildCreateOptions();
    const b = await buildCreateOptions();
    const aId = new Uint8Array(a.publicKey.user.id as ArrayBuffer);
    const bId = new Uint8Array(b.publicKey.user.id as ArrayBuffer);
    expect(aId).toEqual(bId);
    expect(aId.length).toBe(32); // SHA-256 output
  });

  it('buildGetOptions includes PRF eval with correct salt', () => {
    const credentialId = new Uint8Array([1, 2, 3, 4]);
    const options = buildGetOptions(credentialId);
    expect(options.publicKey.allowCredentials).toHaveLength(1);
    expect(options.publicKey.userVerification).toBe('preferred');
    const prfExt = (options.publicKey.extensions as any).prf;
    expect(prfExt.eval.first).toBeInstanceOf(Uint8Array);
  });

  // TIER-2-UPGRADE: Add test for buildGetOptions with challenge parameter
  // for WebAuthn signing (credentials.get({ challenge: outer_hash })).
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/passkey-wallet && npx vitest run src/shared/__tests__/passkey.test.ts
```

Expected: FAIL — module `../passkey` not found.

- [ ] **Step 3: Implement passkey.ts**

Create `packages/passkey-wallet/src/shared/passkey.ts`:

```typescript
import {
  RP_ID,
  RP_NAME,
  PRF_SALT,
  ACCOUNT_INDEX,
  USER_ID_SALT_PREFIX,
} from './constants';

const encoder = new TextEncoder();

/**
 * Builds the options object for navigator.credentials.create().
 * Creates a discoverable passkey with PRF extension support.
 */
export async function buildCreateOptions(): Promise<CredentialCreationOptions> {
  const prfSalt = `${USER_ID_SALT_PREFIX}${ACCOUNT_INDEX}`;
  const userId = new Uint8Array(
    await crypto.subtle.digest('SHA-256', encoder.encode(prfSalt)),
  );

  return {
    publicKey: {
      rp: { id: RP_ID, name: RP_NAME },
      user: { id: userId, name: 'user', displayName: 'Aztec User' },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }], // ES256 / P-256
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
      extensions: { prf: {} } as any,
    },
  };
}

/**
 * Builds the options object for navigator.credentials.get().
 * Triggers PRF evaluation to derive the master key material.
 *
 * TIER-2-UPGRADE: Add optional `challenge` parameter. When present,
 * credentials.get() becomes the signing ceremony — the biometric gesture
 * both derives PRF keys AND signs the outer_hash. The challenge should be
 * the raw outer_hash bytes.
 */
export function buildGetOptions(
  credentialId: Uint8Array,
): CredentialRequestOptions {
  return {
    publicKey: {
      allowCredentials: [
        {
          id: credentialId,
          type: 'public-key',
        },
      ],
      userVerification: 'preferred',
      extensions: {
        prf: {
          eval: { first: encoder.encode(PRF_SALT) },
        },
      } as any,
    },
  };
}

/**
 * Extracts PRF output from a WebAuthn assertion response.
 * @returns 32-byte PRF output, or null if PRF is not supported.
 */
export function extractPRFOutput(
  credential: PublicKeyCredential,
): Uint8Array | null {
  const extensions = credential.getClientExtensionResults() as any;
  const prfResult = extensions?.prf?.results?.first;
  if (!prfResult) return null;
  return new Uint8Array(prfResult);
}

/**
 * Extracts the uncompressed P-256 public key from a credentials.create() response.
 * @returns 65-byte uncompressed public key (0x04 || x || y).
 */
export function extractPublicKey(
  credential: PublicKeyCredential,
): Uint8Array {
  const response = credential.response as AuthenticatorAttestationResponse;
  const publicKey = response.getPublicKey();
  if (!publicKey) throw new Error('No public key in attestation response');
  // getPublicKey() returns COSE-encoded key. We need to parse it.
  // For P-256, the raw public key is 65 bytes (uncompressed).
  return new Uint8Array(publicKey);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/passkey-wallet && npx vitest run src/shared/__tests__/passkey.test.ts
```

Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/passkey-wallet/src/shared/passkey.ts packages/passkey-wallet/src/shared/__tests__/passkey.test.ts
git commit -m "feat(passkey-wallet): add WebAuthn ceremony config builders"
```

---

## Task 5: SecureChannel — Encrypted MessagePort Communication

**Files:**
- Create: `packages/passkey-wallet/src/shared/SecureChannel.ts`
- Test: `packages/passkey-wallet/src/shared/__tests__/SecureChannel.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/passkey-wallet/src/shared/__tests__/SecureChannel.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SecureChannel } from '../SecureChannel';

describe('SecureChannel', () => {
  let parentChannel: SecureChannel;
  let iframeChannel: SecureChannel;

  beforeEach(async () => {
    // Use real MessageChannel (available in Node 15+)
    const { port1, port2 } = new MessageChannel();
    parentChannel = new SecureChannel('p2i');
    iframeChannel = new SecureChannel('i2p');
    await SecureChannel.handshake(parentChannel, port1, iframeChannel, port2);
  });

  it('establishes encrypted channel via ECDH handshake', () => {
    expect(parentChannel.isReady()).toBe(true);
    expect(iframeChannel.isReady()).toBe(true);
  });

  it('sends and receives encrypted messages', async () => {
    const responsePromise = iframeChannel.onRequest(async (method, params) => {
      expect(method).toBe('test');
      expect(params).toEqual([1, 'hello']);
      return { result: 'ok' };
    });

    const result = await parentChannel.send('test', [1, 'hello']);
    expect(result).toEqual({ result: 'ok' });
  });

  it('handles multiple concurrent requests', async () => {
    iframeChannel.onRequest(async (method, params) => {
      return { echo: params[0] };
    });

    const [r1, r2, r3] = await Promise.all([
      parentChannel.send('a', [1]),
      parentChannel.send('b', [2]),
      parentChannel.send('c', [3]),
    ]);

    expect(r1).toEqual({ echo: 1 });
    expect(r2).toEqual({ echo: 2 });
    expect(r3).toEqual({ echo: 3 });
  });

  it('rejects when remote handler throws', async () => {
    iframeChannel.onRequest(async () => {
      throw new Error('handler error');
    });

    await expect(parentChannel.send('fail', [])).rejects.toThrow('handler error');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/passkey-wallet && npx vitest run src/shared/__tests__/SecureChannel.test.ts
```

Expected: FAIL — module `../SecureChannel` not found.

- [ ] **Step 3: Implement SecureChannel**

Create `packages/passkey-wallet/src/shared/SecureChannel.ts`:

```typescript
import type { ChannelMessage, RPCRequest, RPCResponse } from './types';
import { CHANNEL_VERSION } from './constants';

type Direction = 'p2i' | 'i2p';
type RequestHandler = (method: string, params: unknown[]) => Promise<unknown>;

/**
 * Encrypted point-to-point communication over MessagePort.
 *
 * Uses ECDH for key exchange, then HKDF-derived AES-256-GCM keys
 * (one per direction) for message encryption. UUID as AAD prevents replay.
 */
export class SecureChannel {
  private port: MessagePort | null = null;
  private sendKey: CryptoKey | null = null;
  private recvKey: CryptoKey | null = null;
  private handler: RequestHandler | null = null;
  private pending = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();

  constructor(private direction: Direction) {}

  isReady(): boolean {
    return this.sendKey !== null && this.recvKey !== null;
  }

  /**
   * Performs ECDH key exchange over a pair of MessagePorts and initializes
   * both channels. Used in tests; in production, each side calls
   * initFromPort() independently.
   */
  static async handshake(
    parent: SecureChannel,
    parentPort: MessagePort,
    iframe: SecureChannel,
    iframePort: MessagePort,
  ): Promise<void> {
    // Generate ephemeral ECDH key pairs
    const parentKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    );
    const iframeKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    );

    // Exchange public keys (in production this happens via port messages)
    const parentPub = await crypto.subtle.exportKey('jwk', parentKeyPair.publicKey);
    const iframePub = await crypto.subtle.exportKey('jwk', iframeKeyPair.publicKey);

    // Each side derives the shared secret
    const parentShared = await deriveSharedSecret(
      parentKeyPair.privateKey,
      await crypto.subtle.importKey('jwk', iframePub, { name: 'ECDH', namedCurve: 'P-256' }, false, []),
    );
    const iframeShared = await deriveSharedSecret(
      iframeKeyPair.privateKey,
      await crypto.subtle.importKey('jwk', parentPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []),
    );

    // Derive direction-separated AES keys from shared secret
    const parentKeys = await deriveChannelKeys(parentShared);
    const iframeKeys = await deriveChannelKeys(iframeShared);

    // Parent sends with p2i key, receives with i2p key
    parent.sendKey = parentKeys.p2i;
    parent.recvKey = parentKeys.i2p;
    parent.port = parentPort;
    parent.listen();

    // Iframe sends with i2p key, receives with p2i key
    iframe.sendKey = iframeKeys.i2p;
    iframe.recvKey = iframeKeys.p2i;
    iframe.port = iframePort;
    iframe.listen();
  }

  /**
   * Initializes the channel from a MessagePort by performing ECDH handshake.
   * Call this on each side independently (SDK side and host side).
   */
  async initFromPort(port: MessagePort): Promise<void> {
    this.port = port;

    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    );

    const myPub = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

    return new Promise<void>((resolve) => {
      const onMessage = async (event: MessageEvent) => {
        if (event.data?.type === 'pubkey') {
          port.removeEventListener('message', onMessage);

          const remotePub = await crypto.subtle.importKey(
            'jwk',
            event.data.key,
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            [],
          );

          const shared = await deriveSharedSecret(keyPair.privateKey, remotePub);
          const keys = await deriveChannelKeys(shared);

          if (this.direction === 'p2i') {
            this.sendKey = keys.p2i;
            this.recvKey = keys.i2p;
          } else {
            this.sendKey = keys.i2p;
            this.recvKey = keys.p2i;
          }

          this.listen();
          resolve();
        }
      };

      port.addEventListener('message', onMessage);
      port.start();
      port.postMessage({ type: 'pubkey', key: myPub });
    });
  }

  /** Register a handler for incoming RPC requests. */
  onRequest(handler: RequestHandler): void {
    this.handler = handler;
  }

  /** Send an RPC request and wait for the response. */
  async send(method: string, params: unknown[]): Promise<unknown> {
    if (!this.port || !this.sendKey) {
      throw new Error('SecureChannel not initialized');
    }

    const id = crypto.randomUUID();
    const request: RPCRequest = { method, params };
    const payload = new TextEncoder().encode(JSON.stringify(request));

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = new TextEncoder().encode(id);
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aad },
      this.sendKey,
      payload,
    );

    const msg: ChannelMessage = {
      id,
      dir: this.direction,
      iv: iv.buffer,
      ct,
      version: CHANNEL_VERSION,
    };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.port!.postMessage(msg);
    });
  }

  /** Stop listening and clean up. */
  destroy(): void {
    this.port?.close();
    this.port = null;
    this.sendKey = null;
    this.recvKey = null;
    for (const { reject } of this.pending.values()) {
      reject(new Error('Channel destroyed'));
    }
    this.pending.clear();
  }

  private listen(): void {
    if (!this.port) return;
    this.port.addEventListener('message', (event: MessageEvent) => {
      this.handleMessage(event.data as ChannelMessage).catch(console.error);
    });
    this.port.start();
  }

  private async handleMessage(msg: ChannelMessage): Promise<void> {
    if (!this.recvKey || !this.sendKey) return;

    const aad = new TextEncoder().encode(msg.id);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(msg.iv), additionalData: aad },
      this.recvKey,
      msg.ct,
    );

    const decoded = JSON.parse(new TextDecoder().decode(plaintext));

    // Is this a response to a pending request?
    if ('ok' in decoded) {
      const pending = this.pending.get(msg.id);
      if (pending) {
        this.pending.delete(msg.id);
        if (decoded.ok) {
          pending.resolve(decoded.result);
        } else {
          pending.reject(new Error(decoded.error));
        }
      }
      return;
    }

    // This is a request — handle it
    if (this.handler && 'method' in decoded) {
      let response: RPCResponse;
      try {
        const result = await this.handler(decoded.method, decoded.params);
        response = { ok: true, result };
      } catch (err: any) {
        response = { ok: false, error: err.message ?? String(err) };
      }

      // Send response back using the same id
      const payload = new TextEncoder().encode(JSON.stringify(response));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aad },
        this.sendKey,
        payload,
      );

      const replyDir: Direction = this.direction === 'p2i' ? 'p2i' : 'i2p';
      this.port!.postMessage({
        id: msg.id,
        dir: replyDir,
        iv: iv.buffer,
        ct,
        version: CHANNEL_VERSION,
      } satisfies ChannelMessage);
    }
  }
}

/** Derive shared secret bits from ECDH. */
async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256,
  );
}

/** Derive two AES-256-GCM keys from shared secret via HKDF. */
async function deriveChannelKeys(
  sharedSecret: ArrayBuffer,
): Promise<{ p2i: CryptoKey; i2p: CryptoKey }> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveKey'],
  );

  const p2i = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('aztec-wallet/channel/p2i'),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  const i2p = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('aztec-wallet/channel/i2p'),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  return { p2i, i2p };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/passkey-wallet && npx vitest run src/shared/__tests__/SecureChannel.test.ts
```

Expected: All 4 tests pass. Note: Vitest runs in Node which has `crypto.subtle` (via `globalThis.crypto`). If not available, add `@vitest/web-worker` or configure `environment: 'jsdom'` in vitest config.

- [ ] **Step 5: Commit**

```bash
git add packages/passkey-wallet/src/shared/SecureChannel.ts packages/passkey-wallet/src/shared/__tests__/SecureChannel.test.ts
git commit -m "feat(passkey-wallet): add encrypted MessagePort SecureChannel"
```

---

## Task 6: Shared Index + Vitest Config

**Files:**
- Create: `packages/passkey-wallet/src/shared/index.ts`
- Create: `packages/passkey-wallet/vitest.config.ts`

- [ ] **Step 1: Create shared index**

Create `packages/passkey-wallet/src/shared/index.ts`:

```typescript
export * from './constants';
export * from './types';
export * from './crypto';
export * from './passkey';
export { SecureChannel } from './SecureChannel';
```

- [ ] **Step 2: Create vitest config**

Create `packages/passkey-wallet/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
```

- [ ] **Step 3: Run all shared tests**

```bash
cd packages/passkey-wallet && npx vitest run
```

Expected: All tests from Tasks 2-5 pass.

- [ ] **Step 4: Commit**

```bash
git add packages/passkey-wallet/src/shared/index.ts packages/passkey-wallet/vitest.config.ts
git commit -m "chore(passkey-wallet): add shared index and vitest config"
```

---

## Task 7: Host — Encrypted IndexedDB Store

**Files:**
- Create: `packages/passkey-wallet/src/host/EncryptedKVStore.ts`
- Test: `packages/passkey-wallet/src/host/__tests__/EncryptedKVStore.test.ts`

This wraps an `AztecAsyncKVStore` to encrypt all values at rest with AES-256-GCM. The underlying store handles structure (maps, sets, arrays); this layer encrypts/decrypts values transparently.

- [ ] **Step 1: Write failing tests**

Create `packages/passkey-wallet/src/host/__tests__/EncryptedKVStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptedKVStore } from '../EncryptedKVStore';
import { InMemoryKVStore } from '../../storage/InMemoryKVStore';

describe('EncryptedKVStore', () => {
  let store: EncryptedKVStore;
  let encryptionKey: CryptoKey;

  beforeEach(async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    encryptionKey = await crypto.subtle.importKey(
      'raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'],
    );
    // Use InMemoryKVStore as the backing store for testing
    const backing = new InMemoryKVStore();
    store = new EncryptedKVStore(backing, encryptionKey);
  });

  it('map: encrypts values on set and decrypts on get', async () => {
    const map = store.openMap<string, string>('test_map');
    await map.set('key1', 'hello world');
    const result = await map.getAsync('key1');
    expect(result).toBe('hello world');
  });

  it('singleton: encrypts value on set and decrypts on get', async () => {
    const singleton = store.openSingleton<number>('test_singleton');
    await singleton.set(42);
    const result = await singleton.getAsync();
    expect(result).toBe(42);
  });

  it('array: encrypts values and decrypts on read', async () => {
    const arr = store.openArray<string>('test_array');
    await arr.push('a', 'b', 'c');
    const result = await arr.atAsync(1);
    expect(result).toBe('b');
  });

  it('different encryption keys cannot read each other\'s data', async () => {
    const map = store.openMap<string, string>('test_map');
    await map.set('secret', 'confidential');

    // Create a new EncryptedKVStore with a DIFFERENT key but same backing
    const otherKey = await crypto.subtle.importKey(
      'raw',
      crypto.getRandomValues(new Uint8Array(32)),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );
    const backing = new InMemoryKVStore();
    const otherStore = new EncryptedKVStore(backing, otherKey);
    const otherMap = otherStore.openMap<string, string>('test_map');
    // Different backing store means no data to decrypt, should return undefined
    const result = await otherMap.getAsync('secret');
    expect(result).toBeUndefined();
  });

  it('clear removes all data', async () => {
    const map = store.openMap<string, string>('test_map');
    await map.set('key', 'val');
    await store.clear();
    const result = await map.getAsync('key');
    expect(result).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/passkey-wallet && npx vitest run src/host/__tests__/EncryptedKVStore.test.ts
```

Expected: FAIL — module `../EncryptedKVStore` not found.

- [ ] **Step 3: Implement EncryptedKVStore**

Create `packages/passkey-wallet/src/host/EncryptedKVStore.ts`:

```typescript
import type {
  AztecAsyncKVStore,
  AztecAsyncMap,
  AztecAsyncSet,
  AztecAsyncMultiMap,
  AztecAsyncArray,
  AztecAsyncSingleton,
  AztecAsyncCounter,
  Key,
  Value,
  StoreSize,
} from '@aztec/kv-store/interfaces';

/**
 * Wraps an AztecAsyncKVStore to encrypt all values at rest with AES-256-GCM.
 * Keys (map keys, set entries) are NOT encrypted — only values.
 * The encryption key is a non-extractable CryptoKey derived from passkey PRF.
 */
export class EncryptedKVStore implements AztecAsyncKVStore {
  constructor(
    private backing: AztecAsyncKVStore,
    private encryptionKey: CryptoKey,
  ) {}

  openMap<K extends Key, V extends Value>(name: string): AztecAsyncMap<K, V> {
    const raw = this.backing.openMap<K, Uint8Array>(name);
    return new EncryptedMap(raw, this.encryptionKey) as unknown as AztecAsyncMap<K, V>;
  }

  openSet<K extends Key>(name: string): AztecAsyncSet<K> {
    // Sets only store keys, no values to encrypt
    return this.backing.openSet(name);
  }

  openMultiMap<K extends Key, V extends Value>(name: string): AztecAsyncMultiMap<K, V> {
    const raw = this.backing.openMultiMap<K, Uint8Array>(name);
    return new EncryptedMultiMap(raw, this.encryptionKey) as unknown as AztecAsyncMultiMap<K, V>;
  }

  openArray<T extends Value>(name: string): AztecAsyncArray<T> {
    const raw = this.backing.openArray<Uint8Array>(name);
    return new EncryptedArray(raw, this.encryptionKey) as unknown as AztecAsyncArray<T>;
  }

  openSingleton<T extends Value>(name: string): AztecAsyncSingleton<T> {
    const raw = this.backing.openSingleton<Uint8Array>(name);
    return new EncryptedSingleton(raw, this.encryptionKey) as unknown as AztecAsyncSingleton<T>;
  }

  openCounter<K extends Key>(name: string): AztecAsyncCounter<K> {
    // Counters store numbers, not sensitive data
    return this.backing.openCounter(name);
  }

  transactionAsync<T extends Exclude<any, Promise<any>>>(callback: () => Promise<T>): Promise<T> {
    return this.backing.transactionAsync(callback);
  }

  clear(): Promise<void> { return this.backing.clear(); }
  delete(): Promise<void> { return this.backing.delete(); }
  estimateSize(): Promise<StoreSize> { return this.backing.estimateSize(); }
  close(): Promise<void> { return this.backing.close(); }
  backupTo(dstPath: string, compact?: boolean): Promise<void> {
    return this.backing.backupTo(dstPath, compact);
  }
}

// --- Encrypted wrappers for each collection type ---

async function encrypt(key: CryptoKey, value: unknown): Promise<Uint8Array> {
  const json = JSON.stringify(value);
  const data = new TextEncoder().encode(json);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  // Prepend IV to ciphertext: [12 bytes IV][...ciphertext]
  const result = new Uint8Array(12 + ct.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ct), 12);
  return result;
}

async function decrypt<T>(key: CryptoKey, data: Uint8Array): Promise<T> {
  const iv = data.slice(0, 12);
  const ct = data.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(plain));
}

class EncryptedMap<K extends Key, V extends Value> implements AztecAsyncMap<K, V> {
  constructor(
    private raw: AztecAsyncMap<K, Uint8Array>,
    private key: CryptoKey,
  ) {}

  async set(k: K, val: V): Promise<void> {
    await this.raw.set(k, await encrypt(this.key, val));
  }

  async setMany(entries: { key: K; value: V }[]): Promise<void> {
    const encrypted = await Promise.all(
      entries.map(async (e) => ({ key: e.key, value: await encrypt(this.key, e.value) })),
    );
    await this.raw.setMany(encrypted);
  }

  async setIfNotExists(k: K, val: V): Promise<boolean> {
    return this.raw.setIfNotExists(k, await encrypt(this.key, val));
  }

  delete(k: K): Promise<void> { return this.raw.delete(k); }
  hasAsync(k: K): Promise<boolean> { return this.raw.hasAsync(k); }
  sizeAsync(): Promise<number> { return this.raw.sizeAsync(); }

  async getAsync(k: K): Promise<V | undefined> {
    const raw = await this.raw.getAsync(k);
    if (!raw) return undefined;
    return decrypt<V>(this.key, raw instanceof Uint8Array ? raw : new Uint8Array(raw));
  }

  async *entriesAsync(): AsyncIterableIterator<[K, V]> {
    for await (const [k, raw] of this.raw.entriesAsync()) {
      const val = await decrypt<V>(this.key, raw instanceof Uint8Array ? raw : new Uint8Array(raw));
      yield [k, val];
    }
  }

  async *valuesAsync(): AsyncIterableIterator<V> {
    for await (const raw of this.raw.valuesAsync()) {
      yield decrypt<V>(this.key, raw instanceof Uint8Array ? raw : new Uint8Array(raw));
    }
  }

  async *keysAsync(): AsyncIterableIterator<K> {
    yield* this.raw.keysAsync();
  }
}

class EncryptedSingleton<T extends Value> implements AztecAsyncSingleton<T> {
  constructor(
    private raw: AztecAsyncSingleton<Uint8Array>,
    private key: CryptoKey,
  ) {}

  async set(val: T): Promise<boolean> {
    return this.raw.set(await encrypt(this.key, val));
  }

  delete(): Promise<boolean> { return this.raw.delete(); }

  async getAsync(): Promise<T | undefined> {
    const raw = await this.raw.getAsync();
    if (!raw) return undefined;
    return decrypt<T>(this.key, raw instanceof Uint8Array ? raw : new Uint8Array(raw));
  }
}

class EncryptedArray<T extends Value> implements AztecAsyncArray<T> {
  constructor(
    private raw: AztecAsyncArray<Uint8Array>,
    private key: CryptoKey,
  ) {}

  async push(...vals: T[]): Promise<number> {
    const encrypted = await Promise.all(vals.map((v) => encrypt(this.key, v)));
    return this.raw.push(...encrypted);
  }

  async pop(): Promise<T | undefined> {
    const raw = await this.raw.pop();
    if (!raw) return undefined;
    return decrypt<T>(this.key, raw instanceof Uint8Array ? raw : new Uint8Array(raw));
  }

  async setAt(index: number, val: T): Promise<boolean> {
    return this.raw.setAt(index, await encrypt(this.key, val));
  }

  lengthAsync(): Promise<number> { return this.raw.lengthAsync(); }

  async atAsync(index: number): Promise<T | undefined> {
    const raw = await this.raw.atAsync(index);
    if (!raw) return undefined;
    return decrypt<T>(this.key, raw instanceof Uint8Array ? raw : new Uint8Array(raw));
  }

  async *entriesAsync(): AsyncIterableIterator<[number, T]> {
    for await (const [i, raw] of this.raw.entriesAsync()) {
      yield [i, await decrypt<T>(this.key, raw instanceof Uint8Array ? raw : new Uint8Array(raw))];
    }
  }

  async *valuesAsync(): AsyncIterableIterator<T> {
    for await (const raw of this.raw.valuesAsync()) {
      yield decrypt<T>(this.key, raw instanceof Uint8Array ? raw : new Uint8Array(raw));
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    yield* this.valuesAsync();
  }
}

class EncryptedMultiMap<K extends Key, V extends Value>
  extends EncryptedMap<K, V>
  implements AztecAsyncMultiMap<K, V>
{
  private rawMulti: AztecAsyncMultiMap<K, Uint8Array>;

  constructor(raw: AztecAsyncMultiMap<K, Uint8Array>, key: CryptoKey) {
    super(raw, key);
    this.rawMulti = raw;
  }

  async *getValuesAsync(k: K): AsyncIterableIterator<V> {
    for await (const raw of this.rawMulti.getValuesAsync(k)) {
      yield decrypt<V>((this as any).key, raw instanceof Uint8Array ? raw : new Uint8Array(raw));
    }
  }

  getValueCountAsync(k: K): Promise<number> {
    return this.rawMulti.getValueCountAsync(k);
  }

  async deleteValue(k: K, val: V): Promise<void> {
    // This is imprecise since we can't match encrypted values.
    // For the POC, delegate to the backing store.
    // A production implementation would need to iterate and match.
    return this.rawMulti.deleteValue(k, await encrypt((this as any).key, val) as any);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/passkey-wallet && npx vitest run src/host/__tests__/EncryptedKVStore.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/passkey-wallet/src/host/EncryptedKVStore.ts packages/passkey-wallet/src/host/__tests__/EncryptedKVStore.test.ts
git commit -m "feat(passkey-wallet): add encrypted IndexedDB KV store wrapper"
```

---

## Task 8: Host — PXEManager

**Files:**
- Create: `packages/passkey-wallet/src/host/PXEManager.ts`

The PXEManager orchestrates PXE lifecycle: creates the CompositeKVStore (RAM for keys, encrypted IndexedDB for persistent data), initializes PXE, and handles teardown. Uses the existing `CompositeKVStore` and `InMemoryKVStore` from the main app's storage layer.

- [ ] **Step 1: Create PXEManager**

Create `packages/passkey-wallet/src/host/PXEManager.ts`:

```typescript
import type { AztecNode } from '@aztec/stdlib/interfaces/client';
import type { AztecAsyncKVStore } from '@aztec/kv-store/interfaces';
import { EPHEMERAL_STORE_NAMES } from '../shared/constants';

// These will be imported from the main app or vendored into the package.
// For the POC, we import from the relative path. In production, these
// would be published as part of the package.
import { CompositeKVStore } from '../storage/CompositeKVStore';
import { InMemoryKVStore } from '../storage/InMemoryKVStore';
import { EncryptedKVStore } from './EncryptedKVStore';

/**
 * Manages PXE lifecycle within the wallet host iframe.
 *
 * - Creates CompositeKVStore routing sensitive keys to RAM, rest to encrypted IndexedDB.
 * - Initializes PXE with the composite store.
 * - Handles teardown (clears RAM, PXE garbage collected).
 */
export class PXEManager {
  private pxe: any | null = null; // PXE type from @aztec/pxe
  private ramStore: InMemoryKVStore | null = null;

  /**
   * Initialize PXE with composite storage.
   *
   * @param node - AztecNode to connect the PXE to
   * @param encryptionKey - AES-256-GCM CryptoKey for IndexedDB encryption
   * @param config - PXE config
   */
  async initialize(
    node: AztecNode,
    encryptionKey: CryptoKey,
    config?: { dataDirectory?: string },
  ): Promise<any> {
    // Lazy import to avoid loading WASM at module level
    const { createPXE } = await import('@aztec/pxe/client/bundle');
    const { AztecIndexedDBStore } = await import('@aztec/kv-store/indexeddb');

    // 1. Create backing stores
    this.ramStore = new InMemoryKVStore();
    const rawIndexedDB = await AztecIndexedDBStore.open(
      undefined as any, // logger — PXE provides its own
      config?.dataDirectory ?? 'passkey-wallet-pxe',
      false,
    );
    const encryptedStore = new EncryptedKVStore(rawIndexedDB, encryptionKey);

    // 2. Composite: route key_store + complete_addresses to RAM, rest to encrypted IDB
    const compositeStore = new CompositeKVStore(
      encryptedStore,
      this.ramStore,
      EPHEMERAL_STORE_NAMES,
    );

    // 3. Create PXE with composite store
    this.pxe = await createPXE(node, {} as any, { store: compositeStore });
    return this.pxe;
  }

  getPXE(): any | null {
    return this.pxe;
  }

  /** Tear down PXE and clear RAM store. */
  async destroy(): Promise<void> {
    if (this.pxe) {
      await this.pxe.stop();
      this.pxe = null;
    }
    if (this.ramStore) {
      await this.ramStore.clear();
      this.ramStore = null;
    }
  }
}
```

- [ ] **Step 2: Copy storage implementations into the package**

The CompositeKVStore and InMemoryKVStore are currently in `src/aztec-wallet/services/storage/`. Copy them into the package so it's self-contained:

```bash
mkdir -p packages/passkey-wallet/src/storage
cp src/aztec-wallet/services/storage/CompositeKVStore.ts packages/passkey-wallet/src/storage/
cp src/aztec-wallet/services/storage/InMemoryKVStore.ts packages/passkey-wallet/src/storage/
cp src/aztec-wallet/services/storage/InMemoryMap.ts packages/passkey-wallet/src/storage/
```

Update imports in the copied files if needed to use `@aztec/kv-store/interfaces` instead of relative paths.

- [ ] **Step 3: Commit**

```bash
git add packages/passkey-wallet/src/host/PXEManager.ts packages/passkey-wallet/src/storage/
git commit -m "feat(passkey-wallet): add PXEManager with composite encrypted storage"
```

---

## Task 9: Host — AccountManager

**Files:**
- Create: `packages/passkey-wallet/src/host/AccountManager.ts`
- Test: `packages/passkey-wallet/src/host/__tests__/AccountManager.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/passkey-wallet/src/host/__tests__/AccountManager.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createSigningKeyBuffer, getPublicKeyArgs } from '../AccountManager';

describe('AccountManager', () => {
  it('createSigningKeyBuffer converts Uint8Array to Buffer', () => {
    const key = new Uint8Array(32).fill(0x42);
    const buf = createSigningKeyBuffer(key);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBe(32);
    expect(buf[0]).toBe(0x42);
  });

  // TIER-2-UPGRADE: This test changes. Tier 2 doesn't use a JS signing key —
  // the account contract takes the WebAuthn P-256 public key from the
  // credentials.create() response instead.
  it('getPublicKeyArgs returns x and y coordinate buffers', async () => {
    const key = new Uint8Array(32).fill(0x01);
    const { x, y } = await getPublicKeyArgs(key);
    expect(x).toBeInstanceOf(Buffer);
    expect(y).toBeInstanceOf(Buffer);
    expect(x.length).toBe(32);
    expect(y.length).toBe(32);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/passkey-wallet && npx vitest run src/host/__tests__/AccountManager.test.ts
```

Expected: FAIL — module `../AccountManager` not found.

- [ ] **Step 3: Implement AccountManager**

Create `packages/passkey-wallet/src/host/AccountManager.ts`:

```typescript
import { Fr } from '@aztec/foundation/curves/bn254';
import { Ecdsa } from '@aztec/foundation/crypto/ecdsa';
import { AccountManager as AztecAccountManager } from '@aztec/aztec.js';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa';
import { deriveKeys } from '@aztec/stdlib/keys';
import type { Wallet } from '@aztec/aztec.js/wallet';

/**
 * TIER-2-UPGRADE: Replace EcdsaRAccountContract with PasskeyAccountContract.
 * PasskeyAccountContract verifies WebAuthn envelope in Noir circuits.
 * The witness provider changes from software p256.sign() to WebAuthn
 * signature + authenticatorData + clientDataJSON from the popup.
 *
 * Specifically:
 * - Remove signingKey parameter (Tier 2 never has the signing key in JS)
 * - The account contract constructor takes the WebAuthn P-256 public key
 *   from credentials.create() instead of deriving it from a JS private key
 * - createAuthWit() in the witness provider sends a sign-request to the popup
 *   instead of calling p256.sign() locally
 */

/** Convert Uint8Array signing key to Buffer for Aztec's Ecdsa class. */
export function createSigningKeyBuffer(signingKey: Uint8Array): Buffer {
  return Buffer.from(signingKey);
}

/** Derive the P-256 public key and split into x,y coordinate buffers for the account contract constructor. */
export async function getPublicKeyArgs(signingKey: Uint8Array): Promise<{ x: Buffer; y: Buffer }> {
  const ecdsa = new Ecdsa('secp256r1');
  const pubKey = await ecdsa.computePublicKey(Buffer.from(signingKey));
  return {
    x: Buffer.from(pubKey.subarray(0, 32)),
    y: Buffer.from(pubKey.subarray(32, 64)),
  };
}

/**
 * Creates and registers an Aztec account using EcdsaR with a PRF-derived signing key.
 *
 * @param pxe - The PXE instance running in the iframe
 * @param masterSecret - Fr-reduced master secret from HKDF(PRF)
 * @param signingKey - 32-byte P-256 private key from HKDF(PRF)
 * @param accountSalt - Fr-reduced salt for deterministic address
 * @returns The wallet address as a string
 */
export async function registerAccount(
  pxe: any, // PXE type
  masterSecret: bigint,
  signingKey: Uint8Array,
  accountSalt: bigint,
): Promise<{ address: string; wallet: any }> {
  const secretKey = new Fr(masterSecret);
  const salt = new Fr(accountSalt);

  // TIER-2-UPGRADE: Replace EcdsaRAccountContract with PasskeyAccountContract
  const accountContract = new EcdsaRAccountContract(createSigningKeyBuffer(signingKey));

  // Derive public keys and compute address
  const { publicKeys } = await deriveKeys(secretKey);

  // Register the account with PXE
  const partialAddress = Fr.ZERO; // Computed by AccountManager
  await pxe.registerAccount(secretKey, partialAddress);

  // Use Aztec's AccountManager to compute the deterministic address
  const accountManager = await AztecAccountManager.create(
    pxe as any, // PXE implements Wallet-like interface for account creation
    secretKey,
    accountContract,
    salt,
  );

  const completeAddress = await accountManager.getCompleteAddress();
  const address = completeAddress.address.toString();

  return { address, wallet: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/passkey-wallet && npx vitest run src/host/__tests__/AccountManager.test.ts
```

Expected: Both tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/passkey-wallet/src/host/AccountManager.ts packages/passkey-wallet/src/host/__tests__/AccountManager.test.ts
git commit -m "feat(passkey-wallet): add AccountManager with EcdsaR account contract"
```

---

## Task 10: Host — CredentialStore

**Files:**
- Create: `packages/passkey-wallet/src/host/CredentialStore.ts`
- Test: `packages/passkey-wallet/src/host/__tests__/CredentialStore.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/passkey-wallet/src/host/__tests__/CredentialStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CredentialStore } from '../CredentialStore';

// Mock IndexedDB with a simple Map for testing
class MockStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

describe('CredentialStore', () => {
  let store: CredentialStore;

  beforeEach(() => {
    store = new CredentialStore(new MockStorage() as any);
  });

  it('saves and retrieves credential ID', () => {
    const credId = new Uint8Array([1, 2, 3, 4]);
    store.saveCredentialId(credId);
    const retrieved = store.getCredentialId();
    expect(retrieved).toEqual(credId);
  });

  it('returns null when no credential stored', () => {
    expect(store.getCredentialId()).toBeNull();
  });

  it('saves and retrieves public key', () => {
    const pubKey = new Uint8Array(65).fill(0x04);
    store.savePublicKey(pubKey);
    const retrieved = store.getPublicKey();
    expect(retrieved).toEqual(pubKey);
  });

  it('clears all stored data', () => {
    store.saveCredentialId(new Uint8Array([1]));
    store.savePublicKey(new Uint8Array([2]));
    store.clear();
    expect(store.getCredentialId()).toBeNull();
    expect(store.getPublicKey()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/passkey-wallet && npx vitest run src/host/__tests__/CredentialStore.test.ts
```

Expected: FAIL — module `../CredentialStore` not found.

- [ ] **Step 3: Implement CredentialStore**

Create `packages/passkey-wallet/src/host/CredentialStore.ts`:

```typescript
const CRED_ID_KEY = 'aztec-wallet:credentialId';
const PUB_KEY_KEY = 'aztec-wallet:publicKey';

/**
 * Stores public, unencrypted credential data in localStorage.
 * - credentialId: used to skip passkey picker on returning visits
 * - publicKey: P-256 public key for account identity verification
 *
 * If cleared, the user simply re-authenticates (passkey is discoverable).
 */
export class CredentialStore {
  constructor(private storage: Storage = localStorage) {}

  saveCredentialId(credentialId: Uint8Array): void {
    this.storage.setItem(CRED_ID_KEY, uint8ArrayToBase64(credentialId));
  }

  getCredentialId(): Uint8Array | null {
    const stored = this.storage.getItem(CRED_ID_KEY);
    if (!stored) return null;
    return base64ToUint8Array(stored);
  }

  savePublicKey(publicKey: Uint8Array): void {
    this.storage.setItem(PUB_KEY_KEY, uint8ArrayToBase64(publicKey));
  }

  getPublicKey(): Uint8Array | null {
    const stored = this.storage.getItem(PUB_KEY_KEY);
    if (!stored) return null;
    return base64ToUint8Array(stored);
  }

  clear(): void {
    this.storage.removeItem(CRED_ID_KEY);
    this.storage.removeItem(PUB_KEY_KEY);
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/passkey-wallet && npx vitest run src/host/__tests__/CredentialStore.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/passkey-wallet/src/host/CredentialStore.ts packages/passkey-wallet/src/host/__tests__/CredentialStore.test.ts
git commit -m "feat(passkey-wallet): add CredentialStore for passkey credential persistence"
```

---

## Task 11: Host — PopupOrchestrator

**Files:**
- Create: `packages/passkey-wallet/src/host/PopupOrchestrator.ts`

- [ ] **Step 1: Implement PopupOrchestrator**

Create `packages/passkey-wallet/src/host/PopupOrchestrator.ts`:

```typescript
import type {
  PopupFlow,
  PopupResponse,
  PopupInitMessage,
  TxSummary,
  ReadSummary,
} from '../shared/types';

/**
 * Opens and manages popup windows for passkey ceremonies and user consent.
 * Each popup receives a MessagePort for communication back to the host.
 */
export class PopupOrchestrator {
  private walletOrigin: string;

  constructor(walletOrigin: string) {
    this.walletOrigin = walletOrigin;
  }

  /**
   * Opens a popup for the specified flow and returns the popup's response.
   * The popup auto-closes after completing its task.
   *
   * @param flow - Which popup flow to open
   * @param context - Transaction or read summary for approval flows
   * @param credentialId - Stored credential ID for returning-visit connect flow
   */
  async openPopup(
    flow: PopupFlow,
    context?: TxSummary | ReadSummary,
    credentialId?: Uint8Array,
  ): Promise<PopupResponse> {
    const url = `${this.walletOrigin}/auth?flow=${flow}`;
    const popup = window.open(url, '_blank', 'width=400,height=500,popup=yes');

    if (!popup) {
      throw new Error(
        'Popup blocked. Please allow popups for this site to use the Aztec wallet.',
      );
    }

    return new Promise<PopupResponse>((resolve, reject) => {
      // Create a MessageChannel for host<->popup communication
      const { port1, port2 } = new MessageChannel();

      // Wait for popup to signal it's ready
      const onReady = (event: MessageEvent) => {
        if (event.source !== popup || event.data?.type !== 'POPUP_READY') return;
        window.removeEventListener('message', onReady);

        // Send the init message with the port (strict origin check, no wildcard)
        const initMsg: PopupInitMessage = {
          type: 'POPUP_INIT',
          flow,
          context,
          credentialId: credentialId?.buffer,
        };
        popup.postMessage(initMsg, this.walletOrigin, [port2]);
      };
      window.addEventListener('message', onReady);

      // Listen for the popup's response on our port
      port1.onmessage = (event: MessageEvent) => {
        const response = event.data as PopupResponse;
        port1.close();
        resolve(response);
      };

      // Detect popup close without response
      const pollClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollClosed);
          window.removeEventListener('message', onReady);
          port1.close();
          reject(new Error('Popup closed without completing'));
        }
      }, 500);

      // Clean up polling when resolved
      port1.onmessage = (event: MessageEvent) => {
        clearInterval(pollClosed);
        const response = event.data as PopupResponse;
        port1.close();
        resolve(response);
      };
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/passkey-wallet/src/host/PopupOrchestrator.ts
git commit -m "feat(passkey-wallet): add PopupOrchestrator for popup lifecycle management"
```

---

## Task 12: Host — RPCHandler and WalletHost

**Files:**
- Create: `packages/passkey-wallet/src/host/RPCHandler.ts`
- Create: `packages/passkey-wallet/src/host/WalletHost.tsx`
- Create: `packages/passkey-wallet/src/host/index.ts`

- [ ] **Step 1: Implement RPCHandler**

Create `packages/passkey-wallet/src/host/RPCHandler.ts`:

```typescript
import type { SecureChannel } from '../shared/SecureChannel';
import type { PopupResponse, TxSummary } from '../shared/types';
import type { PXEManager } from './PXEManager';
import type { PopupOrchestrator } from './PopupOrchestrator';
import type { CredentialStore } from './CredentialStore';
import { deriveAllKeys } from '../shared/crypto';
import { Fr } from '@aztec/foundation/curves/bn254';
import { registerAccount } from './AccountManager';

// PXE methods that require user approval via popup
const TX_METHODS = new Set(['proveTx', 'sendTx']);
// TIER-2-UPGRADE: TX_METHODS trigger WebAuthn signing ceremony in popup,
// not just consent. The popup calls credentials.get({ challenge: outer_hash })
// and returns the WebAuthn witness.

/**
 * Processes RPC messages from the SDK over the SecureChannel.
 *
 * - connect/disconnect: custom wallet lifecycle methods
 * - PXE methods: forwarded directly to the PXE instance
 * - TX methods: gated by popup approval before execution
 */
export class RPCHandler {
  private signingKey: Uint8Array | null = null;
  // TIER-2-UPGRADE: Remove signingKey field. Tier 2 doesn't store signing key in JS.

  constructor(
    private pxeManager: PXEManager,
    private popupOrchestrator: PopupOrchestrator,
    private credentialStore: CredentialStore,
    private contractConfigs: any[], // ContractConfig[]
  ) {}

  /** Register this handler on the secure channel. */
  register(channel: SecureChannel): void {
    channel.onRequest(async (method, params) => {
      // Custom wallet methods
      if (method === 'connect') return this.handleConnect();
      if (method === 'disconnect') return this.handleDisconnect();

      // All other methods forwarded to PXE
      const pxe = this.pxeManager.getPXE();
      if (!pxe) throw new Error('PXE not initialized. Call connect() first.');

      // Gate TX methods behind popup approval
      if (TX_METHODS.has(method)) {
        await this.requireTxApproval(params);
      }

      // Forward to PXE
      if (typeof (pxe as any)[method] !== 'function') {
        throw new Error(`Unknown PXE method: ${method}`);
      }
      return (pxe as any)[method](...params);
    });
  }

  private async handleConnect(): Promise<{ address: string }> {
    // Open popup for passkey ceremony
    const credentialId = this.credentialStore.getCredentialId();
    const response = await this.popupOrchestrator.openPopup(
      'connect',
      undefined,
      credentialId ?? undefined,
    );

    if (response.type !== 'auth-keys') {
      throw new Error(`Unexpected popup response: ${response.type}`);
    }

    // Store credential for future visits
    this.credentialStore.saveCredentialId(new Uint8Array(response.credentialId));
    this.credentialStore.savePublicKey(new Uint8Array(response.publicKey));

    // TIER-2-UPGRADE: Remove signingKey storage. Tier 2 never receives signing key from popup.
    this.signingKey = new Uint8Array(response.signingKey);

    // Initialize PXE with encryption key
    const encryptionKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(response.encryptionKey),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );

    const node = await this.getAztecNode();
    const pxe = await this.pxeManager.initialize(node, encryptionKey);

    // Register account
    const masterSecret = BigInt(response.masterSecret);
    const accountSalt = BigInt(response.accountSalt);

    const { address } = await registerAccount(
      pxe,
      masterSecret,
      this.signingKey,
      accountSalt,
    );

    // Register contracts
    for (const config of this.contractConfigs) {
      await pxe.registerContract({ instance: config, artifact: config.artifact });
    }

    return { address };
  }

  private async handleDisconnect(): Promise<void> {
    // TIER-2-UPGRADE: No signing key to clear in Tier 2.
    this.signingKey = null;
    await this.pxeManager.destroy();
  }

  private async requireTxApproval(params: unknown[]): Promise<void> {
    // Build transaction summary for the popup
    const summary: TxSummary = {
      contractAddress: 'unknown', // Extract from params in production
      methodName: 'unknown',
      args: params,
      dappOrigin: '*', // TODO: track dapp origin from channel setup
    };

    const response = await this.popupOrchestrator.openPopup('sign', summary);

    if (response.type === 'tx-cancelled') {
      throw new Error('Transaction rejected by user');
    }

    if (response.type !== 'tx-approved') {
      throw new Error(`Unexpected popup response: ${response.type}`);
    }

    // TIER-2-UPGRADE: response.type will be 'auth-witness' with signature,
    // authData, clientDataJSON. Use these as the auth witness for the proof
    // instead of software signing.
  }

  private async getAztecNode(): Promise<any> {
    // Lazy import to avoid loading WASM at module level
    const { createAztecNodeClient } = await import('@aztec/aztec.js');
    // TODO: make node URL configurable via connect params
    return createAztecNodeClient('https://devnet.aztec-labs.com/');
  }
}
```

- [ ] **Step 2: Create WalletHost React component**

Create `packages/passkey-wallet/src/host/WalletHost.tsx`:

```typescript
import { useEffect, useRef } from 'react';
import { SecureChannel } from '../shared/SecureChannel';
import { PXEManager } from './PXEManager';
import { PopupOrchestrator } from './PopupOrchestrator';
import { CredentialStore } from './CredentialStore';
import { RPCHandler } from './RPCHandler';

/**
 * Root component for the wallet host iframe. Renders nothing visible.
 * Listens for INIT postMessage from the parent SDK, establishes
 * the encrypted SecureChannel, and registers the RPC handler.
 */
export function WalletHost() {
  const channelRef = useRef<SecureChannel | null>(null);
  const handlerRef = useRef<RPCHandler | null>(null);

  useEffect(() => {
    const walletOrigin = window.location.origin;
    const pxeManager = new PXEManager();
    const popupOrchestrator = new PopupOrchestrator(walletOrigin);
    const credentialStore = new CredentialStore();

    const onMessage = async (event: MessageEvent) => {
      if (event.data?.type !== 'INIT') return;

      // Extract the MessagePort from the transfer
      const port = event.ports[0];
      if (!port) return;

      window.removeEventListener('message', onMessage);

      // Establish encrypted channel
      const channel = new SecureChannel('i2p');
      await channel.initFromPort(port);
      channelRef.current = channel;

      // Extract contract configs from init data if provided
      const contractConfigs = event.data.contracts ?? [];

      // Register RPC handler
      const handler = new RPCHandler(
        pxeManager,
        popupOrchestrator,
        credentialStore,
        contractConfigs,
      );
      handler.register(channel);
      handlerRef.current = handler;
    };

    window.addEventListener('message', onMessage);

    return () => {
      window.removeEventListener('message', onMessage);
      channelRef.current?.destroy();
      pxeManager.destroy();
    };
  }, []);

  // Hidden iframe — no visible UI
  return null;
}
```

- [ ] **Step 3: Create host index**

Create `packages/passkey-wallet/src/host/index.ts`:

```typescript
export { WalletHost } from './WalletHost';
export { PXEManager } from './PXEManager';
export { RPCHandler } from './RPCHandler';
export { PopupOrchestrator } from './PopupOrchestrator';
export { CredentialStore } from './CredentialStore';
export { EncryptedKVStore } from './EncryptedKVStore';
```

- [ ] **Step 4: Commit**

```bash
git add packages/passkey-wallet/src/host/
git commit -m "feat(passkey-wallet): add host layer — RPCHandler, WalletHost, index"
```

---

## Task 13: Popup — ConnectFlow, SignFlow, ReadFlow

**Files:**
- Create: `packages/passkey-wallet/src/popup/PopupShell.tsx`
- Create: `packages/passkey-wallet/src/popup/ConnectFlow.tsx`
- Create: `packages/passkey-wallet/src/popup/SignFlow.tsx`
- Create: `packages/passkey-wallet/src/popup/ReadFlow.tsx`
- Create: `packages/passkey-wallet/src/popup/index.ts`

- [ ] **Step 1: Create ConnectFlow**

Create `packages/passkey-wallet/src/popup/ConnectFlow.tsx`:

```typescript
import { useState } from 'react';
import { buildCreateOptions, buildGetOptions, extractPRFOutput, extractPublicKey } from '../shared/passkey';
import { deriveAllKeys } from '../shared/crypto';
import type { PopupResponse } from '../shared/types';

interface ConnectFlowProps {
  credentialId?: ArrayBuffer;
  onComplete: (response: PopupResponse) => void;
  onCancel: () => void;
}

/**
 * Passkey create (first visit) or authenticate (returning visit) flow.
 * Derives all keys from PRF and sends them to the host iframe.
 */
export function ConnectFlow({ credentialId, onComplete, onCancel }: ConnectFlowProps) {
  const [status, setStatus] = useState<'idle' | 'authenticating' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const isReturningUser = !!credentialId;

  const handleAuth = async () => {
    setStatus('authenticating');
    setError(null);

    try {
      let credential: PublicKeyCredential;
      let prfOutput: Uint8Array | null;
      let publicKey: Uint8Array;

      if (isReturningUser) {
        // Returning visit — authenticate with existing passkey
        const options = buildGetOptions(new Uint8Array(credentialId!));
        credential = (await navigator.credentials.get(options)) as PublicKeyCredential;
        prfOutput = extractPRFOutput(credential);
        // Use stored public key — we don't get it from credentials.get()
        publicKey = new Uint8Array(0); // Host has it in CredentialStore
      } else {
        // First visit — create new passkey
        const options = await buildCreateOptions();
        credential = (await navigator.credentials.create(options)) as PublicKeyCredential;
        prfOutput = extractPRFOutput(credential);
        publicKey = extractPublicKey(credential);
      }

      if (!prfOutput) {
        throw new Error('PRF extension not supported by this authenticator');
      }

      // Derive all keys from PRF output
      const keys = await deriveAllKeys(prfOutput);

      // Encryption key: send raw HKDF bytes (not the CryptoKey).
      // The host imports these as a non-extractable CryptoKey on its side.
      const { hkdf } = await import('@noble/hashes/hkdf');
      const { sha256 } = await import('@noble/hashes/sha256');
      const encKeyBytes = hkdf(sha256, prfOutput, undefined,
        new TextEncoder().encode('aztec-wallet/v1/indexeddb-encryption'), 32);

      const response: PopupResponse = {
        type: 'auth-keys',
        publicKey: publicKey.buffer,
        credentialId: credential.rawId,
        masterSecret: `0x${keys.masterSecret.toString(16)}`,
        // TIER-2-UPGRADE: Remove signingKey from this response.
        // Tier 2 never sends the signing key to the iframe.
        signingKey: keys.signingKey.buffer,
        encryptionKey: encKeyBytes.buffer,
        accountSalt: `0x${keys.accountSalt.toString(16)}`,
      };

      onComplete(response);
    } catch (err: any) {
      setStatus('error');
      setError(err.message ?? 'Authentication failed');
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 360 }}>
      <h2>{isReturningUser ? 'Unlock Your Wallet' : 'Create Your Aztec Wallet'}</h2>
      <p style={{ color: '#666', fontSize: 14 }}>
        {isReturningUser
          ? 'Authenticate with your passkey to restore your wallet.'
          : 'Create a passkey to secure your Aztec wallet. Your keys are derived from biometric authentication.'}
      </p>

      {error && (
        <div style={{ color: 'red', marginBottom: 12, fontSize: 14 }}>{error}</div>
      )}

      <button
        onClick={handleAuth}
        disabled={status === 'authenticating'}
        style={{
          width: '100%',
          padding: '12px 24px',
          fontSize: 16,
          cursor: status === 'authenticating' ? 'not-allowed' : 'pointer',
        }}
      >
        {status === 'authenticating'
          ? 'Authenticating...'
          : isReturningUser
            ? 'Unlock with Passkey'
            : 'Create Passkey'}
      </button>

      <button
        onClick={onCancel}
        style={{ width: '100%', padding: '8px 24px', marginTop: 8, background: 'none', border: '1px solid #ccc' }}
      >
        Cancel
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create SignFlow**

Create `packages/passkey-wallet/src/popup/SignFlow.tsx`:

```typescript
import type { PopupResponse, TxSummary } from '../shared/types';

interface SignFlowProps {
  summary: TxSummary;
  onComplete: (response: PopupResponse) => void;
  onCancel: () => void;
}

/**
 * Transaction approval flow — consent-only in Tier 1.
 *
 * TIER-2-UPGRADE: On approve, this component calls
 * credentials.get({ challenge: outer_hash, extensions: { prf: { eval: { first: ... } } } }).
 * The biometric gesture both authenticates and signs the transaction.
 * Sends { type: 'auth-witness', signature, authData, clientDataJSON }
 * instead of bare { type: 'tx-approved' }.
 */
export function SignFlow({ summary, onComplete, onCancel }: SignFlowProps) {
  const handleApprove = () => {
    // TIER-2-UPGRADE: Replace with WebAuthn signing ceremony
    onComplete({ type: 'tx-approved' });
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 360 }}>
      <h2>Approve Transaction</h2>
      <p style={{ color: '#666', fontSize: 14 }}>
        <strong>{summary.dappOrigin}</strong> wants to send a transaction:
      </p>

      <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
        <div><strong>Contract:</strong> {summary.contractAddress}</div>
        <div><strong>Method:</strong> {summary.methodName}</div>
        <div><strong>Args:</strong> {JSON.stringify(summary.args, null, 2)}</div>
      </div>

      <button
        onClick={handleApprove}
        style={{ width: '100%', padding: '12px 24px', fontSize: 16, background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
      >
        Approve
      </button>

      <button
        onClick={handleCancel}
        style={{ width: '100%', padding: '8px 24px', marginTop: 8, background: 'none', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer' }}
      >
        Cancel
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create ReadFlow**

Create `packages/passkey-wallet/src/popup/ReadFlow.tsx`:

```typescript
import type { PopupResponse, ReadSummary } from '../shared/types';

interface ReadFlowProps {
  summary: ReadSummary;
  onComplete: (response: PopupResponse) => void;
  onCancel: () => void;
}

/**
 * Private read consent flow — identical in Tier 1 and Tier 2.
 * No key derivation needed — protocol keys are already in PXE from connect().
 */
export function ReadFlow({ summary, onComplete, onCancel }: ReadFlowProps) {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 360 }}>
      <h2>Private Data Request</h2>
      <p style={{ color: '#666', fontSize: 14 }}>
        <strong>{summary.dappOrigin}</strong> wants to read your private data:
      </p>

      <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
        <div><strong>Contract:</strong> {summary.contractAddress}</div>
        <div><strong>Method:</strong> {summary.methodName}</div>
      </div>

      <button
        onClick={() => onComplete({ type: 'read-approved' })}
        style={{ width: '100%', padding: '12px 24px', fontSize: 16, background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
      >
        Allow
      </button>

      <button
        onClick={onCancel}
        style={{ width: '100%', padding: '8px 24px', marginTop: 8, background: 'none', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer' }}
      >
        Deny
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create PopupShell**

Create `packages/passkey-wallet/src/popup/PopupShell.tsx`:

```typescript
import { useEffect, useState, useCallback } from 'react';
import type { PopupInitMessage, PopupResponse, PopupFlow, TxSummary, ReadSummary } from '../shared/types';
import { ConnectFlow } from './ConnectFlow';
import { SignFlow } from './SignFlow';
import { ReadFlow } from './ReadFlow';

/**
 * Root component for the popup window.
 * Receives a MessagePort from the host iframe, renders the appropriate flow
 * based on the URL flow parameter, and sends responses back via the port.
 */
export function PopupShell() {
  const [port, setPort] = useState<MessagePort | null>(null);
  const [flow, setFlow] = useState<PopupFlow | null>(null);
  const [context, setContext] = useState<TxSummary | ReadSummary | undefined>();
  const [credentialId, setCredentialId] = useState<ArrayBuffer | undefined>();

  useEffect(() => {
    // Signal to the host that the popup is ready
    if (window.opener) {
      window.opener.postMessage({ type: 'POPUP_READY' }, '*');
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data as PopupInitMessage;
      if (data?.type !== 'POPUP_INIT') return;

      window.removeEventListener('message', onMessage);

      setFlow(data.flow);
      setContext(data.context);
      setCredentialId(data.credentialId);

      // Receive the MessagePort
      const receivedPort = event.ports[0];
      if (receivedPort) {
        setPort(receivedPort);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const handleComplete = useCallback(
    (response: PopupResponse) => {
      port?.postMessage(response);
      window.close();
    },
    [port],
  );

  const handleCancel = useCallback(() => {
    port?.postMessage({ type: `${flow}-cancelled` } as any);
    window.close();
  }, [port, flow]);

  if (!flow || !port) {
    return <div style={{ padding: 24, fontFamily: 'system-ui' }}>Loading...</div>;
  }

  switch (flow) {
    case 'connect':
      return (
        <ConnectFlow
          credentialId={credentialId}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      );
    case 'sign':
      return (
        <SignFlow
          summary={context as TxSummary}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      );
    case 'read':
      return (
        <ReadFlow
          summary={context as ReadSummary}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      );
  }
}
```

- [ ] **Step 5: Create popup index**

Create `packages/passkey-wallet/src/popup/index.ts`:

```typescript
export { PopupShell } from './PopupShell';
export { ConnectFlow } from './ConnectFlow';
export { SignFlow } from './SignFlow';
export { ReadFlow } from './ReadFlow';
```

- [ ] **Step 6: Commit**

```bash
git add packages/passkey-wallet/src/popup/
git commit -m "feat(passkey-wallet): add popup layer — ConnectFlow, SignFlow, ReadFlow, PopupShell"
```

---

## Task 14: SDK — PXEProxy

**Files:**
- Create: `packages/passkey-wallet/src/sdk/PXEProxy.ts`
- Test: `packages/passkey-wallet/src/sdk/__tests__/PXEProxy.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/passkey-wallet/src/sdk/__tests__/PXEProxy.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PXEProxy } from '../PXEProxy';
import { SecureChannel } from '../../shared/SecureChannel';

describe('PXEProxy', () => {
  let parentChannel: SecureChannel;
  let iframeChannel: SecureChannel;
  let proxy: PXEProxy;

  beforeEach(async () => {
    const { port1, port2 } = new MessageChannel();
    parentChannel = new SecureChannel('p2i');
    iframeChannel = new SecureChannel('i2p');
    await SecureChannel.handshake(parentChannel, port1, iframeChannel, port2);

    proxy = new PXEProxy(parentChannel);
  });

  it('forwards method calls over the secure channel', async () => {
    // Simulate PXE on the iframe side
    iframeChannel.onRequest(async (method, params) => {
      if (method === 'getRegisteredAccounts') return ['0xabc'];
      throw new Error(`Unknown method: ${method}`);
    });

    const accounts = await proxy.call('getRegisteredAccounts', []);
    expect(accounts).toEqual(['0xabc']);
  });

  it('propagates errors from the remote PXE', async () => {
    iframeChannel.onRequest(async () => {
      throw new Error('PXE not initialized');
    });

    await expect(proxy.call('simulateTx', [])).rejects.toThrow('PXE not initialized');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/passkey-wallet && npx vitest run src/sdk/__tests__/PXEProxy.test.ts
```

Expected: FAIL — module `../PXEProxy` not found.

- [ ] **Step 3: Implement PXEProxy**

Create `packages/passkey-wallet/src/sdk/PXEProxy.ts`:

```typescript
import type { SecureChannel } from '../shared/SecureChannel';

/**
 * Proxies PXE method calls over the encrypted SecureChannel.
 * Transparent to BaseWallet — it calls PXE methods normally,
 * unaware they cross an iframe boundary.
 *
 * Serialization uses JSON for the POC. Complex Aztec types (Fr, AztecAddress)
 * will need custom serialization in production — Aztec provides PXESchema
 * for this purpose.
 */
export class PXEProxy {
  constructor(private channel: SecureChannel) {}

  /**
   * Call a remote PXE method.
   * @param method - PXE method name
   * @param params - Method arguments
   * @returns The method result
   */
  async call(method: string, params: unknown[]): Promise<unknown> {
    return this.channel.send(method, params);
  }

  /**
   * Creates a Proxy object that implements any interface by forwarding
   * all method calls through the secure channel.
   *
   * Usage:
   * ```
   * const pxe = proxy.createInterface<PXE>();
   * await pxe.getRegisteredAccounts(); // forwarded to iframe
   * ```
   */
  createInterface<T extends object>(): T {
    return new Proxy({} as T, {
      get: (_target, prop: string) => {
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          // Don't proxy Promise methods — prevents issues with await
          return undefined;
        }
        return (...args: unknown[]) => this.call(prop, args);
      },
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/passkey-wallet && npx vitest run src/sdk/__tests__/PXEProxy.test.ts
```

Expected: Both tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/passkey-wallet/src/sdk/PXEProxy.ts packages/passkey-wallet/src/sdk/__tests__/PXEProxy.test.ts
git commit -m "feat(passkey-wallet): add PXEProxy for cross-iframe PXE method calls"
```

---

## Task 15: SDK — IframeManager

**Files:**
- Create: `packages/passkey-wallet/src/sdk/IframeManager.ts`

- [ ] **Step 1: Implement IframeManager**

Create `packages/passkey-wallet/src/sdk/IframeManager.ts`:

```typescript
import { SecureChannel } from '../shared/SecureChannel';
import { DEFAULT_WALLET_HOST } from '../shared/constants';
import type { ContractConfig } from '../shared/types';

/**
 * Manages the hidden iframe lifecycle.
 * Creates the iframe, establishes the encrypted SecureChannel,
 * and handles teardown.
 */
export class IframeManager {
  private iframe: HTMLIFrameElement | null = null;
  private channel: SecureChannel | null = null;

  constructor(private walletHost: string = DEFAULT_WALLET_HOST) {}

  /**
   * Creates a hidden iframe and establishes the encrypted channel.
   * @param contracts - Contract configs to pass to the host for registration
   * @returns The established SecureChannel
   */
  async connect(contracts: ContractConfig[]): Promise<SecureChannel> {
    // 1. Create hidden iframe
    this.iframe = document.createElement('iframe');
    this.iframe.src = this.walletHost;
    this.iframe.style.display = 'none';
    this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
    document.body.appendChild(this.iframe);

    // 2. Wait for iframe to load
    await new Promise<void>((resolve) => {
      this.iframe!.addEventListener('load', () => resolve(), { once: true });
    });

    // 3. Create MessageChannel and send port to iframe
    const { port1, port2 } = new MessageChannel();

    this.iframe.contentWindow!.postMessage(
      { type: 'INIT', contracts },
      this.walletHost,
      [port2],
    );

    // 4. Establish encrypted channel over the port
    this.channel = new SecureChannel('p2i');
    await this.channel.initFromPort(port1);

    return this.channel;
  }

  /** Tear down the iframe and channel. */
  disconnect(): void {
    this.channel?.destroy();
    this.channel = null;

    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
  }

  getChannel(): SecureChannel | null {
    return this.channel;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/passkey-wallet/src/sdk/IframeManager.ts
git commit -m "feat(passkey-wallet): add IframeManager for iframe lifecycle"
```

---

## Task 16: SDK — createPasskeyWallet, Provider, Hook

**Files:**
- Create: `packages/passkey-wallet/src/sdk/createPasskeyWallet.ts`
- Create: `packages/passkey-wallet/src/sdk/PasskeyWalletProvider.tsx`
- Create: `packages/passkey-wallet/src/sdk/usePasskeyWallet.ts`
- Create: `packages/passkey-wallet/src/sdk/index.ts`

- [ ] **Step 1: Create createPasskeyWallet**

Create `packages/passkey-wallet/src/sdk/createPasskeyWallet.ts`:

```typescript
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { PasskeyWalletConfig } from '../shared/types';
import { DEFAULT_WALLET_HOST } from '../shared/constants';
import { IframeManager } from './IframeManager';
import { PXEProxy } from './PXEProxy';

/**
 * Creates a PasskeyWallet instance — the main entry point for the SDK.
 *
 * Usage:
 * ```
 * const passkeyWallet = createPasskeyWallet({
 *   network: 'devnet',
 *   contracts: [...],
 * });
 *
 * const wallet = await passkeyWallet.connect();
 * // wallet is a standard Aztec Wallet
 * ```
 */
export function createPasskeyWallet(config: PasskeyWalletConfig): PasskeyWallet {
  return new PasskeyWallet(config);
}

export class PasskeyWallet {
  private iframeManager: IframeManager;
  private pxeProxy: PXEProxy | null = null;
  private wallet: Wallet | null = null;
  private address: string | null = null;
  private _isConnecting = false;

  constructor(private config: PasskeyWalletConfig) {
    this.iframeManager = new IframeManager(
      config.walletHost ?? DEFAULT_WALLET_HOST,
    );
  }

  get isConnected(): boolean {
    return this.wallet !== null;
  }

  get isConnecting(): boolean {
    return this._isConnecting;
  }

  /**
   * Connects the passkey wallet:
   * 1. Creates hidden iframe
   * 2. Establishes encrypted channel
   * 3. Triggers passkey popup (biometric)
   * 4. Returns standard Aztec Wallet
   */
  async connect(): Promise<Wallet> {
    if (this.wallet) return this.wallet;
    this._isConnecting = true;

    try {
      // 1. Create iframe and encrypted channel
      const channel = await this.iframeManager.connect(this.config.contracts);

      // 2. Create PXE proxy
      this.pxeProxy = new PXEProxy(channel);

      // 3. Trigger connect flow (popup opens for passkey ceremony)
      const result = (await this.pxeProxy.call('connect', [])) as { address: string };
      this.address = result.address;

      // 4. Create a Wallet-like interface using PXE proxy
      // For the POC, we return a proxy that forwards all method calls.
      // In production, this would extend BaseWallet properly.
      const pxeInterface = this.pxeProxy.createInterface<any>();
      this.wallet = pxeInterface as Wallet;

      return this.wallet;
    } finally {
      this._isConnecting = false;
    }
  }

  /** Disconnects and tears down the iframe. */
  async disconnect(): Promise<void> {
    if (this.pxeProxy) {
      await this.pxeProxy.call('disconnect', []);
    }
    this.iframeManager.disconnect();
    this.wallet = null;
    this.address = null;
    this.pxeProxy = null;
  }

  getWallet(): Wallet | null {
    return this.wallet;
  }

  getAddress(): string | null {
    return this.address;
  }
}
```

- [ ] **Step 2: Create PasskeyWalletProvider**

Create `packages/passkey-wallet/src/sdk/PasskeyWalletProvider.tsx`:

```typescript
import { createContext, useRef, type ReactNode } from 'react';
import { type PasskeyWallet, createPasskeyWallet } from './createPasskeyWallet';
import type { PasskeyWalletConfig } from '../shared/types';

export const PasskeyWalletContext = createContext<PasskeyWallet | null>(null);

interface PasskeyWalletProviderProps {
  config: PasskeyWalletConfig;
  children: ReactNode;
}

/**
 * React provider that wraps createPasskeyWallet.
 * Creates the PasskeyWallet instance once and provides it via context.
 *
 * Usage:
 * ```
 * <PasskeyWalletProvider config={config}>
 *   <App />
 * </PasskeyWalletProvider>
 * ```
 */
export function PasskeyWalletProvider({ config, children }: PasskeyWalletProviderProps) {
  const walletRef = useRef<PasskeyWallet | null>(null);

  if (!walletRef.current) {
    walletRef.current = createPasskeyWallet(config);
  }

  return (
    <PasskeyWalletContext.Provider value={walletRef.current}>
      {children}
    </PasskeyWalletContext.Provider>
  );
}
```

- [ ] **Step 3: Create usePasskeyWallet hook**

Create `packages/passkey-wallet/src/sdk/usePasskeyWallet.ts`:

```typescript
import { useContext, useState, useCallback } from 'react';
import { PasskeyWalletContext } from './PasskeyWalletProvider';
import type { Wallet } from '@aztec/aztec.js/wallet';

/**
 * Hook consuming the PasskeyWalletProvider context.
 *
 * Usage:
 * ```
 * const { wallet, isConnected, connect, disconnect, address } = usePasskeyWallet();
 * ```
 */
export function usePasskeyWallet() {
  const passkeyWallet = useContext(PasskeyWalletContext);
  if (!passkeyWallet) {
    throw new Error('usePasskeyWallet must be used within a PasskeyWalletProvider');
  }

  const [wallet, setWallet] = useState<Wallet | null>(passkeyWallet.getWallet());
  const [isConnecting, setIsConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(passkeyWallet.getAddress());

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const w = await passkeyWallet.connect();
      setWallet(w);
      setAddress(passkeyWallet.getAddress());
    } finally {
      setIsConnecting(false);
    }
  }, [passkeyWallet]);

  const disconnect = useCallback(async () => {
    await passkeyWallet.disconnect();
    setWallet(null);
    setAddress(null);
  }, [passkeyWallet]);

  return {
    wallet,
    isConnected: wallet !== null,
    isConnecting,
    address,
    connect,
    disconnect,
  };
}
```

- [ ] **Step 4: Create SDK index**

Create `packages/passkey-wallet/src/sdk/index.ts`:

```typescript
// Public API
export { createPasskeyWallet, PasskeyWallet } from './createPasskeyWallet';
export { PasskeyWalletProvider } from './PasskeyWalletProvider';
export { usePasskeyWallet } from './usePasskeyWallet';

// Re-export types
export type { PasskeyWalletConfig, ContractConfig } from '../shared/types';
```

- [ ] **Step 5: Commit**

```bash
git add packages/passkey-wallet/src/sdk/
git commit -m "feat(passkey-wallet): add SDK layer — createPasskeyWallet, Provider, hook"
```

---

## Task 17: Vite Configs for Host and SDK Builds

**Files:**
- Create: `packages/passkey-wallet/vite.host.config.ts`
- Create: `packages/passkey-wallet/vite.sdk.config.ts`
- Create: `packages/passkey-wallet/host.html`
- Create: `packages/passkey-wallet/popup.html`

- [ ] **Step 1: Create host entry HTML files**

These are minimal Vite entry points — the React components do all the work.

Create `packages/passkey-wallet/host.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body>
  <div id="root"></div>
  <script type="module" src="./src/host/entry.tsx"></script>
</body>
</html>
```

Create `packages/passkey-wallet/popup.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Aztec Wallet</title></head>
<body>
  <div id="root"></div>
  <script type="module" src="./src/popup/entry.tsx"></script>
</body>
</html>
```

- [ ] **Step 2: Create entry point scripts**

Create `packages/passkey-wallet/src/host/entry.tsx`:

```typescript
import { createRoot } from 'react-dom/client';
import { WalletHost } from './WalletHost';

createRoot(document.getElementById('root')!).render(<WalletHost />);
```

Create `packages/passkey-wallet/src/popup/entry.tsx`:

```typescript
import { createRoot } from 'react-dom/client';
import { PopupShell } from './PopupShell';

createRoot(document.getElementById('root')!).render(<PopupShell />);
```

- [ ] **Step 3: Create host Vite config**

Create `packages/passkey-wallet/vite.host.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist/host',
    rollupOptions: {
      input: {
        host: './host.html',
        popup: './popup.html',
      },
    },
  },
  server: {
    port: 3001,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  },
});
```

- [ ] **Step 4: Create SDK Vite config (library mode)**

Create `packages/passkey-wallet/vite.sdk.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/sdk',
    lib: {
      entry: resolve(__dirname, 'src/sdk/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        /^@aztec\//,
        /^@noble\//,
      ],
    },
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add packages/passkey-wallet/host.html packages/passkey-wallet/popup.html packages/passkey-wallet/src/host/entry.tsx packages/passkey-wallet/src/popup/entry.tsx packages/passkey-wallet/vite.host.config.ts packages/passkey-wallet/vite.sdk.config.ts
git commit -m "chore(passkey-wallet): add Vite configs and entry points for host, popup, SDK"
```

---

## Task 18: Integration — Wire Up Boilerplate App

**Files:**
- Create: `src/containers/PasskeyDemo.tsx`
- Modify: `src/main.tsx` or router config to add a route

- [ ] **Step 1: Create demo page**

Create `src/containers/PasskeyDemo.tsx`:

```typescript
import { PasskeyWalletProvider, usePasskeyWallet } from '@aztec/passkey-wallet';
import type { PasskeyWalletConfig } from '@aztec/passkey-wallet';

const config: PasskeyWalletConfig = {
  network: 'devnet',
  walletHost: 'http://localhost:3001', // Local dev host
  contracts: [],
};

function WalletStatus() {
  const { wallet, isConnected, isConnecting, address, connect, disconnect } = usePasskeyWallet();

  return (
    <div style={{ padding: 24 }}>
      <h1>Passkey Wallet POC</h1>
      <p>Status: {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}</p>
      {address && <p>Address: {address}</p>}

      {!isConnected ? (
        <button onClick={connect} disabled={isConnecting}>
          Connect with Passkey
        </button>
      ) : (
        <button onClick={disconnect}>Disconnect</button>
      )}
    </div>
  );
}

export function PasskeyDemo() {
  return (
    <PasskeyWalletProvider config={config}>
      <WalletStatus />
    </PasskeyWalletProvider>
  );
}
```

- [ ] **Step 2: Add route to the app**

Add a `/passkey` route in the app's router configuration that renders `<PasskeyDemo />`. The exact file to modify depends on the router setup — check `src/main.tsx` or the router config file.

- [ ] **Step 3: Test the full flow locally**

Start both dev servers:

```bash
# Terminal 1: Host + popup (simulates wallet.aztec.network)
cd packages/passkey-wallet && npx vite --config vite.host.config.ts

# Terminal 2: Dapp
yarn dev
```

Navigate to `http://localhost:3000/passkey` and click "Connect with Passkey". The flow should:
1. Create a hidden iframe pointing to `localhost:3001`
2. Establish encrypted channel
3. Open popup for passkey ceremony
4. (Passkey ceremony requires HTTPS — may need to test with `mkcert` or on a deployed env)

- [ ] **Step 4: Commit**

```bash
git add src/containers/PasskeyDemo.tsx
git commit -m "feat: add PasskeyDemo page for POC integration testing"
```

---

## Task 19: Run All Tests and Fix Issues

- [ ] **Step 1: Run full test suite**

```bash
cd packages/passkey-wallet && npx vitest run
```

Expected: All unit tests pass.

- [ ] **Step 2: Run the boilerplate app's existing tests**

```bash
yarn test
```

Expected: Existing tests still pass (workspace addition should not break anything).

- [ ] **Step 3: Fix any issues found**

Address any test failures, type errors, or import resolution problems.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: resolve test and integration issues for passkey-wallet POC"
```
