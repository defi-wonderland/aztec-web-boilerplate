# Passkey Wallet SDK — POC Status

**Date:** 2026-04-06
**Branch:** `passkey`
**Reference:** `docs/passkey-wallet-tech-design-v2.md`

---

## What Was Built

A passkey-authenticated Aztec wallet SDK delivered as a cross-origin iframe. Standalone npm package at `packages/passkey-wallet/` with 47 source files, 196 tests, and an esbuild-based build system.

```
packages/passkey-wallet/
├── src/
│   ├── sdk/        Dapp-side: createPasskeyWallet, React provider, hook, PXE proxy, iframe manager
│   ├── host/       Iframe-side: WalletHost, RPCHandler, PXE Worker, EncryptedKVStore, CredentialStore
│   ├── popup/      Popup: ConnectFlow, SignFlow, ReadFlow (native CSS)
│   ├── shared/     SecureChannel, HKDF crypto, WebAuthn wrappers, types, constants
│   └── storage/    CompositeKVStore, InMemoryKVStore
├── scripts/
│   ├── build-host.mjs   esbuild bundler (host + popup + PXE Worker)
│   └── serve-host.mjs   Static server with cross-origin headers
└── dist/host/           Built output
```

---

## Alignment with Tech Design v2

### Architecture

**Cross-origin iframe** — Done. Iframe at `localhost:3001` with `credentialless` attribute. esbuild-built host served with CORP/COEP headers. Cross-origin only (no same-origin fallback).

**PXE in iframe** — Done, with a refinement. PXE runs in a **Web Worker** inside the iframe instead of on the main thread. Workers in credentialless iframes have `crossOriginIsolated=true` and `SharedArrayBuffer`. The iframe main thread relays messages between the encrypted channel and the Worker.

**Popup for passkey ceremonies** — Done. Popup opened at wallet host origin by the SDK. Uses OAuth callback pattern (redirect to dapp origin + localStorage) instead of `postMessage` (blocked by COOP).

**SDK = thin RPC client** — Done. `createPasskeyWallet()` → `PasskeyWalletProvider` → `usePasskeyWallet()`. Returns standard Aztec `Wallet`. No keys or PXE on the dapp side.

**Dapp never handles secret keys** — Done. Keys derived in popup, sent to iframe via encrypted channel.

### Key Derivation

- **PRF output extraction** — Done. `buildGetOptions()` with `prf.eval`, `extractPRFOutput()`.
- **HKDF master secret** (48 bytes → `Fr.fromBufferReduce`) — Done. `deriveMasterSecret()`.
- **HKDF encryption key** (32 bytes → non-extractable AES-GCM `CryptoKey`) — Done. `deriveEncryptionKey()`.
- **HKDF account salt** (48 bytes → `Fr.fromBufferReduce`) — Done. `deriveAccountSalt()`.
- **48-byte derivation** to eliminate bias (RFC 9380) — Done for all Fr derivations.
- **HKDF info strings** match the design exactly.
- **PRF eval during create** — Done. Requests eval during `credentials.create()`, falls back to second `credentials.get()` if the authenticator doesn't support it.

**Tier 1 deviation:** The design says no signing key from PRF — the passkey's hardware P-256 key signs. The POC derives a software signing key from PRF and uses `EcdsaRAccountContract`. Every divergence is marked with `// TIER-2-UPGRADE:` comments.

### Account Contract

**Not implemented (agreed scope exclusion).** Uses `EcdsaRAccountContract` as a Tier 1 placeholder. The custom Noir contract with WebAuthn envelope verification (`is_valid_impl` parsing `authenticatorData` + `clientDataJSON` inside ZK circuits) is the main item deferred to production. All code paths are marked for the Tier 2 upgrade.

### Encrypted Channel

- **ECDH P-256 key exchange** — Done. Ephemeral keys per session.
- **AES-256-GCM with direction-separated keys** — Done. Two HKDF-derived keys (parent→iframe, iframe→parent).
- **UUID as AAD** for replay protection — Done.
- **Non-extractable CryptoKeys** — Done.
- **Point-to-point MessagePort** (not broadcast) — Done.
- **Wallet-level RPC** — Partial. PXE methods are forwarded through a `Proxy`. The Wallet abstraction layer (`sendTx` instead of `proveTx`, automatic contract class registration, etc.) is not yet built.

### Session Lifecycle

**First visit:**
1. `ConnectFlow` tries discoverable `credentials.get()` first (shows passkey picker if one exists for this RP ID)
2. Falls back to `credentials.create()` only for truly first-time users
3. PRF eval → HKDF → keys sent to iframe → PXE Worker initializes

**Returning visit (three-tier credential resolution):**
1. Stored credential ID in SDK's `localStorage` → direct `credentials.get({ allowCredentials })`
2. No stored ID (localStorage cleared) → discoverable `credentials.get({})` → authenticator shows picker → same passkey = same CredRandom = same PRF = same address
3. No existing passkey at all → `credentials.create()`

This ensures "one passkey = one wallet = one address" even if the dapp's storage is cleared.

**Storage split:**
- RAM (`InMemoryKVStore`): `key_store`, `complete_addresses`, `complete_address_index`
- Encrypted IndexedDB (`EncryptedKVStore` with AES-256-GCM): notes, contracts, sync state
- `CompositeKVStore` routes between the two

