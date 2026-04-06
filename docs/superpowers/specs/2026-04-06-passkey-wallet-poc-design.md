# Passkey Wallet SDK — POC Design Spec

**Date:** 2026-04-06
**Branch:** passkey
**Scope:** Tier 1 (PRF-derived software signing) — full SDK infrastructure rails without custom Noir account contract

## Overview

A universal Aztec wallet delivered as an embeddable iframe — functionally equivalent to a browser extension wallet but with zero install. Authentication via passkeys (Face ID / Touch ID / fingerprint). Protocol keys derived from passkey PRF. One passkey = one wallet = one address across all dapps.

This POC builds the complete SDK infrastructure: iframe + popup architecture, encrypted MessagePort channel, passkey ceremonies with PRF key derivation, CompositeKVStore integration, PXE proxy, and a React SDK that returns a standard Aztec `Wallet` object. The custom Noir account contract with WebAuthn envelope verification is deferred to Tier 2.

### Tier 1 vs Tier 2

**Tier 1 (this POC):** PRF derives a P-256 signing key that lives in JS memory inside the iframe. Transactions are signed in software with `@noble/curves/p256`. One biometric at connect, then frictionless transactions for the session. Uses existing `EcdsaRAccountContract`.

**Tier 2 (future):** The signing key never enters JavaScript. Each transaction triggers a WebAuthn ceremony where the secure element signs the outer hash directly. Requires a custom Noir contract that parses the WebAuthn envelope (authenticatorData + clientDataJSON) inside ZK circuits.

Every Tier 1 divergence point is marked with `// TIER-2-UPGRADE:` comments explaining what changes.

### Security Trade-offs (Tier 1)

| Threat | Tier 2 (future) | Tier 1 (this POC) |
|--------|-----------------|---------------------|
| XSS on **dapp** origin | Safe (iframe boundary) | Safe (iframe boundary) |
| XSS on **iframe** origin | Can't steal signing key (hardware-bound) | **Can steal signing key** (in JS memory) |
| Malicious browser extension | Can't sign txs | **Can sign txs** if it reaches iframe context |
| Per-tx biometric | Yes (WebAuthn ceremony) | No (consent popup only) |

The iframe's cross-origin isolation protects against the most common vector (dapp XSS). The iframe origin (`wallet.aztec.network`) is a much smaller, more controlled attack surface.

## Architecture

```
┌─────────────────────────────┐      ┌─────────────────────────────────────────────┐
│  dapp-a.com                 │      │  wallet.aztec.network (iframe in dapp-a)    │
│                             │      │                                             │
│  PasskeyWalletProvider      │      │  WalletHost (hidden, no UI)                │
│    └─ usePasskeyWallet()    │      │    ├─ PXE (WASM proving, note sync)        │
│       └─ Wallet (standard)  │      │    ├─ CompositeKVStore                     │
│          └─ PXEProxy ──────────────────→ RPCHandler → real PXE                  │
│             (SecureChannel) │      │    ├─ AccountManager (EcdsaR)              │
│                             │      │    └─ PopupOrchestrator                    │
└─────────────────────────────┘      │         │                                  │
                                     └─────────│──────────────────────────────────┘
                                               │
                                     ┌─────────▼──────────────────────────────────┐
                                     │  wallet.aztec.network/auth (popup)         │
                                     │  ConnectFlow: passkey ceremony + PRF       │
                                     │  SignFlow: tx approval (consent only)      │
                                     │  ReadFlow: private read consent            │
                                     └────────────────────────────────────────────┘
```

## Package Structure

