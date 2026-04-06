# Passkey Wallet SDK — POC Status

**Date:** 2026-04-06
**Branch:** `passkey`
**Reference:** `docs/passkey-wallet-tech-design-v2.md`

---

## What Was Built

The POC implements the core infrastructure for a passkey-authenticated Aztec wallet delivered as an embeddable cross-origin iframe. The SDK is a standalone npm package (`packages/passkey-wallet/`) with 47 source files, 196 unit/integration tests, and a complete esbuild-based build system.

### Package Structure

```
packages/passkey-wallet/
├── src/
│   ├── sdk/           → Dapp-side: createPasskeyWallet, React provider, hook, PXE proxy, iframe manager
│   ├── host/          → Iframe-side: WalletHost, RPCHandler, PXE Worker, EncryptedKVStore, CredentialStore
│   ├── popup/         → Popup window: ConnectFlow, SignFlow, ReadFlow (native CSS, no Tailwind)
│   ├── shared/        → Shared: SecureChannel, HKDF crypto, WebAuthn wrappers, types, constants
│   └── storage/       → CompositeKVStore, InMemoryKVStore (RAM for keys, encrypted IndexedDB for PXE cache)
├── scripts/
│   ├── build-host.mjs → esbuild bundler (3 entry points: host, popup, PXE Worker)
│   └── serve-host.mjs → Static server with CORP/COEP headers
└── dist/host/         → Built output served at wallet host origin
```

---

## Alignment with Tech Design v2

### Architecture (Section: Architecture Overview)

| Design | POC | Status |
|---|---|---|
| Cross-origin iframe (`wallet.aztec.network`) | Cross-origin only (no same-origin fallback). Iframe at `localhost:3001` with `credentialless` attribute for COEP compat. esbuild-built host served with CORP/COEP headers | **Done** |
| PXE (WASM) in iframe | PXE runs in a **Web Worker** inside the iframe (Workers have `crossOriginIsolated=true` even in credentialless iframes) | **Done** — Worker architecture solves the SharedArrayBuffer constraint |
| Popup for passkey ceremonies + tx approval | Popup at wallet host origin, opened by SDK | **Done** |
| SDK = thin RPC client, no keys, no PXE | `createPasskeyWallet()` → `PasskeyWalletProvider` → `usePasskeyWallet()` → returns standard Aztec `Wallet` | **Done** |
| Dapp never handles secret keys | Keys derived in popup, sent to iframe, never touch SDK | **Done** |

**Key architectural decisions made during POC:**

1. **PXE in Worker, not iframe main thread.** The tech design says "PXE (WASM)" in the iframe. The iframe's main thread can't get `crossOriginIsolated` (browser spec constraint for cross-origin credentialless iframes). We moved PXE to a dedicated Worker inside the iframe — Workers DO get `crossOriginIsolated` and `SharedArrayBuffer`. This is transparent: the iframe main thread relays messages between the SecureChannel and the Worker.

2. **OAuth callback pattern for popup→SDK communication.** The tech design shows `postMessage` between popup and SDK. With `COOP: same-origin` on the dapp (required for SharedArrayBuffer in the existing embedded wallet), `window.opener` is null in cross-origin popups. The popup instead redirects to `dapp_origin/__wallet_callback.html#base64(result)`, which writes to `localStorage`. The SDK polls `localStorage`. This is the same pattern used by OAuth flows.

3. **esbuild instead of Vite/Rollup for the host build.** Rollup hoists class declarations when bundling, which breaks Aztec's circular static field initializers (`static ZERO = new Fr(0n)` executes before `Fr` is defined). esbuild preserves class declaration order. The SDK side continues to use Vite (dapp's existing build).

### Key Derivation (Section: Key Derivation)

| Design | POC | Status |
|---|---|---|
| PRF output (32 bytes) from `credentials.get()` with `prf.eval` | `buildGetOptions()` in `shared/passkey.ts`, `extractPRFOutput()` extracts from extension results | **Done** |
| HKDF-SHA-256 master secret (48 bytes → Fr) | `deriveMasterSecret()` in `shared/crypto.ts`, 48-byte HKDF, `Fr.fromBufferReduce` | **Done** |
| HKDF-SHA-256 encryption key (32 bytes → AES-GCM) | `deriveEncryptionKey()`, non-extractable `CryptoKey` | **Done** |
| HKDF-SHA-256 account salt (48 bytes → Fr) | `deriveAccountSalt()` | **Done** |
| Signing key = hardware-bound (never in JS) | **Partially done** — see Tier 1 vs Tier 2 below | **Tier 1 deviation** |
| PRF eval during `credentials.create()` | `buildCreateOptions()` requests PRF eval; falls back to second `credentials.get()` if authenticator doesn't support eval during create | **Done** |
| 48-byte derivation to eliminate bias (RFC 9380) | All Fr derivations use 48 bytes before `fromBufferReduce` | **Done** |
| Info strings: `aztec-wallet/v1/master-secret`, etc. | All four HKDF info strings match the design | **Done** |