**Note:** The `credentialless` iframe has ephemeral storage — IndexedDB doesn't persist between sessions, same as Safari's behavior. PXE re-syncs from the network on every session.

### Security Model

- **Signing key never in JS** — Tier 1 deviation: signing key IS in JS (PRF-derived). Tier 2 upgrades to hardware-bound.
- **Viewing keys in memory only** — Done. Keys in PXE Worker memory, garbage collected on termination.
- **XSS isolation** — Done. Cross-origin iframe + encrypted channel.
- **Per-tx biometric** — Tier 1 deviation: consent-only popup. Tier 2 adds WebAuthn signing ceremony per transaction.

### Popup Communication

The tech design assumes `postMessage` between popup and SDK. COOP makes this impossible:
- `window.opener` is null in cross-origin popups
- `BroadcastChannel` is isolated per browsing context group
- Direct `popup.location` reading is blocked

POC uses:
- **SDK → popup:** URL params (`flow`, `rpId`, `callback`, `credentialId`)
- **Popup → SDK:** OAuth callback redirect to `dapp_origin/__wallet_callback.html#base64(result)` → `localStorage` poll
- **SDK → iframe:** Encrypted MessagePort (same as design)
- **Iframe → PXE Worker:** `Worker.postMessage` with correlation IDs

---

## What Is Not Implemented

**Transaction signing (sendTx):** `SignFlow.tsx` renders the approval UI but is not wired to the PXE `proveTx`/`sendTx` pipeline. Neither Tier 1 software signing nor Tier 2 WebAuthn ceremony is connected. Auth witness generation is not implemented.

**Private read consent:** `ReadFlow.tsx` renders the consent UI but the RPCHandler does not gate private reads behind popup approval. All PXE methods are forwarded transparently.

**Wallet-level RPC abstraction:** The tech design specifies a Wallet interface (`sendTx`, `registerContract`, `getAccounts`). The POC forwards raw PXE methods via `Proxy`. The abstraction needs to be built.

**Disconnect cleanup:** Worker is terminated (GC handles key cleanup) but PXE cache is not encrypted and persisted to IndexedDB on disconnect.

**Error handling:** No user-facing error states for PXE init failures, unreachable node, or missing PRF support.

---

## Discoveries

### Cross-Origin Isolation

- `Document-Isolation-Policy` does not work in practice (tested Chrome 143)
- Cross-origin iframes never get `crossOriginIsolated` regardless of headers (Spectre mitigation)
- **Workers inside credentialless iframes DO get `crossOriginIsolated=true` and `SharedArrayBuffer`** — foundation of the PXE Worker architecture

### Build System

Vite/Rollup hoists class declarations, breaking Aztec's circular static field initializers (`static ZERO = new Fr(0n)` before `Fr` is defined). esbuild preserves class order. Three entry points: `host-entry.js` (~5MB), `popup-entry.js` (~7MB), `pxe-worker.js` (~48MB).

### Credential Recovery

When the stored credential ID is lost, `credentials.create()` would create a new passkey with a new `CredRandom` — different address. Fix: discoverable credential flow (`credentials.get()` without `allowCredentials`) shows the authenticator's passkey picker. Same passkey = same address.

### PRF During Create

Most authenticators return `prf.enabled: true` during `credentials.create()` but don't evaluate PRF. A second `credentials.get()` is needed. Some (macOS 15+) support eval during create — we try first, fall back.

---

## Tests

196 tests across 13 test files:

- **SecureChannel:** 31 tests (handshake, 500KB payloads, 50+ concurrent, teardown, reconnection, direction isolation)
- **Crypto:** 35 tests (HKDF derivation, cross-independence, boundary inputs, Fr/P-256 range)
- **EncryptedKVStore:** 60 tests (complex types, iteration, wrong-key rejection, 100KB values, unicode)
- **CredentialStore:** 32 tests (full byte range, overwrite, concurrent, base64)
- **PXEProxy + RPCHandler:** 24 tests (full pipeline, approval gates, concurrent/sequential)
- **Passkey/Types/AccountManager:** 14 tests (config builders, constants)

---

## How to Test

```bash
# Terminal 1: Build and serve wallet host (localhost:3001)
cd packages/passkey-wallet && node scripts/build-host.mjs && node scripts/serve-host.mjs

# Terminal 2: Run dapp (localhost:3000)
yarn dev

# Browser: localhost:3000 → Passkey Wallet tab → Connect with Passkey
# Requires: real passkey authenticator (Touch ID, Windows Hello, security key)
# Requires: Aztec sandbox node at localhost:8080
```

---

## Root Project Changes

- `package.json` — added `workspaces: ["packages/*"]`
- `src/types/ui.ts` — added `'passkey'` to `TabType`
- `src/components/Header.tsx` — added Passkey Wallet tab
- `src/containers/MainContent.tsx` — added passkey tab rendering
- `src/containers/PasskeyDemo.tsx` — integration demo
- `public/__wallet_callback.html` — OAuth callback page
- `docs/passkey-wallet-tech-design-v2.md` — cross-origin isolation note