```
packages/passkey-wallet/
├── src/
│   ├── sdk/
│   │   ├── createPasskeyWallet.ts      # Factory function
│   │   ├── PasskeyWalletProvider.tsx    # React provider
│   │   ├── usePasskeyWallet.ts         # React hook
│   │   ├── PXEProxy.ts                 # PXE interface over SecureChannel
│   │   ├── IframeManager.ts            # Iframe lifecycle
│   │   └── index.ts                    # Public exports
│   ├── host/
│   │   ├── WalletHost.tsx              # Root component (hidden, no UI)
│   │   ├── RPCHandler.ts               # PXE method proxy + popup gates
│   │   ├── PXEManager.ts              # PXE lifecycle (CompositeKVStore, encrypted IndexedDB)
│   │   ├── AccountManager.ts           # EcdsaR account setup
│   │   │                               # TIER-2-UPGRADE: Swap to PasskeyAccountContract
│   │   ├── PopupOrchestrator.ts        # Opens/manages popup windows
│   │   ├── CredentialStore.ts          # credentialId + publicKey in IndexedDB
│   │   └── index.ts                    # Host app entry
│   ├── popup/
│   │   ├── PopupShell.tsx              # Root component, routes by flow param
│   │   ├── ConnectFlow.tsx             # Passkey create/authenticate + PRF
│   │   ├── SignFlow.tsx                # Tx approval (consent only)
│   │   │                               # TIER-2-UPGRADE: Adds WebAuthn signing ceremony
│   │   ├── ReadFlow.tsx                # Private read consent
│   │   └── index.ts                    # Popup app entry
│   └── shared/
│       ├── SecureChannel.ts            # ECDH + AES-256-GCM MessagePort
│       ├── crypto.ts                   # HKDF key derivation
│       ├── passkey.ts                  # WebAuthn ceremony wrappers
│       ├── types.ts                    # RPC types, PopupRequest types
│       └── constants.ts               # PRF salts, HKDF info strings, RP ID
├── package.json
├── tsconfig.json
└── vite.config.ts                      # Builds: SDK (library), host app, popup app
```

## Shared Layer

### SecureChannel

Encrypted point-to-point communication over MessagePort. Replaces broadcast `postMessage` to prevent eavesdropping by content scripts or other listeners.

**Setup sequence:**
1. SDK sends `postMessage({ type: 'INIT' }, [port2])` to iframe
2. Both sides exchange ephemeral ECDH public keys (JWK) over the port
3. Both derive shared secret via ECDH, then HKDF into two AES-256-GCM keys:
   - `parentToIframeKey` (SDK → host direction)
   - `iframeToParentKey` (host → SDK direction)
4. All subsequent messages encrypted with direction-appropriate key

**Message format:**
```typescript
interface ChannelMessage {
  id: string;        // crypto.randomUUID() — bound as AAD
  dir: 'p2i' | 'i2p';
  iv: Uint8Array;    // 12 bytes, random per message
  ct: Uint8Array;    // AES-256-GCM ciphertext
  version: 1;
}
```

**Security properties:**
- Point-to-point: invisible to `window.addEventListener('message')` listeners
- Forward secrecy: new ECDH key pair per page load
- Direction separation: prevents cross-direction nonce collision
- UUID as AAD: replay protection via GCM additional authenticated data

### Crypto (Key Derivation)

All keys derived from a single 32-byte PRF output using HKDF-SHA-256 with distinct info strings:

```typescript
// Protocol keys — viewing, nullifier, tagging, outgoing
HKDF(ikm=PRF, salt=none, info="aztec-wallet/v1/master-secret", length=48)
→ Fr.fromBufferReduce(48 bytes) → masterSecret
→ deriveKeys(masterSecret) // @aztec/aztec.js — produces nhk_m, ivsk_m, ovsk_m, tsk_m

// P-256 signing key
// TIER-2-UPGRADE: Remove entirely. Tier 2 uses hardware-bound WebAuthn signing.
HKDF(ikm=PRF, salt=none, info="aztec-wallet/v1/p256-signing-key", length=48)
→ mod P-256 order → signingKey
→ p256.getPublicKey(signingKey, false) → uncompressed public key (65 bytes)

// IndexedDB encryption key
HKDF(ikm=PRF, salt=none, info="aztec-wallet/v1/indexeddb-encryption", length=32)
→ crypto.subtle.importKey("raw", ..., "AES-GCM", false, ["encrypt", "decrypt"])
→ non-extractable CryptoKey

// Account salt — deterministic address
HKDF(ikm=PRF, salt=none, info="aztec-wallet/v1/account-salt", length=48)
→ Fr.fromBufferReduce(48 bytes) → accountSalt
```

48-byte derivation before `Fr.fromBufferReduce` eliminates the ~17.6% bias that 32-byte input produces (per RFC 9380).

### Passkey (WebAuthn Ceremonies)

**Credential creation** (first visit):
```typescript
const accountIndex = 0; // v1: always 0
const prfSalt = `aztec-wallet/v1/account/${accountIndex}`;
const userId = new Uint8Array(
  await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prfSalt))
);

navigator.credentials.create({
  publicKey: {
    rp: { id: "aztec.network", name: "Aztec Wallet" },
    user: { id: userId, name: "user", displayName: "Aztec User" },
    pubKeyCredParams: [{ alg: -7, type: "public-key" }],  // ES256 / P-256
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
    extensions: { prf: {} },
  },
});
```