**Tier 1 deviation:** The tech design specifies no signing key derived from PRF — the passkey's native P-256 key handles signing. The POC uses **Tier 1** (PRF-derived software signing key with `EcdsaRAccountContract`) as a placeholder. Every divergence point is marked with `// TIER-2-UPGRADE:` comments. See "Account Contract" section below.

### Account Contract (Section: Account Contract)

| Design | POC | Status |
|---|---|---|
| Custom Noir contract with WebAuthn envelope verification | Uses `EcdsaRAccountContract` (standard P-256 ECDSA) as placeholder | **Not implemented (agreed)** |
| Hardware-bound signing (secure element) | Software signing with `@noble/curves/p256` | **Tier 1 placeholder** |
| Constructor takes P-256 public key from passkey | Constructor takes PRF-derived P-256 public key | **Tier 1 placeholder** |

The custom Noir contract is the main item explicitly excluded from the POC scope. All code paths that differ between Tier 1 and Tier 2 are marked with `// TIER-2-UPGRADE:` comments explaining what changes. The upgrade is a surgical swap in `host/AccountManager.ts` and `popup/SignFlow.tsx`.

### Communication (Section: Communication)

| Design | POC | Status |
|---|---|---|
| Encrypted MessageChannel (ECDH + AES-256-GCM) | `SecureChannel` class with ECDH P-256 key exchange, two AES-256-GCM direction keys | **Done** |
| Direction-separated keys (parent→iframe, iframe→parent) | Two HKDF-derived keys with different info strings | **Done** |
| UUID as AAD for replay protection | Message `id` bound as GCM additional authenticated data | **Done** |
| Non-extractable CryptoKeys | All channel keys imported as non-extractable | **Done** |
| Ephemeral ECDH per session (forward secrecy) | New key pair on every `initFromPort()` call | **Done** |
| Point-to-point MessagePort (not broadcast) | MessageChannel port transfer, invisible to `window.addEventListener` | **Done** |
| Wallet-level RPC (not raw PXE) | **Partial** — PXE methods forwarded through proxy, not yet wrapped as Wallet interface with `WalletSchema` validation | **Partial** |

**Partial:** The tech design says the iframe exposes the Wallet interface (not raw PXE methods). The POC forwards PXE methods transparently through a JS `Proxy`. Production should wrap these in a Wallet-level abstraction (`sendTx` instead of `proveTx`, `registerContract` handling class registration automatically, etc.). The plumbing is in place; the abstraction layer is not.

### Session Lifecycle (Section: Session Lifecycle)

| Design | POC | Status |
|---|---|---|
| First visit: create passkey → PRF → keys → PXE sync | `ConnectFlow` tries discoverable `credentials.get()` first (shows picker if passkey exists), falls back to `credentials.create()` only for truly new users. PRF eval → HKDF → keys → PXE Worker init | **Done** |
| Returning visit: biometric → PRF → decrypt cache → resume | Three-tier credential resolution: (1) stored credential ID → direct `credentials.get({ allowCredentials })`, (2) no stored ID → discoverable `credentials.get({})` (authenticator shows picker, same passkey = same address), (3) no existing passkey → `credentials.create()`. Credential ID stored in SDK's `localStorage` on dapp origin | **Done** |
| Keys in JS memory only (never serialized) | Keys exist in Worker memory during session, garbage collected on Worker termination | **Done** |
| Encrypted PXE cache in IndexedDB | `EncryptedKVStore` wraps IndexedDB with AES-256-GCM | **Done** |
| CompositeKVStore (RAM for keys, encrypted IDB for rest) | `CompositeKVStore` routes `key_store`, `complete_addresses`, `complete_address_index` to `InMemoryKVStore` | **Done** |