**Authentication** (returning visit):
```typescript
// TIER-2-UPGRADE: Add challenge param. credentials.get({ challenge: outer_hash })
// becomes the signing ceremony, not just PRF extraction.
navigator.credentials.get({
  publicKey: {
    allowCredentials: [{ id: credentialId }],
    userVerification: "preferred",
    extensions: {
      prf: {
        eval: { first: new TextEncoder().encode("aztec-wallet/v1/master-key") },
      },
    },
  },
});
```

Returns `credentialId`, P-256 public key (from create), and PRF output (32 bytes from `response.getClientExtensionResults().prf.results.first`).

### Types

```typescript
// Custom RPC methods (only connect/disconnect are non-PXE)
interface PasskeyWalletRPC {
  connect: () => Promise<{ address: string }>;
  disconnect: () => Promise<void>;
}

// All other operations go through standard PXE interface proxy.
// The PXEProxy implements the PXE interface and forwards every method
// call over the SecureChannel to the real PXE in the iframe.

// Popup communication types
type PopupRequest =
  | { type: 'auth-keys'; publicKey: Uint8Array; credentialId: Uint8Array;
      masterSecret: bigint; signingKey: Uint8Array; encryptionKey: Uint8Array; accountSalt: bigint }
      // TIER-2-UPGRADE: Remove signingKey from this type
  | { type: 'tx-approved' }
      // TIER-2-UPGRADE: Changes to { type: 'auth-witness'; signature: Uint8Array;
      //   authData: Uint8Array; clientDataJSON: Uint8Array }
  | { type: 'tx-cancelled' }
  | { type: 'read-approved' }
  | { type: 'read-cancelled' };
```

## Host Layer

### WalletHost (React Component)

Root component rendered inside the iframe. No visible UI. On mount:
1. Listens for `INIT` postMessage from parent SDK
2. Establishes SecureChannel via transferred MessagePort
3. Registers RPC handler for incoming messages

### PXEManager

Manages PXE lifecycle using existing infrastructure:

- **CompositeKVStore** (already built in `src/aztec-wallet/services/storage/`): routes `key_store`, `complete_addresses`, `complete_address_index` to InMemoryKVStore (RAM), everything else to encrypted IndexedDB
- **Encrypted IndexedDB**: wraps standard Aztec KV store with AES-256-GCM using the PRF-derived encryption key. Encryption/decryption transparent to PXE.
- **PXE initialization**: `createPXEService(node, { store: compositeStore })`
- **Teardown**: clears RAM store, PXE instance garbage collected

### RPCHandler

Processes messages from SDK over SecureChannel:

- **`connect`**: opens popup (connect flow), receives derived keys, initializes PXE with CompositeKVStore, registers account, registers contracts, returns address
- **`disconnect`**: tears down PXE, clears RAM store, removes credential state
- **PXE method proxy**: all other calls forwarded directly to the PXE instance. Popup gates injected at `proveTx`/`sendTx` (tx approval) and private read methods (read consent).

### AccountManager

```typescript
// TIER-2-UPGRADE: Replace EcdsaRAccountContract with PasskeyAccountContract.
// PasskeyAccountContract verifies WebAuthn envelope in Noir circuits.
// The witness provider changes from software p256.sign() to WebAuthn
// signature + authenticatorData + clientDataJSON from the popup.

import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa';

// Uses PRF-derived P-256 signing key for witness generation
// TIER-2-UPGRADE: Remove signingKey parameter. Tier 2 gets witness from popup.
function createAccountContract(signingKey: Uint8Array): EcdsaRAccountContract {
  return new EcdsaRAccountContract(signingKey);
}
```

Account deployment is lazy — address computed deterministically from `masterSecret + contractClassId + constructorArgs + accountSalt`. Deployment happens on first `sendTx`.

### PopupOrchestrator

Opens popup windows for user interaction:
- `openPopup(flow: 'connect' | 'sign' | 'read', context?: TxSummary)`
- Creates a new MessageChannel per popup
- Transfers port to popup via `popup.postMessage({ type: 'POPUP_INIT', port }, walletOrigin, [port])` (strict origin check, no wildcard)
- Returns a promise that resolves with the popup's response or rejects on cancel/close
- Detects popup close via polling `popup.closed`

### CredentialStore

Stores public, unencrypted data in IndexedDB:
- `credentialId` — used to skip passkey picker on returning visits
- P-256 public key — used to verify account identity
- If cleared, user re-authenticates (passkey is discoverable)

## Popup Layer

### PopupShell (React Component)

Root component for the popup window. On mount:
- Receives MessagePort from host iframe via `window.addEventListener('message')`
- Reads `flow` URL parameter to determine which screen to render
- Auto-closes after task completion

### ConnectFlow

**First visit** — "Create your Aztec wallet":
1. Calls `createPasskeyCredential(accountIndex=0)` → biometric prompt
2. Extracts PRF output from `response.getClientExtensionResults().prf.results.first`
3. Derives all keys via HKDF (masterSecret, signingKey, encryptionKey, accountSalt)
4. Sends `{ type: 'auth-keys', ... }` to host via MessagePort
5. Closes

**Returning visit** — "Unlock your wallet":
1. Calls `authenticatePasskey(credentialId)` → biometric prompt
2. Same PRF extraction and key derivation
3. Same payload to host
4. Closes

### SignFlow

Transaction approval — consent only in Tier 1:
1. Receives transaction summary from host (contract address, method, args, dapp origin)
2. Displays approval UI: "dapp-a.com wants to send a transaction" with details
3. **Approve** → sends `{ type: 'tx-approved' }` → closes
4. **Cancel** → sends `{ type: 'tx-cancelled' }` → closes

```
// TIER-2-UPGRADE: On approve, calls credentials.get({ challenge: outer_hash,
// extensions: { prf: { eval: { first: ... } } } }). The biometric gesture both
// authenticates and signs. Sends { type: 'auth-witness', signature, authData,
// clientDataJSON } instead of bare approval. The iframe uses this witness
// directly in the proof — no software signing.
```

### ReadFlow

Private read consent:
1. Receives read summary (contract, method, dapp origin)
2. "dapp-a.com wants to read your private balance"
3. Approve / Cancel
4. No change between Tier 1 and Tier 2 — consent-only in both.

## SDK Layer

### createPasskeyWallet(config)

Factory function — the main entry point:

```typescript
interface PasskeyWalletConfig {
  network: 'devnet' | 'sandbox';
  walletHost?: string;  // defaults to 'https://wallet.aztec.network'
  contracts: ContractConfig[];
}

interface ContractConfig {
  artifact: ContractArtifact;
  salt: Fr;
  deployer: AztecAddress;
  constructorArtifact: string;
  constructorArgs: any[];
}

function createPasskeyWallet(config: PasskeyWalletConfig): PasskeyWallet;
```

`PasskeyWallet` instance:
- `connect(): Promise<Wallet>` — creates iframe, establishes SecureChannel, triggers popup, returns standard Aztec `Wallet`
- `disconnect(): Promise<void>` — tears down iframe, clears state
- `getWallet(): Wallet | null` — returns wallet if connected

### PasskeyWalletProvider

React context provider:

```tsx
<PasskeyWalletProvider config={config}>
  <App />
</PasskeyWalletProvider>
```

Creates `PasskeyWallet` once on mount, provides it via context.

### usePasskeyWallet()

Hook consuming the provider:

```typescript
const {
  wallet,        // Wallet | null — standard Aztec Wallet
  isConnected,   // boolean
  isConnecting,  // boolean
  address,       // string | null
  connect,       // () => Promise<void>
  disconnect,    // () => Promise<void>
} = usePasskeyWallet();
```

### PXEProxy

Implements the `PXE` interface. Every method call:
1. Serializes method name + args using Aztec's `JsonRpcServer`/`JsonRpcClient` serialization (handles Fr, AztecAddress, Buffer, bigint natively)
2. Encrypts via SecureChannel
3. Sends to iframe over MessagePort
4. Awaits encrypted response
5. Deserializes using the same Aztec JSON-RPC codec and returns

Transparent to `BaseWallet` — it calls PXE methods normally, unaware they cross an iframe boundary. Aztec already provides `PXESchema` which defines the serialization schema for every PXE method — the proxy uses this to serialize/deserialize correctly.

## Storage

### CompositeKVStore (already built)

Routes stores by name:
- **RAM** (`InMemoryKVStore`): `key_store`, `complete_addresses`, `complete_address_index`
- **Encrypted IndexedDB**: everything else (notes, contracts, sync state)

RAM keys are garbage collected on page close. Never written to disk. Re-derived from passkey PRF on next session.

### Encrypted IndexedDB

Wraps the standard Aztec IndexedDB store:
- Encrypts values with AES-256-GCM using the PRF-derived encryption key
- Decryption transparent to PXE — it reads/writes normally
- Key is non-extractable CryptoKey (WebCrypto)
- On returning visit: PRF re-derives the same encryption key, existing cache is decryptable