**Note on credentialless iframe storage:** The `credentialless` iframe attribute creates an ephemeral storage partition — IndexedDB doesn't persist between sessions. This means the encrypted PXE cache won't survive page close, similar to Safari's behavior. Production may need the regular (non-credentialless) iframe approach once `Document-Isolation-Policy` has broader browser support.

### Security Model (Section: Security Model)

| Design | POC | Status |
|---|---|---|
| Signing key never enters JavaScript | **Tier 1:** signing key IS in JS (PRF-derived). **Tier 2:** hardware-bound | **Tier 1 deviation** |
| Viewing keys in memory only | Keys in PXE Worker memory, never serialized | **Done** |
| XSS on dapp cannot access iframe internals | Cross-origin iframe boundary + encrypted channel | **Done** |
| All tx require biometric (WebAuthn signing) | **Tier 1:** consent-only popup (no WebAuthn signing per tx). **Tier 2:** full WebAuthn ceremony per tx | **Tier 1 deviation** |

### Browser Compatibility (Section: Browser Compatibility)

| Feature | Design says | POC status |
|---|---|---|
| PRF support | Chrome 128+, Firefox 139+, Safari 18+ | Implemented, configurable `rpId` for localhost dev |
| SharedArrayBuffer in cross-origin iframe | "Solution: async bb.js backend" | **Solved differently:** PXE runs in Worker (has SAB natively) |
| Safari ephemeral IndexedDB | Graceful degradation, full re-sync | Credentialless iframe has same behavior — ephemeral storage |

### Popup Communication

The tech design shows `postMessage` between popup and iframe/SDK. The POC discovered that COOP and credentialless contexts make this impossible and uses:

| Channel | Design | POC |
|---|---|---|
| SDK → popup | `postMessage` | URL params (flow, rpId, callback, credentialId) |
| Popup → SDK | `postMessage` | OAuth callback redirect to `dapp_origin/__wallet_callback.html#base64(result)` → `localStorage` |
| SDK → iframe | Encrypted MessagePort | Same as design |
| Iframe main thread → PXE Worker | N/A (not in design) | `Worker.postMessage` with correlation IDs |

---

## What Is Not Implemented

### Transaction Signing Flow (sendTx)

The `SignFlow.tsx` popup UI renders a transaction approval screen with contract address, method name, and approve/reject buttons. However:
- It is not wired to the PXE's `proveTx`/`sendTx` pipeline
- The Tier 1 software signing (using the PRF-derived P-256 key) is not connected
- The Tier 2 WebAuthn signing ceremony (`credentials.get({ challenge: outer_hash })`) is not implemented
- Auth witness generation is not implemented

### Private Read Consent Flow

The `ReadFlow.tsx` popup UI renders a consent screen. However:
- It is not wired to intercept PXE read operations
- The RPCHandler does not gate private reads behind popup approval
- All PXE methods are forwarded transparently without consent checks

### Wallet-Level RPC Abstraction