## Flows

### Connection (first visit)

1. Dapp: `await passkeyWallet.connect()`
2. SDK creates hidden iframe (`wallet.aztec.network`)
3. SDK establishes SecureChannel (ECDH + AES-256-GCM over MessagePort)
4. SDK sends `connect` over channel
5. Host opens popup (`/auth?flow=connect`)
6. Popup: `credentials.create()` + PRF → biometric
7. Popup: HKDF → masterSecret, signingKey, encryptionKey, accountSalt
8. Popup sends keys to host via MessagePort → closes
9. Host: initializes PXE with CompositeKVStore (encryption key for IndexedDB)
10. Host: `pxe.registerAccount(masterSecret)` → protocol keys in RAM
11. Host: registers contracts from config
12. Host: returns `{ address }` to SDK over channel
13. SDK: constructs `Wallet` (BaseWallet + PXEProxy) → returns to dapp

### Connection (returning visit)

Same as above, except:
- Step 6: `credentials.get({ allowCredentials: [credentialId] })` instead of create
- Step 9: PXE decrypts existing IndexedDB cache → resumes from checkpoint (faster sync)

### Transaction

1. Dapp: `await token.methods.transfer(to, amount).send()`
2. `Wallet.sendTx()` → `BaseWallet` handles simulation, fee estimation
3. `BaseWallet` calls `PXEProxy.proveTx(...)`
4. PXEProxy sends over SecureChannel to host
5. Host RPCHandler intercepts: opens popup (`/auth?flow=sign`) with tx summary
6. Popup: user approves → `{ type: 'tx-approved' }` → closes
7. Host: signs with `p256.sign(outerHash, signingKey)` — `// TIER-2-UPGRADE: popup returns WebAuthn witness instead`
8. Host: PXE proves tx with auth witness
9. Host: submits proven tx to Aztec node
10. Host: returns txHash to SDK over channel
11. SDK: returns receipt to dapp

### Private Read

1. Dapp: `await token.methods.balance_of_public(address).simulate()`
2. PXEProxy forwards to host
3. Host intercepts: opens popup (`/auth?flow=read`) with read summary
4. Popup: user approves → closes
5. Host: PXE executes with protocol keys (already in RAM) → returns result

## Development Setup

**Local development (two Vite servers):**
- Port 3000: existing boilerplate app (dapp), imports `packages/passkey-wallet/sdk`
- Port 3001: host + popup Vite dev server (simulates `wallet.aztec.network`)
- Yarn workspace links the package

**Vite builds three outputs:**
1. **SDK** — library mode (`dist/sdk/`), what dapps bundle
2. **Host** — app mode (`dist/host/`), deployed to wallet origin
3. **Popup** — app mode (`dist/popup/`), deployed to wallet origin

**Dependencies:**
- `@aztec/aztec.js` — Wallet, PXE, Fr, AztecAddress
- `@aztec/wallet-sdk` — BaseWallet
- `@aztec/accounts` — EcdsaRAccountContract — `// TIER-2-UPGRADE: Remove, use custom contract`
- `@aztec/kv-store` — KV store interfaces
- `@aztec/pxe` — createPXEService
- `@noble/hashes` — HKDF-SHA-256
- `@noble/curves` — P-256 signing — `// TIER-2-UPGRADE: Remove, signing is hardware-bound`
- `react` — peer dep

## Tier 2 Upgrade Summary

All Tier 1 divergence points are marked with `// TIER-2-UPGRADE:` in code. The upgrade touches:

| Component | Tier 1 (POC) | Tier 2 Change |
|-----------|-------------|---------------|
| `shared/crypto.ts` | Derives signingKey via HKDF | Remove signingKey derivation |
| `shared/types.ts` | `tx-approved` popup response | `auth-witness` with WebAuthn signature |
| `shared/passkey.ts` | `credentials.get()` for PRF only | Add `challenge: outer_hash` for signing |
| `host/AccountManager.ts` | EcdsaRAccountContract | Custom PasskeyAccountContract (Noir) |
| `host/RPCHandler.ts` | `p256.sign()` in JS | Forward WebAuthn witness from popup |
| `popup/SignFlow.tsx` | Consent-only approval | WebAuthn ceremony with challenge |
| `popup/ConnectFlow.tsx` | Sends signingKey to host | Omits signingKey |
| `package.json` | `@aztec/accounts`, `@noble/curves` | Remove both deps |

The iframe, encrypted channel, PRF key derivation, PXE proxy, SDK API, React provider, and storage layer carry forward unchanged.