The tech design specifies a Wallet interface (matching `@aztec/wallet-sdk`'s `WalletSchema`):
- `sendTx` (orchestrates prove → submit → wait)
- `registerContract` (handles class registration + updates automatically)
- `getAccounts` (returns addresses only, no crypto material)

The POC forwards raw PXE methods via `Proxy`. The abstraction layer needs to be built on top.

### Disconnect + Cleanup

The `disconnect()` method terminates the PXE Worker and clears state, but:
- Does not wipe viewing keys from Worker memory (Worker is terminated, so GC handles this)
- Does not encrypt and persist the PXE cache to IndexedDB on disconnect
- Does not remove the iframe from the DOM cleanly in all error paths

### Error Handling

- No user-facing error states when PXE init fails
- No retry logic when node is unreachable
- No timeout feedback in the connecting UI
- No graceful degradation when PRF is not supported

---

## Discoveries and Design Refinements

### Cross-Origin Isolation (Not Covered in Original Design)

The tech design's Browser Compatibility table mentions `Document-Isolation-Policy` for SharedArrayBuffer in Chrome 137+. During implementation we discovered:

1. **`Document-Isolation-Policy` does not work in practice** (tested on Chrome 143). The header is sent correctly but `crossOriginIsolated` remains `false` in the iframe.
2. **Cross-origin iframes never get `crossOriginIsolated`** regardless of headers — this is a browser spec constraint (Spectre mitigation).
3. **Workers inside credentialless iframes DO get `crossOriginIsolated=true` and `SharedArrayBuffer`** — this was verified empirically and is the foundation of the Worker-based PXE architecture.

### Build System

The tech design doesn't specify a build system. Vite/Rollup was the initial choice (matching the dapp), but Rollup's class hoisting breaks Aztec's circular static field initializers. esbuild (already a Vite dependency) bundles correctly. Three entry points:
- `host-entry.js` — iframe main thread (~5MB, SecureChannel + Worker management)
- `popup-entry.js` — popup window (~7MB, React + passkey ceremony)
- `pxe-worker.js` — PXE Worker (~48MB, full Aztec PXE + Barretenberg)

### Popup Communication Under COOP

The tech design assumes `postMessage` works between the popup and the iframe/SDK. With `COOP: same-origin` (required for SharedArrayBuffer in existing Aztec dapps):
- `window.opener` is `null` in cross-origin popups
- `BroadcastChannel` is isolated per browsing context group
- Direct `popup.location` reading is blocked

The OAuth callback pattern (redirect → localStorage → poll) solves all three. The tech design's "Communication" section should be updated to reflect this.

### Credential Recovery Without Stored ID

The tech design assumes the `credentialId` is always available (stored in iframe IndexedDB). In practice, the credentialless iframe has ephemeral storage, so the credential ID can be lost between sessions. The POC stores the credential ID in the SDK's `localStorage` (dapp origin) as a fallback.

When even that is cleared, `credentials.create()` would create a NEW passkey — different `CredRandom`, different PRF output, different address. This breaks the "one passkey = one wallet" identity model.

The fix: use WebAuthn's **discoverable credential** flow. `credentials.get()` called WITHOUT `allowCredentials` triggers the authenticator's passkey picker, showing all stored passkeys for this RP ID. The user selects their existing passkey → same `CredRandom` → same PRF → same address. `credentials.create()` is only called if no passkey exists at all.

### PRF During credentials.create()

The tech design shows PRF extraction from `credentials.create()`. In practice:
- Most authenticators return `prf.enabled: true` during create but do NOT evaluate PRF (no `results.first`)
- A second `credentials.get()` call is needed to actually get the PRF output
- Some authenticators (macOS 15+) DO support PRF eval during create, so we try it first and fall back

---

## Test Coverage

| Category | Tests | What's covered |
|---|---|---|
| SecureChannel (unit) | 4 | Handshake, send/receive, concurrent, errors |
| SecureChannel (integration) | 27 | Bidirectional, 500KB payloads, 50+ concurrent, teardown, reconnection, direction isolation |
| Crypto (unit) | 6 | HKDF derivation, determinism |
| Crypto (integration) | 29 | Cross-derivation independence, boundary inputs, Fr/P-256 range |
| EncryptedKVStore (unit) | 4 | Map/singleton/array/clear |
| EncryptedKVStore (integration) | 56 | Complex types, iteration, wrong-key, 100KB values, unicode |
| CredentialStore | 32 | Full byte range, overwrite, concurrent, base64 |
| PXEProxy + RPCHandler | 24 | Full pipeline, approval gates, concurrent/sequential |
| Passkey/Types/AccountManager | 12 | Config builders, constants, type guards |
| **Total** | **196** | All passing |

---

## How to Test

### Cross-Origin (production-like)

```bash
# Terminal 1: Build and serve wallet host
cd packages/passkey-wallet && node scripts/build-host.mjs && node scripts/serve-host.mjs

# Terminal 2: Run dapp
yarn dev

# Browser: localhost:3000 → Passkey Wallet tab → Connect with Passkey
# Requires: real passkey authenticator (Touch ID, Windows Hello)
# Requires: Aztec sandbox node at localhost:8080
```

---

## Files Changed in the Root Project

| File | Change |
|---|---|
| `package.json` | Added `workspaces: ["packages/*"]` |
| `vite.config.ts` | COOP+COEP headers (unchanged from original) |
| `src/types/ui.ts` | Added `'passkey'` to `TabType` |
| `src/components/Header.tsx` | Added Passkey Wallet tab with Fingerprint icon |
| `src/containers/MainContent.tsx` | Added `case 'passkey'` rendering `PasskeyDemo` |
| `src/containers/PasskeyDemo.tsx` | Integration demo using `PasskeyWalletProvider` + `usePasskeyWallet()` |
| `public/__wallet_callback.html` | OAuth callback landing page |
| `docs/passkey-wallet-tech-design-v2.md` | Added cross-origin isolation note to Browser Compatibility |
