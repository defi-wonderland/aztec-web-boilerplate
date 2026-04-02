# Shared PXE Iframe Wallet: Technical Design Research

## Deep Research Synthesis

**Date**: 2026-03-25
**Status**: Research Complete — Ready for Architecture Decision
**Scope**: Cross-dapp shared PXE wallet via iframe, passkey authentication, Aztec privacy architecture
**Research Sources**: 8 parallel deep-research agents covering Porto/Tempo architecture, IndexedDB browser behavior, iframe security, PXE performance, UX patterns, Storage Access API, passkey cryptography, and iframe encryption patterns


---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Passkey Cryptography](#2-passkey-cryptography)
3. [IndexedDB Encryption Architecture](#3-indexeddb-encryption-architecture)
4. [The Core Tension](#4-the-core-tension)
5. [Browser Storage Reality](#5-browser-storage-reality)
6. [Porto Reference Architecture](#6-porto-reference-architecture)
7. [Why Porto's Model Doesn't Directly Translate](#7-why-portos-model-doesnt-directly-translate)
8. [Architecture Options](#8-architecture-options)
9. [Recommended Architecture](#9-recommended-architecture)
10. [Security Model](#10-security-model)
11. [Performance Analysis](#11-performance-analysis)
12. [UX Considerations](#12-ux-considerations)
13. [Limitations](#13-limitations)
14. [Critical Open Questions](#14-critical-open-questions)
15. [Decision Matrix](#15-decision-matrix)
16. [Sources](#16-sources)

---

## 1. Executive Summary

### What We Want
A universal Aztec wallet — one account, one PXE, shared across all dapps — delivered as a reusable npm package. The iframe wallet is functionally equivalent to a **browser extension wallet (like MetaMask), but delivered as an embedded iframe** with zero install. Dapps don't run a PXE, just like dapps don't run an Ethereum node — they request operations from the wallet, and the wallet handles everything. Users authenticate with passkeys (biometric), the iframe runs the PXE and manages keys, and dapps only receive operation results via postMessage. **Dapps never have access to keys.**

### What We Found
**The pure shared-iframe approach has a fundamental blocker: browser storage partitioning.** Every major browser partitions IndexedDB by top-level origin. A PXE iframe at `wallet.aztec.network` embedded in `app1.com` and `app2.com` gets completely separate databases. Safari makes it worse — iframe IndexedDB is ephemeral (RAM only, lost on browser quit).

**No cross-browser workaround exists for sharing IndexedDB across parent origins in an iframe.** Chrome 125+ has a partial solution (`StorageAccessHandle`), but Firefox and Safari do not support it and have no plans to.

### The Key Insight
Porto (Paradigm's iframe wallet — the actual reference implementation, NOT Tempo) sidesteps this problem because its iframe is **lightweight**. It only handles WebAuthn + approval UI. Heavy computation happens on a server-side Relay. Porto barely uses IndexedDB — passkey credentials live in the platform authenticator.

**Our PXE iframe is fundamentally different.** It must run WASM proving, store encrypted notes, manage nullifier trees, and maintain WebSocket connections to the Aztec node. Aztec's privacy model demands client-side computation — we can't offload to a server without compromising privacy.

### Recommendation
A **hybrid architecture** combining:
- **Iframe** for PXE compute engine (invisible, per-dapp partitioned storage)
- **Popup window** for passkey operations and initial key derivation (first-party context, shared across dapps)
- **Passkey PRF** for deterministic key derivation (keys survive storage loss)
- **Accept per-dapp PXE sync** as the baseline, with optimizations to minimize re-sync cost

---

## 2. Passkey Cryptography

### 2.1 PRF Extension Internals

The PRF extension is the WebAuthn (browser-level) API for the CTAP2 `hmac-secret` extension. The exact construction:

1. **At credential creation**: The authenticator generates 32 bytes of `CredRandom` from its CSPRNG, stored permanently in the secure element alongside the credential.
2. **At each PRF evaluation**: The browser domain-separates the developer salt: `actualSalt = SHA-256("WebAuthn PRF" || 0x00 || developerSalt)`
3. **The authenticator computes**: `output = HMAC-SHA-256(CredRandom, actualSalt)` — deterministic, always 32 bytes.
4. **Transport security**: Salt and output are encrypted via an ephemeral ECDH channel between browser and authenticator.

**Key guarantees**:
- **Fully deterministic**: Same credential + same salt = same 32 bytes, every time, on every device
- **Survives cloud sync**: `CredRandom` syncs with the passkey via iCloud Keychain / Google Password Manager
- **Full 256-bit entropy**: Output is computationally indistinguishable from random
- **Always requires user interaction**: Biometric/PIN required for every PRF evaluation — no silent/background calls
- **Two salts per ceremony**: The API supports `first` and `second` evaluation points, yielding two independent 32-byte outputs

**Domain separation**: The browser's `SHA-256("WebAuthn PRF" || 0x00 || ...)` prefix ensures WebAuthn PRF outputs are cryptographically independent from native CTAP2 hmac-secret outputs, even with the same developer salt.

### 2.2 PRF Platform Support

| Platform | PRF Support | Notes |
|---|---|---|
| macOS 15+ (iCloud Keychain) | Yes — Safari 18+, Chrome 132+, Firefox 139+ | Full support |
| iOS 18+ (iCloud Keychain) | Yes — all browsers | External keys: NO PRF on iOS |
| Android (Google PM) | Yes — Chrome, Edge, Samsung Internet | NFC keys: no PRF |
| **Windows Hello** | **NO** | Experimental in insider builds only. Only external USB keys support PRF on Windows. |
| Hardware keys (YubiKey 5+) | Yes — Chrome, Firefox | Not Safari on macOS, not iOS at all |
| **Firefox (all platforms)** | **YES** (Firefox 139+) | PRF supported but only with platform authenticators on macOS/iOS |

**Gap**: Windows Hello users without a hardware security key cannot use PRF. Fallback needed (embedded wallet with random keys, or prompt to use a hardware key).

### 2.3 Key Derivation (Corrected)

**CRITICAL: The passkey-integration-research.md contains a bias bug.** Using `Fr.fromBufferReduce(32 bytes)` to create an Aztec master secret produces ~17.6% relative bias because `2^256 / Fr_order ≈ 3.64`. This is cryptographically unacceptable.

**Fix**: Derive 48 bytes via HKDF before reducing mod any ~254-bit prime. Per RFC 9380 `hash_to_field`: `L = ceil((254 + 128) / 8) = 48 bytes`. The resulting bias is `2^-130` — negligible.

```
PRF Output (32 bytes, from passkey + salt)
  │
  ├── HKDF-SHA-256(prfOutput, "", "aztec-wallet/v1/master-secret", 48)
  │     └── Fr.fromBufferReduce(48 bytes) → masterSecret
  │         Bias: 2^-130 (negligible)
  │
  ├── HKDF-SHA-256(prfOutput, "", "aztec-wallet/v1/p256-signing-key", 48)
  │     └── mod P-256 order → signingPrivateKey
  │         Bias: 2^-128 (negligible)
  │
  ├── HKDF-SHA-256(prfOutput, "", "aztec-wallet/v1/indexeddb-encryption", 32)
  │     └── SubtleCrypto.importKey("raw", ..., "AES-GCM", extractable: false)
  │         → non-extractable CryptoKey for IndexedDB encryption
  │
  └── HKDF-SHA-256(prfOutput, "", "aztec-wallet/v1/account-salt", 48)
        └── Fr.fromBufferReduce(48 bytes) → accountSalt
```

**Rules**:
- Use **48 bytes** for anything reduced mod a ~254-bit prime (Fr, P-256 order)
- Use **32 bytes** for symmetric keys (AES-256)
- Always use domain-separated `info` strings with versioning (`v1`)
- HKDF-SHA-256 for key derivation (not Poseidon2 — HKDF is for outside circuits, Poseidon2 is for inside ZK proofs)
- **No key stretching needed** — PRF output is already 256 bits from hardware HMAC

### 2.4 RP ID Strategy

**Recommendation: Use `aztec.network` as the RP ID** (not `wallet.aztec.network`).

RP ID scoping rules allow subdomains to use parent domain RP IDs:
- `wallet.aztec.network` CAN use `aztec.network` as RP ID
- `pxe.wallet.aztec.network` CAN use `aztec.network` as RP ID
- Any future subdomain under `aztec.network` would work

Using the broadest registrable domain gives maximum flexibility. **This is a permanent decision** — changing the RP ID later breaks all existing passkeys.

### 2.5 Multi-Passkey Strategy

Each passkey has a different `CredRandom`, so different passkeys produce different PRF outputs for the same salt. This means Model A (stateless PRF-direct derivation) only works for a single passkey.

**For multiple passkeys per account, use Model B (PRF-Encrypted At-Rest)** — the same pattern Bitwarden uses:

```
Initial Setup (first passkey):
  1. Generate random Account Master Key (AMK) — 32 bytes from CSPRNG
  2. Derive all Aztec keys from AMK via HKDF (signing key, master secret, encryption key, salt)
  3. Derive AES key from passkey's PRF output via HKDF
  4. Encrypt AMK with the PRF-derived AES key
  5. Store: { credentialId, encryptedAMK } — in IndexedDB or a minimal server

Adding second passkey:
  1. Authenticate with existing passkey → PRF → decrypt AMK
  2. Register new passkey, get its PRF output
  3. Derive AES key from new passkey's PRF output
  4. Encrypt AMK with new AES key
  5. Store: { newCredentialId, newEncryptedAMK }

Recovery with any passkey:
  1. Authenticate with any registered passkey → PRF → AES key
  2. Decrypt AMK
  3. Derive all Aztec keys from AMK
```

**Phase strategy**:
- **Phase 1**: Launch with Model A (single passkey, stateless). Simplest. Keys derived directly from PRF.
- **Phase 2**: Upgrade to Model B when multi-passkey or key rotation is needed. Model B is backward-compatible — detect whether an encrypted AMK exists and use it; otherwise fall back to Model A derivation.

### 2.6 Passkey Backup and Recovery

**iCloud Keychain**: End-to-end encrypted. With Advanced Data Protection (ADP), Apple genuinely cannot access the data — not even under government subpoena. Recovery requires Apple ID + device passcode. Limited to 10 attempts.

**Google Password Manager**: End-to-end encrypted since 2024 with a Google PM PIN or device screen lock. Recovery requires Google account + PIN.

**Windows Hello**: Device-bound only. No cloud sync. No recovery if device is lost.

**FIDO Alliance CXP/CXF (Credential Exchange Protocol)**: Approved as FIDO Proposed Standard, August 2025. Apple iOS 26 is the first platform to implement. Enables passkey export/transfer between ecosystems (Apple → Google). Still early but the path to portability.

**Hardware keys (YubiKey)**: Device-bound, no sync. Factory reset destroys all credentials. Can serve as backup passkey via Model B.

### 2.7 P-256 Signing in Software (@noble/curves)

**Security**: 6 audits (Cure53 x3, Trail of Bits, Kudelski Security, Cure53+OpenSats). Zero dependencies. RFC 6979 deterministic nonces. Low-S normalization enforced by default.

**Side-channel caveat**: True constant-time execution is impossible in JavaScript (JIT, GC, BigInt timing). `@noble/curves` targets algorithmic constant-time — no data-dependent branches. Accepted trade-off in the Web3 ecosystem. The iframe's cross-origin process isolation is the primary defense.

**Performance**: ~500-2000 sign ops/sec in modern browsers. More than sufficient for interactive wallet use.

### 2.8 Known Attacks on Passkey Wallets

| Attack | Real Risk | Mitigation |
|---|---|---|
| **Shared iCloud account** (family sharing) | Yes — both users get all passkeys | Warn users; wallet-specific PIN for high-value operations |
| **Cloud account phishing** | Yes — attacker gets Apple/Google account | iCloud ADP; multi-passkey with hardware backup |
| **Extension hijacks registration** (SquareX "Passkeys Pwned") | Yes — extension substitutes its own credential | Verify credential ID matches; cross-origin iframe + CSP |
| **Passkey loss = fund loss** | Yes (recovery paradox) | Multi-passkey (Model B) + guardian recovery |
| **No automated signing** | Yes — PRF requires biometric | Session keys for in-session automation; keys in memory after PRF |
| **YubiKey firmware reset** | Yes — destroys all credentials | Always have a cloud-synced backup passkey |
| **Platform passkey revocation** | Low — no silent revocation mechanism | Users control deletion via Settings; Signal API for cleanup only |
| **Government subpoena (cloud)** | Low with ADP — Apple can't comply with E2E encrypted data | Enable ADP; multi-passkey across ecosystems |

---

## 3. IndexedDB Encryption Architecture

### 3.1 Why Encrypt (Cross-Origin Isn't Enough)

The iframe's cross-origin isolation prevents dapp JavaScript from reading IndexedDB. But it does NOT protect against:

| Threat | Cross-origin blocks? | Encryption helps? |
|---|---|---|
| Dapp JavaScript | Yes | N/A |
| **Browser extensions with host permissions** | **No** | **Yes** — non-extractable keys can't be exfiltrated |
| **Physical device + DevTools** | **No** | **Partially** — can decrypt in-session, can't export the key |
| **Malware reading IndexedDB files on disk** | **No** | **Yes** — files contain ciphertext only |
| **Forensic disk extraction** | **No** | **Yes** |

### 3.2 What the PXE Stores (Sensitivity Analysis)

| Store | Data | Sensitivity |
|---|---|---|
| **KeyStore** | Master secret keys (ivsk_m, ovsk_m, tsk_m, nhk_m) as **raw Buffer objects** | **CRITICAL** — complete account compromise if exposed |
| **NoteStore** | Decrypted note content: amounts, addresses, counterparties | **HIGH** — reveals private balances and tx details |
| **SenderTaggingStore** | Tagging secrets linking transactions to addresses | **HIGH** — reveals interaction graph |
| **RecipientTaggingStore** | Recipient tagging data | **HIGH** — same |
| **PrivateEventStore** | Decrypted private event logs | **HIGH** |
| **AddressStore** | Complete addresses + public keys | **MEDIUM** — reveals which accounts this PXE manages |
| **ContractStore** | Artifacts, ABIs (typically public) | LOW |
| **AnchorBlockStore** | Block headers (public data) | LOW |

**The PXE currently has ZERO application-level encryption.** All data is stored as plaintext serialized buffers. Master secret keys are raw `Buffer` objects in IndexedDB.

**Recommendation**: Encrypt everything at the KV store layer. The overhead is negligible (~0.1-0.3ms per operation), and selective encryption is error-prone.

### 3.3 Encryption Scheme

**AES-256-GCM via WebCrypto** with non-extractable keys:

```
Session start:
  1. Passkey PRF → 32 bytes
  2. HKDF(prfOutput, "", "aztec-wallet/v1/indexeddb-encryption", 32) → key material
  3. SubtleCrypto.importKey("raw", keyMaterial, "AES-GCM", false, ["encrypt", "decrypt"])
     └── extractable: false — key bytes NEVER enter JS-accessible memory
  4. Cache CryptoKey in memory for session duration

Every IndexedDB write:
  5. nonce = crypto.getRandomValues(new Uint8Array(12))  // 96-bit random nonce
  6. ciphertext = SubtleCrypto.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext)
  7. Store: nonce || ciphertext || authTag (GCM bundles the tag)

Every IndexedDB read:
  8. Extract nonce (first 12 bytes) and ciphertext (remainder)
  9. plaintext = SubtleCrypto.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext)
```

**Why AES-256-GCM via WebCrypto (not @noble/ciphers)**:
- **Non-extractable keys** — the critical advantage. Key bytes can't be exported even via DevTools `crypto.subtle.exportKey()` — throws `InvalidAccessError`. An extension can use the key as an oracle (decrypt in-session) but can't exfiltrate the raw bytes to a remote server.
- **Hardware-accelerated**: ~1-4 GB/s on desktop with AES-NI vs ~50-200 MB/s for JS implementations
- **Built-in**: No dependency, available in all browsers
- **Authenticated**: GCM provides integrity + confidentiality in one operation

**Nonce management**: Random 12-byte nonce per write. Birthday bound gives collision probability ~2^-32 after 2^32 encryptions under the same key — more than sufficient for PXE note storage.

### 3.4 Performance Impact

| Operation | Without encryption | With AES-256-GCM | Overhead |
|---|---|---|---|
| IndexedDB write (1KB) | ~1-5ms | ~1.1-5.3ms | +0.1-0.3ms |
| IndexedDB read (1KB) | ~0.5-3ms | ~0.6-3.3ms | +0.1-0.3ms |
| Bulk sync (1000 notes) | ~5-10s (network-bound) | ~5-10.2s | **+~200ms total** |

The encryption overhead is dwarfed by network sync and Aztec protocol-level decryption costs. **Not a performance concern.**

### 3.5 Key Lifecycle

| Scenario | What happens |
|---|---|
| Normal session | PRF → derive key → encrypt/decrypt IndexedDB → clear key on page close |
| Return to same dapp (Chrome/Firefox) | PRF → derive same key → decrypt existing IndexedDB data (instant) |
| Return to same dapp (Safari) | PRF → derive same key → IndexedDB was ephemeral, must re-sync from node |
| User clears browser data | PRF → derive same key → IndexedDB cleared, must re-sync from node |
| Passkey rotated (Model B) | New PRF output → new encryption key → must re-encrypt or re-sync |

The encryption key is always re-derivable from the passkey PRF. **Data loss means re-sync, never fund loss.**

---

## 4. The Core Tension

```
┌─────────────────────────────────────────────────────┐
│              WHAT WE WANT                            │
│  One PXE, shared across all dapps                   │
│  Unified note database, instant switching            │
│  "Log in once, use everywhere"                       │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              WHAT BROWSERS ENFORCE                    │
│  Storage partitioned by (iframe origin, parent site) │
│  Safari: iframe storage is RAM-only (ephemeral)      │
│  No cross-browser API to share IndexedDB in iframes  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              WHAT AZTEC REQUIRES                      │
│  Client-side ZK proving (privacy)                    │
│  Heavy IndexedDB usage (notes, nullifiers, trees)    │
│  WASM + SharedArrayBuffer (multi-threaded proving)   │
│  WebSocket to Aztec node                             │
└─────────────────────────────────────────────────────┘
```

**The tension**: Universal wallet wants shared state. Browsers enforce isolation. Aztec needs heavy client-side storage. These three constraints cannot all be satisfied simultaneously.

---

## 5. Browser Storage Reality

### 5.1 IndexedDB Partitioning Summary

| Browser | Partitioned? | Can SAA Unpartition IndexedDB? | Iframe IndexedDB Persistent? |
|---------|-------------|-------------------------------|------------------------------|
| **Chrome 115+** | Yes — key: `(origin, top-level-site, ancestor-bit)` | **Yes** via `StorageAccessHandle` (Chrome 125+) | Yes (persisted to disk) |
| **Firefox 103+** | Yes — double-keyed: `origin^top-level-site` | **No** (SAA only unpartitions cookies) | Yes (persisted to disk) |
| **Safari** | Yes — partitioned per top-level site | **No** (SAA only unpartitions cookies) | **NO — ephemeral (RAM only), lost on browser quit** |
| **Edge** | Yes (follows Chrome) | **No** (StorageAccessHandle not shipped) | Yes |

### 5.2 Storage Access API Reality Check

The `StorageAccessHandle` with `{ indexedDB: true }` is a **Chrome-only feature**:
- **Chrome 125+**: Supported. Returns handle with `.indexedDB` accessor to unpartitioned storage.
- **Firefox**: Mozilla position is "positive" but NOT implemented. No timeline.
- **Safari**: WebKit has NOT responded to the proposal. No indication of future support.
- **Edge**: Despite being Chromium-based, has NOT shipped StorageAccessHandle.

**Requirements even when supported (Chrome)**:
1. User must have visited `wallet.aztec.network` as a first-party site before
2. User gesture (click/tap) required for first grant
3. Permission expires after 30 days without interaction
4. Must be re-requested on every page load

### 5.3 Safari: The Worst Case

Safari is uniquely hostile to iframe storage:
- Third-party IndexedDB/localStorage are **partitioned AND ephemeral** (in-memory only)
- Data lost when user quits Safari, reboots, or WebKit process terminates
- 7-day cap: ALL script-writable storage deleted after 7 days without user interaction
- Cross-origin iframe storage quota: **10% of parent's origin quota** (~6% of disk)
- Storage Access API grants **cookie access only**, NOT IndexedDB
- WebAuthn `credentials.create()` does NOT work in cross-origin iframes (popup required)

### 5.4 What This Means

**Scenario**: `wallet.aztec.network` iframe embedded in `app1.com` and `app2.com`

| | Chrome | Firefox | Safari |
|---|---|---|---|
| Same IndexedDB across dapps? | No (partitioned) | No (double-keyed) | No (partitioned + ephemeral) |
| Can unpartition via API? | Yes (SAA + Handle) | No | No |
| Data survives browser quit? | Yes | Yes | **No** |
| PXE re-sync needed per dapp? | Yes (unless SAA granted) | Yes (always) | Yes (every session) |

### 5.5 Industry Response

**Turnkey** (key management platform) explicitly abandoned iframes in favor of first-party IndexedDB, stating: *"Third-party iframe implementations are inherently fragile — browsers can clear an embedded key at any time."*

**Porto** sidesteps the problem by keeping its iframe lightweight (WebAuthn + approval UI only), with all heavy computation on a server-side Relay. Passkey credentials stored in platform authenticator, not IndexedDB.

---

## 6. Porto Reference Architecture

Porto is the closest reference implementation to what we're building. Key architectural details from source code analysis:

### 6.1 Communication Protocol

```
[Dapp] ←—postMessage—→ [iframe: id.porto.sh/dialog] ←—HTTP/JSON-RPC—→ [Relay: rpc.porto.sh]
```

7 message topics: `ready`, `rpc-requests`, `rpc-response`, `close`, `success`, `account`, `__internal`

Each message: `{ id: UUID, topic: string, payload: any }`

### 6.2 Iframe Configuration

```typescript
iframe.setAttribute('sandbox',
  'allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');

const iframeAllow = [
  'payment',
  `publickey-credentials-get ${hostUrl.origin}`,
  `publickey-credentials-create ${hostUrl.origin}`,
];
```

### 6.3 Dual Mode: Headless + Visible

Porto's iframe operates in two modes:
- **Headless**: For RPC methods covered by session key policies — executes invisibly without opening the dialog
- **Visible dialog**: For methods requiring user confirmation — renders as a `<dialog>` with the iframe inside

### 6.4 Security Layers

1. **Origin validation**: Exact-match on every postMessage (never `"*"`)
2. **Trusted hosts list**: ~47 hardcoded domains + server-side referrer verification
3. **IntersectionObserver v2**: Detects if iframe is obscured (clickjacking protection, Chrome only)
4. **Popup fallback**: For untrusted hosts without IOv2 support, or Safari/HTTP contexts
5. **Ephemeral key trick**: Bootstrap key generated inside iframe, never exposed to parent, immediately discarded after account creation

### 6.5 Universal Wallet via RP ID

Passkeys are bound to `id.porto.sh` as the WebAuthn Relying Party. Since the iframe creates credentials, the RP ID is `id.porto.sh` regardless of which dapp embeds it. **Same passkey works across all dapps.**

### 6.6 Storage Strategy

```typescript
// Dialog iframe: minimal storage (credential metadata only)
storage: Storage.combine(Storage.cookie(), Storage.localStorage())

// Parent SDK: Zustand store persisted to IndexedDB
persist<State>(..., { storage: createJSONStorage(() => idb()) })
```

Porto barely uses IndexedDB in the iframe. Keys live in the platform authenticator, not client storage.

---

## 7. Why Porto's Model Doesn't Directly Translate

| Dimension | Porto (EVM) | Our PXE (Aztec) |
|---|---|---|
| **Iframe role** | Lightweight: WebAuthn + approval UI | Heavy: full PXE (WASM, note sync, proving) |
| **Computation** | Server-side Relay handles simulation, fees, execution | Client-side (privacy requirement) |
| **Storage needs** | Minimal (credential IDs, public keys) | Heavy (encrypted notes, nullifier trees, account state) |
| **IndexedDB dependency** | None in iframe (cookies + localStorage sufficient) | Critical (PXE data store) |
| **WASM/threads** | None | Barretenberg WASM + SharedArrayBuffer for proving |
| **Privacy model** | Transparent (EVM) | Private (ZK proofs, encrypted notes) |
| **Network connection** | Relay handles node communication | Direct WebSocket to Aztec node |

**The fundamental difference**: Porto can delegate to a server because EVM state is public. Aztec's privacy model requires ALL computation to happen client-side. This means our iframe IS the heavy computation engine, creating storage and performance challenges Porto doesn't face.

---

## 8. Architecture Options

### Option A: Pure Iframe (Porto-like)

```
[Dapp] ←—postMessage—→ [iframe: wallet.aztec.network]
                              │
                              ├── PXE (WASM + IndexedDB)
                              ├── WebSocket → Aztec Node
                              ├── Passkey (WebAuthn)
                              └── Approval UI (dialog)
```

**Pros**: Simplest mental model; single integration point; key isolation via cross-origin process
**Cons**: IndexedDB partitioned per dapp (no shared PXE state); Safari loses all data on browser quit; re-sync needed per dapp visit; SharedArrayBuffer requires complex header setup

**Verdict**: Works as a per-dapp wallet but **NOT** a universal shared wallet.

### Option B: Iframe + Popup Hybrid

```
[Dapp] ←—postMessage—→ [hidden iframe: wallet.aztec.network]
                              │                         ↑
                              ├── PXE compute            │
                              ├── Partitioned IndexedDB  │
                              └── WebSocket → Node       │
                                                         │
         [popup: wallet.aztec.network/auth] ←—postMessage—┘
                              │
                              ├── Passkey WebAuthn (first-party context)
                              ├── Unpartitioned IndexedDB (shared state)
                              └── Key derivation via PRF
```

**Pros**: Popup has first-party context (full IndexedDB access, shared across dapps); passkey creation works on Safari; keys derived from passkey survive storage loss; iframe handles compute
**Cons**: Popup UX is worse; popup blockers; mobile popup behavior varies; two communication channels to manage

**Verdict**: Best cross-browser option for shared key state. PXE data still per-dapp.

### ~~Option C: SDK-Only (No Iframe)~~ — REJECTED

Runs PXE directly in dapp context. Simpler to build, but **dapp JS can access all key material**. Any XSS, any malicious dapp developer, any compromised dependency can drain the wallet. For a production reusable wallet installed by untrusted third-party dapps, this is unacceptable. **Keys must never be accessible to dapp code.**

### Option D: Iframe + Dedicated Wallet Page (Cartridge Pattern)

```
First visit: User goes to wallet.aztec.network directly
             → Creates passkey, initializes PXE, syncs notes
             → Establishes Storage Access API prerequisite

Subsequent:  Dapp embeds iframe → iframe calls requestStorageAccess()
             → Chrome: gets shared IndexedDB via StorageAccessHandle
             → Firefox/Safari: falls back to popup or per-dapp sync
```

**Pros**: Establishes first-party relationship; Chrome gets shared IndexedDB; good trust model (user visits wallet domain consciously)
**Cons**: Requires extra onboarding step; Firefox/Safari still need fallback; SAA requires user gesture per page load

**Verdict**: Good for Chrome users; still needs popup fallback for others.

### ~~Option E: Server-Side PXE Cache~~ — REJECTED

**Not viable for Aztec.** Even with encryption, a server-side cache reveals metadata: when users access data, data sizes, access patterns, which dapps they use, timing correlations. This is exactly what Aztec's local PXE is designed to prevent. The PXE must remain fully local — this is a non-negotiable privacy requirement, not a limitation to optimize around.

---

## 9. Recommended Architecture

### 9.0 Why the Iframe Is Non-Negotiable

The iframe is not an optimization choice — it's the security architecture. The core requirement: **dapps must never have access to signing keys or private note data.** This is what makes the wallet trustworthy for production use across untrusted third-party dapps.

Without cross-origin isolation:
- Any XSS in the dapp can steal keys
- Any malicious dapp developer can drain wallets
- Any compromised npm dependency in the dapp has full access
- Users must trust every dapp they connect to

With cross-origin iframe:
- Keys live in a separate OS process (Chrome Site Isolation)
- Dapp code cannot read iframe memory, even via Spectre
- The dapp only receives operation results (balances, tx hashes)
- Users trust ONE domain (`wallet.aztec.network`), not every dapp

The browser limitations (storage partitioning, Safari ephemeral data, etc.) are the **cost of real security**. We accept them and design the best UX within those constraints.

### 9.1 The Pragmatic Hybrid (Option B + D combined)

```
┌─────────────────────────────────────────────────────────────┐
│                     Dapp (e.g., app.example.com)             │
│                                                               │
│   @wonderland/aztec-wallet SDK                                │
│   ┌─────────────────────────────────────────────────────┐    │
│   │  SDK manages iframe lifecycle + popup fallback        │    │
│   │  Comlink RPC proxy to iframe PXE                      │    │
│   │  React hooks: useAztecWallet, useReadContract, etc.   │    │
│   └──────────┬──────────────────────┬────────────────────┘    │
│              │ postMessage           │ postMessage              │
│              ▼                       ▼                          │
│   ┌──────────────────┐   ┌──────────────────────────┐        │
│   │  Hidden iframe    │   │  Popup (when needed)      │        │
│   │  wallet.aztec.net │   │  wallet.aztec.net/auth    │        │
│   │                   │   │                           │        │
│   │  • PXE compute    │   │  • Passkey create/sign    │        │
│   │  • WASM proving   │   │  • PRF key derivation     │        │
│   │  • Note sync      │   │  • Approval UI            │        │
│   │  • IndexedDB      │   │  • First-party IndexedDB  │        │
│   │    (partitioned)  │   │    (shared across dapps)  │        │
│   │  • WebSocket→Node │   │  • Account state cache    │        │
│   └──────────────────┘   └──────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘

Flow:
1. SDK loads hidden iframe (PXE compute engine)
2. For passkey operations → opens popup at wallet.aztec.network/auth
3. Popup derives keys via PRF, sends back to iframe via postMessage
4. Iframe initializes PXE with derived keys
5. Dapp communicates with iframe PXE via Comlink RPC
6. Transaction approval → popup or visible iframe dialog
```

### 9.2 Why This Architecture

| Problem | Solution |
|---|---|
| IndexedDB partitioned per dapp | Accept per-dapp PXE sync for note data; keys derived from passkey (no storage needed) |
| Safari ephemeral iframe storage | Keys re-derived from passkey each session; PXE re-syncs (unavoidable on Safari) |
| Safari blocks WebAuthn create() in iframe | Popup for passkey creation (first-party context) |
| SharedArrayBuffer needs cross-origin isolation | Document-Isolation-Policy on iframe (Chrome 137+); single-threaded fallback for others |
| Universal wallet identity | Passkey RP ID = `wallet.aztec.network` (same across all dapps); keys deterministic from PRF |
| Key material security | Cross-origin iframe = separate OS process; keys never exposed to dapp code |

### 9.3 What "Universal" Actually Means

The wallet IS universal in terms of **identity** — same passkey, same keys, same account address across all dapps. The limitation is that **PXE sync data** (encrypted notes, nullifier tree) is per-dapp due to browser storage partitioning.

**The user experience**:
- First time on any dapp: biometric prompt → keys derived → PXE syncs from node (seconds to minutes depending on note history)
- Return visits to same dapp: biometric prompt → keys derived → PXE loads from local IndexedDB (instant on Chrome/Firefox, re-syncs on Safari)
- Switching dapps: biometric prompt → keys derived → PXE syncs (like first time on that dapp)

### 9.4 Component Breakdown

#### SDK Package (`@wonderland/aztec-wallet`)

What dapps install. Contains:
- React provider and hooks
- Iframe lifecycle manager
- Popup manager with fallback logic
- Comlink RPC wrapper for PXE communication
- PostMessage protocol implementation
- Browser capability detection

```typescript
import { AztecWalletProvider, ConnectButton } from '@wonderland/aztec-wallet';

const config = createAztecWalletConfig({
  walletHost: 'https://wallet.aztec.network', // iframe + popup host
  networks: [{ name: 'devnet', nodeUrl: 'https://devnet.aztec.network' }],
  passkey: {
    rpName: 'Aztec Wallet',
    prfSalt: 'aztec-wallet-master-key-v1',
  },
});

function App() {
  return (
    <AztecWalletProvider config={config}>
      <ConnectButton />
      <MyDapp />
    </AztecWalletProvider>
  );
}
```

#### Wallet Host (`wallet.aztec.network`)

A static web app deployed at the neutral domain. Serves:
- `/pxe` — Hidden iframe page: PXE compute engine
- `/auth` — Popup page: passkey operations, key derivation, approval UI
- `/` — Landing page: first-party visit for Storage Access API prerequisite

**HTTP Headers for `/pxe` (iframe)**:
```
Document-Isolation-Policy: isolate-and-credentialless
Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self' wss://*.aztec.network; frame-ancestors *; object-src 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Permissions-Policy: publickey-credentials-get=*, publickey-credentials-create=*
```

#### PostMessage Protocol

```typescript
// Message format
interface WalletMessage {
  id: string;           // UUID for request-response correlation
  topic: WalletTopic;   // 'ready' | 'rpc-request' | 'rpc-response' | 'auth' | 'close' | 'error'
  payload: unknown;
  timestamp: number;    // Replay protection
  version: number;      // Protocol version for backward compatibility
}

// Topics
type WalletTopic =
  | 'ready'          // Iframe/popup signals initialization complete
  | 'rpc-request'    // Dapp → iframe: PXE operation request
  | 'rpc-response'   // Iframe → dapp: PXE operation result
  | 'auth-request'   // Iframe → popup: key derivation request
  | 'auth-response'  // Popup → iframe: derived keys
  | 'approve'        // Show approval UI for transaction
  | 'close'          // Close popup/dialog
  | 'error'          // Error notification
```

---

## 10. Security Model

### 10.1 Threat Matrix

| Threat | Severity | Mitigation | Residual Risk |
|--------|----------|------------|---------------|
| **Wallet host compromise** | Critical | Reproducible builds, multi-party deploy signing, content hash monitoring, DNSSEC, CT monitoring | If compromised, all users affected. No browser-native SRI for iframes. |
| **Malicious browser extension** | Critical | User education; cross-origin process isolation limits extension reach (Manifest V3) | Extensions with host permissions CAN inject into cross-origin iframes. Architectural limitation. |
| **PostMessage origin spoofing** | Critical | Exact-match origin validation on EVERY message; never use `"*"` for targetOrigin | None if implemented correctly |
| **DoubleClickjacking** | High | Disable approval buttons for 2-3 seconds after rendering; require deliberate gesture | Partial — novel attack (Dec 2024), bypasses all traditional defenses |
| **SVG clickjacking** | High | CSP restricting SVG filters; popup fallback for signing | Chrome still unpatched as of late 2025 |
| **Clickjacking (classic)** | High | IntersectionObserver v2 (Chrome); popup fallback for untrusted hosts | IOv2 Chrome-only |
| **XSS in dapp reads keys** | Medium | Cross-origin iframe = separate OS process (Site Isolation); keys never in dapp context | Safe via browser architecture |
| **DNS hijacking** | Medium | DNSSEC + HSTS preload + CT monitoring + registrar lock | Mitigated but not eliminated |
| **Safari WebAuthn in iframe** | Medium | Auto-fallback to popup for credential creation | Handled |
| **IndexedDB theft from iframe** | Low | Cross-origin protection; PXE data is encrypted; keys not stored in IndexedDB | Attacker would need key material to decrypt notes |
| **Spectre side-channel** | Low | Cross-origin iframe = cross-process (Site Isolation) | Android WebView: no site isolation |

### 10.2 Key Security Principles

1. **The wallet MUST be on a distinct registrable domain (eTLD+1) from any dapp.** This ensures Chrome's Site Isolation puts them in separate OS processes, protecting key material even from Spectre attacks.

2. **Never use `postMessage(data, "*")`.** Always specify exact target origin. Porto's CVE analysis showed Azure/Bing leaking auth tokens via wildcard.

3. **Validate origin on every single message.** Use exact string match against an allowlist. Never substring/startsWith/regex.

4. **Key material never crosses the postMessage boundary.** Derived keys stay in the iframe/popup context. Only operation results (balances, tx hashes) are sent to the dapp.

5. **Passkey PRF output never stored persistently.** Derived on-demand via biometric, used in memory, cleared on page close.

6. **Transaction approval must show details inside the trusted context** (popup or iframe dialog), not in the dapp. The dapp could display fake transaction details.

### 10.3 The 1Password Problem

1Password extension adds `inert` attribute to `<dialog>` elements, making the wallet dialog completely non-interactive. **Affects millions of users.**

**Required fix** (from Porto source code):
```typescript
// MutationObserver to remove inert attribute added by 1Password
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.attributeName === 'inert') {
      dialog.removeAttribute('inert');
    }
  }
});
observer.observe(dialog, { attributes: true });
```

### 10.4 Trusted Hosts and Referrer Verification

Follow Porto's pattern:
- Maintain a list of trusted host domains
- For trusted hosts: skip IntersectionObserver check (trust the host won't clickjack)
- For untrusted hosts: require IOv2 visibility check OR fall back to popup
- Optional: server-side referrer verification endpoint

---

## 11. Performance Analysis

### 11.1 WASM Proving in Iframes

**No performance overhead.** V8/SpiderMonkey/JSC execute WASM identically regardless of browsing context. Cross-origin iframe gets a separate renderer process (~10-30MB overhead) but execution speed is unaffected.

### 11.2 Multi-Threaded Proving: SharedArrayBuffer

Multi-threaded WASM proving requires SharedArrayBuffer, which requires cross-origin isolation.

**Document-Isolation-Policy (Chrome 137+)** is the key enabler:
- The PXE iframe can independently opt into cross-origin isolation
- No headers required from the parent dapp
- Dapps just embed `<iframe src="...">` and it works

| Browser | Multi-threaded proving? | How? |
|---------|------------------------|------|
| Chrome 137+ | Yes | Document-Isolation-Policy on iframe |
| Chrome <137 | Only if dapp sets COOP/COEP | Requires dapp cooperation |
| Firefox | Only if dapp sets COOP/COEP | Requires dapp cooperation |
| Safari | No | No DIP support; COEP credentialless not implemented |

**Fallback**: Barretenberg ships single-threaded WASM build. ~4x slower but works everywhere.

### 11.3 Proving Benchmarks

| Operation | Platform | Threading | Time |
|---|---|---|---|
| UltraHonk P-256 ECDSA proof | M1 MacBook (browser) | Multi-threaded | **2.06s** |
| Same | M1 MacBook | Single-threaded | **8.06s** |
| Same | Samsung Galaxy A23 | Multi-threaded | ~6s |
| Same | iPhone 16/Pro | Any | **OOM crash** |

**Mobile strategy needed**: iPhone cannot complete proofs in-browser due to memory limits. Options (privacy-preserving only):
1. Simpler circuits for mobile (smaller memory footprint)
2. Progressive enhancement (full features on desktop, reads/simulates only on mobile)
3. Wait for Barretenberg memory optimizations (already reduced 26% via polynomial batching)

### 11.4 Iframe Communication Performance

| Data size | Structured clone | Transferable (zero-copy) | Speedup |
|---|---|---|---|
| 32 MB ArrayBuffer | ~302ms | ~6.6ms | ~45x |
| < 100 KB | Negligible | Negligible | ~1x |

For typical PXE responses (balances, tx hashes — kilobytes), structured cloning is fine. For large transfers (witness data), use Transferable ArrayBuffers.

**Recommended library**: **Comlink** (1.1KB) by Google Chrome Labs. ES6 Proxy-based RPC makes the iframe PXE look like a local object:
```typescript
// In dapp
const pxe = Comlink.wrap(Comlink.windowEndpoint(iframe.contentWindow));
const balance = await pxe.getBalance(address); // Looks local, runs in iframe
```

### 11.5 PXE Sync Cost

**This is the critical unknown.** The cost of PXE re-sync (downloading and decrypting notes from the Aztec node) determines whether per-dapp PXE is acceptable:

| Sync time | Per-dapp PXE viable? | User impact |
|---|---|---|
| < 5 seconds | Yes — barely noticeable | Loading spinner on first visit |
| 5-30 seconds | Tolerable with good UX | Progress indicator, skeleton screen |
| 30s - 5 minutes | Painful | Needs optimization (partial sync, background loading) |
| > 5 minutes | Not viable per-dapp | Must push for Aztec-level sync optimizations (tagged notes, partial scanning) |

**TODO (when iframe is implemented)**: Benchmark PXE sync time for typical accounts on devnet to determine which category we fall into. For now, we design the architecture to handle all scenarios gracefully via UX patterns (progress indicators, background sync, skeleton screens).

### 11.6 WASM Module Caching

V8 caches compiled WASM via streaming API. Key requirements:
- Serve `.wasm` from stable URL with proper cache headers
- Module must be > 128KB (Barretenberg is well above this)
- Hot-run deserialization is "faster and less CPU-intensive than compiling"
- Same URL across page loads (no cache-busting query params)

This means second-visit PXE initialization will be much faster than first visit.

---

## 12. UX Considerations

### 12.1 The Dual-Mode Pattern

All successful iframe wallets use **two modes**:
1. **Invisible iframe** — background compute (PXE, signing, sync)
2. **Visible popup/dialog** — user-facing interactions (passkey prompt, tx approval)

We should follow this pattern.

### 12.2 Safari WebAuthn Limitation

Safari does NOT support `navigator.credentials.create()` in cross-origin iframes. Throws `NotAllowedError`.

**Non-negotiable**: Passkey creation MUST use popup on Safari. Porto detects this and auto-falls back.

### 12.3 Critical Small Things

| Issue | Impact | Fix |
|---|---|---|
| 1Password `inert` on `<dialog>` | Dialog non-interactive for millions of users | MutationObserver removing `inert` |
| Ad blockers kill iframe silently | No error event, wallet doesn't load | Detect via postMessage handshake timeout; show whitelist guide |
| White flash on iframe load | Jarring visual glitch | `visibility: hidden` until `onload` fires |
| Browser tab sleeping (5-7 min) | WebSocket disconnects, PXE state stale | Page Visibility API; reconnect on resume |
| 20-second init timeout too short | Fails in constrained environments (Telegram Mini Apps) | Configurable, generous default timeout |
| Focus not restored on dialog close | Keyboard users lose position | Store `activeElement`, restore on close |
| bfcache incompatibility | Pages with postMessage bridges not cached | Close bridges on `pagehide`, reestablish on `pageshow` |
| Mobile drawer vs desktop floating | Poor mobile UX with desktop-sized dialog | `matchMedia('(max-width: 460px)')` for responsive layout |
| Multiple dapps open simultaneously | State conflicts, multiple PXE instances | BroadcastChannel for cross-tab coordination (same-origin) |

### 12.4 Loading States

```
First visit:
  [Biometric prompt] → [Deriving keys...] → [Syncing with network... (X%)] → [Ready]

Return visit (Chrome/Firefox):
  [Biometric prompt] → [Loading wallet...] → [Ready]

Return visit (Safari):
  [Biometric prompt] → [Deriving keys...] → [Syncing with network... (X%)] → [Ready]
```

Use skeleton screens during loading. Show at least 500ms of skeleton to avoid jarring flash. Don't show skeleton if load completes in <300ms.

### 12.5 Error Recovery

| Error | Recovery |
|---|---|
| Iframe fails to load | Timeout on postMessage handshake; show retry button; suggest whitelist if ad blocker detected |
| Popup blocked | Show clear instructions to allow popups for wallet domain |
| Passkey not available | Fall back to existing embedded/external signer connectors |
| PXE sync fails | Retry with exponential backoff; show progress to user |
| WebSocket disconnects | Auto-reconnect on Page Visibility resume |
| iframe OOM (mobile) | Detect via heartbeat timeout; suggest desktop or simpler operation |

---

## 13. Limitations

### Browser Hard Constraints

| Limitation | Impact | Permanent? |
|---|---|---|
| IndexedDB partitioned by top-level origin in all browsers | Per-dapp PXE sync (no shared note data) | Yes — privacy feature, won't change |
| Safari iframe IndexedDB is ephemeral (RAM-only) | Re-sync every browser session on Safari | Yes — WebKit design decision |
| Safari 7-day storage eviction (even first-party) | Data deleted after 7 days without user interaction | Yes — only PWAs exempt |
| No SRI for iframes (W3C open issue) | Can't verify iframe content integrity before loading | Until W3C ships it |
| StorageAccessHandle is Chrome-only | Unpartitioned IndexedDB only on Chrome 125+ | Until Firefox/Safari implement |
| Document-Isolation-Policy Chrome 137+ desktop only | Multi-threaded proving only on Chrome desktop without dapp headers | Until other browsers adopt |

### WebAuthn / Passkey Constraints

| Limitation | Impact | Workaround |
|---|---|---|
| Safari blocks `credentials.create()` in cross-origin iframes | Passkey registration must use popup on Safari | Auto-detect and fall back |
| PRF not supported on Windows Hello | Windows users without hardware key can't use passkey wallet | Fallback to embedded wallet |
| PRF requires biometric per session | One touch per page load, can't be silent | Session keys for in-session automation |
| No batch signing with passkeys | Each WebAuthn assertion needs separate gesture | PRF-derived software key signs in memory after initial derivation |
| Passkeys are origin-bound (RP ID) | Domain is a permanent choice | Use `aztec.network` (broadest scope) |
| Cloud platform custody | Account security = Apple/Google account security | Multi-passkey + hardware backup |

### PXE / Aztec Constraints

| Limitation | Impact | Path Forward |
|---|---|---|
| PXE must be fully local (privacy) | No server-side cache or relay | Client-side optimizations only |
| Note sync scales with network history | Cold sync gets slower as network matures | Aztec tagged notes, partial scanning |
| iPhone OOMs on ZK proof generation | No proving on mobile | Desktop-only proving; wait for Barretenberg memory optimizations |
| Safari iframe storage quota: 10% of parent | Limited PXE data on Safari (moot since ephemeral) | N/A |

### UX / Ecosystem Constraints

| Limitation | Impact | Mitigation |
|---|---|---|
| Ad blockers kill iframe silently (no error event) | Wallet doesn't load for strict ad blocker users | PostMessage handshake timeout + whitelist guide |
| 1Password breaks `<dialog>` elements | Dialog non-interactive for millions of users | MutationObserver removing `inert` attribute |
| IntersectionObserver v2 Chrome-only | Can't detect clickjacking on Firefox/Safari | Popup fallback for signing on those browsers |
| Popup blockers on mobile | Popup fallback itself may be blocked | Careful user-gesture chaining |
| bfcache incompatibility | No instant back/forward navigation | Close bridges on `pagehide`, reestablish on `pageshow` |

### What We Accept

| We accept... | Because... |
|---|---|
| Per-dapp PXE sync | Browser partitioning + privacy (no server cache) — permanent |
| Safari re-syncs every session | Ephemeral iframe storage — no workaround |
| Single-threaded proving on most browsers | DIP adoption is Chrome-only for now |
| Windows Hello users need fallback | No PRF support, no timeline |
| One biometric touch per session | WebAuthn requires user gesture — by design |
| Domain `aztec.network` is permanent | RP ID can never change without breaking all passkeys |
| Browser extensions remain a threat | Architectural limitation — encryption helps but doesn't eliminate |

---

## 14. Critical Open Questions

### 14.1 PXE Sync Cost (MUST ANSWER BEFORE PROCEEDING)

How long does PXE note sync take for a typical account? This single metric determines whether per-dapp PXE is viable or if we need a shared storage solution.

**To benchmark**:
1. Create an account with ~10-100 notes on devnet
2. Measure time from PXE initialization to fully synced
3. Test on desktop (Chrome, Firefox, Safari) and mobile
4. Test with cold start (no IndexedDB) vs warm start (existing IndexedDB)

### 14.2 Who Hosts `wallet.aztec.network`?

The wallet host is a critical trust point. All users implicitly trust it. Options:
- Aztec Labs operates it (centralized but trusted)
- Decentralized hosting via IPFS/Arweave (immutable but harder to update)
- Multiple operators with DNS round-robin (resilience)
- Client-side verification of served assets (hash pinning in SDK)

### 14.3 Mobile Strategy

iPhone OOMs on ZK proof generation. Options (all preserving privacy):
1. **Simplified circuits**: Limit mobile to simpler operations with smaller circuits
2. **Desktop-only proving**: Mobile users limited to reads/simulates, must use desktop for transactions requiring proofs
3. **Deferred proving**: Mobile signs and queues transactions, proving happens when user is back on desktop
4. **Wait for hardware improvements**: Mobile WASM memory limits may increase over time
5. **Aztec proving optimizations**: Barretenberg team is actively reducing memory usage (26% reduction via polynomial batching already shipped)

### 14.4 Upgrade Path for Shared Storage

If browser vendors eventually support unpartitioning IndexedDB across all browsers (via SAA extensions), we should be ready to upgrade. Design the iframe's IndexedDB access through an abstraction layer that can switch between partitioned and unpartitioned access.

### 14.5 Relationship to Existing aztec-wallet Connectors

The iframe PXE wallet is a new connector type alongside existing ones:
- `EmbeddedConnector` — current, keys in localStorage
- `ExternalSignerConnector` — EVM wallet signing
- `BrowserWalletConnector` — extensions like Azguard
- **`IframePXEConnector`** (NEW) — iframe-based PXE with passkey auth

The existing `AztecExecutionClient` interface should work as the boundary — the iframe PXE implements the same execution interface, just over postMessage instead of directly.

### 14.6 Multi-Account Support

Should one passkey support multiple accounts? Options:
- Different PRF salts per account: `"aztec-wallet-account-1-v1"`, `"aztec-wallet-account-2-v1"`
- Each salt produces different keys = different account
- UI for account selection in the popup

### 14.7 Fee Payment and Sponsorship

Who pays for transactions made via the iframe wallet? Same patterns as current embedded wallet:
- Native fee payment (user pays gas)
- Sponsored fees (dapp pays via FPC)
- The iframe wallet should support both, configured by the dapp

---

## 15. Decision Matrix

### Architecture Decision

Option C (SDK-only, no iframe) is rejected — keys accessible to dapp code is unacceptable for production.

| Criteria | Weight | Option A (Pure Iframe) | Option B+D (Hybrid — Recommended) |
|---|---|---|---|
| Cross-browser compatibility | 25% | Poor (Safari data loss, no popup fallback) | Good (popup handles Safari limitations) |
| Key isolation from dapp | 25% | Excellent (cross-process) | Excellent (cross-process) |
| Universal wallet identity | 20% | Yes (shared RP ID) | Yes (shared RP ID) |
| Safari resilience | 15% | Poor (ephemeral + no WebAuthn create) | Good (popup for WebAuthn + key re-derivation) |
| PXE on Chrome with SAA | 15% | No (no first-party prerequisite) | Yes (Cartridge pattern establishes prerequisite) |
| **Verdict** | | Viable but fragile | **Recommended — most resilient** |

### Browser Support Matrix

| Feature | Chrome 137+ | Chrome 125-136 | Firefox 139+ | Safari 18.4+ | Mobile Safari | Windows (Hello) |
|---|---|---|---|---|---|---|
| Iframe PXE compute | Yes | Yes | Yes | Yes | Yes (limited) | Yes |
| Multi-threaded proving | Yes (DIP) | Only with dapp COOP/COEP | Only with dapp COOP/COEP | No | No | Only with dapp COOP/COEP |
| Passkey create in iframe | Yes | Yes | Yes | **No (popup)** | **No (popup)** | Yes |
| Passkey sign in iframe | Yes | Yes | Yes | Yes | Yes | Yes |
| **PRF key derivation** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | **NO (external key only)** |
| Shared IndexedDB (SAA) | Yes | Yes | No | No | No | No |
| Persistent iframe IndexedDB | Yes | Yes | Yes | **No (ephemeral)** | **No (ephemeral)** | Yes |
| Encrypted IndexedDB (AES-GCM) | Yes | Yes | Yes | Yes (ephemeral) | Yes (ephemeral) | Yes |
| PXE re-sync needed? | No (if SAA granted) | No (if SAA granted) | Yes (per-dapp) | Yes (every session) | Yes (every session) | Yes (per-dapp) |

---

## 16. Sources

### Porto/Tempo (Primary Reference)
- Porto SDK Documentation — https://porto.sh/sdk
- Porto GitHub — https://github.com/ithacaxyz/porto
- Porto Dialog.ts (iframe management) — github.com/ithacaxyz/porto/blob/main/src/core/Dialog.ts
- Porto Messenger.ts (postMessage protocol) — github.com/ithacaxyz/porto/blob/main/src/core/Messenger.ts
- Porto trusted-hosts.ts — github.com/ithacaxyz/porto/blob/main/src/trusted-hosts.ts
- Tempo Docs — https://docs.tempo.xyz
- Ithaca x Tempo announcement — paradigm.xyz/2025/10/ithaca-x-tempo

### Browser Storage & Partitioning
- Chrome Storage Partitioning — developer.chrome.com/docs/privacy-sandbox/storage-partitioning/
- Firefox State Partitioning — developer.mozilla.org/en-US/docs/Web/Privacy/State_Partitioning
- WebKit Tracking Prevention — webkit.org/tracking-prevention/
- Safari Full Third-Party Cookie Blocking — webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- WebKit Storage Quota Updates (Safari 17) — webkit.org/blog/14403/updates-to-storage-policy/

### Storage Access API
- W3C Storage Access API Spec — privacycg.github.io/storage-access/
- SAA Non-Cookie Storage Proposal — github.com/privacycg/saa-non-cookie-storage
- Chrome SAA Non-Cookie Storage — chromestatus.com/feature/5175585823522816
- MDN StorageAccessHandle — developer.mozilla.org/en-US/docs/Web/API/StorageAccessHandle
- Mozilla Standards Position (Positive) — github.com/mozilla/standards-positions/issues/898
- WebKit Standards Position (No Response) — github.com/WebKit/standards-positions/issues/262

### Cross-Origin Isolation & Performance
- Document-Isolation-Policy — developer.chrome.com/blog/document-isolation-policy
- COOP/COEP guide — web.dev/articles/coop-coep
- StackBlitz Cross-Browser COEP — blog.stackblitz.com/posts/cross-browser-with-coop-coep/
- V8 WASM Code Caching — v8.dev/blog/wasm-code-caching
- Barretenberg Proving Benchmarks — blog.hyli.org/benchmarking-in-browser-p256-ecdsa-proving-systems/

### Security
- Dfns: Cracks in Wallet Iframe Security — dfns.co/article/cracks-in-wallet-iframe-security
- Microsoft PostMessage Vulnerabilities — microsoft.com/en-us/msrc/blog/2025/08/postmessaged-and-compromised
- DoubleClickjacking (Dec 2024) — evil.blog/2024/12/doubleclickjacking-what.html
- SVG Clickjacking (2025) — lyra.horse/blog/2025/12/svg-clickjacking/
- Chromium Post-Spectre Threat Model — chromium.googlesource.com/chromium/src/+/master/docs/security/side-channel-threat-model.md
- MetaMask Snaps Audit — osec.io/blog/2023-11-01-metamask-snaps/
- IntersectionObserver v2 — web.dev/articles/intersectionobserver-v2
- Polyfill.io Supply Chain Attack — sonatype.com/blog/polyfill.io-supply-chain-attack
- SquareX: Passkeys Pwned (DEF CON 33) — sqrx.com/passkeys-pwned

### UX & Iframe Patterns
- Privy Embedded Wallet Architecture — privy.io/blog/embedded-wallet-architecture
- Cartridge Controller — docs.cartridge.gg/controller/getting-started
- Magic Widget UI — magic.link/docs/wallets/customization/widget-ui
- Comlink (iframe RPC) — github.com/GoogleChromeLabs/comlink
- Penpal (iframe communication) — github.com/Aaronius/penpal
- Turnkey: Why They Abandoned Iframes — turnkey.com/blog/introducing-indexeddb-improved-session-persistence

### Passkey Cryptography
- W3C WebAuthn Level 3 — w3.org/TR/webauthn-3/
- W3C WebAuthn PRF Explainer — github.com/w3c/webauthn/wiki/Explainer:-PRF-extension
- Yubico CTAP2 HMAC Secret Deep Dive — developers.yubico.com/WebAuthn/Concepts/PRF_Extension/CTAP2_HMAC_Secret_Deep_Dive.html
- Yubico Developers Guide to PRF — developers.yubico.com/WebAuthn/Concepts/PRF_Extension/Developers_Guide_to_PRF.html
- Corbado: Passkeys & WebAuthn PRF for E2E Encryption — corbado.com/blog/passkeys-prf-webauthn
- Filippo Valsorda: A Wide Reduction Trick — words.filippo.io/dispatches/wide-reduction/
- Bitwarden PRF Architecture — contributing.bitwarden.com/architecture/deep-dives/passkeys/implementations/relying-party/prf/
- RFC 5869: HKDF — datatracker.ietf.org/doc/html/rfc5869
- RFC 9380: Hashing to Elliptic Curves — ietf.org/rfc/rfc9380.html
- Noble Cryptography (6 audit reports) — paulmillr.com/noble/
- Para: Why Passkey-Only Wallets Will Fail — blog.getpara.com/passkey-wallets/
- Varun Srinivasan: The Problem with Passkeys — varunsrinivasan.com/2026/01/10/the-problem-with-passkeys
- FIDO Alliance CXP/CXF Specs — fidoalliance.org/fido-alliance-publishes-new-specifications-to-promote-user-choice-and-enhanced-ux-for-passkeys/

### Encryption & WebCrypto
- W3C WebCrypto Non-Extractable Key Security — github.com/w3c/webcrypto/issues/269
- MDN SubtleCrypto — developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
- Turnkey IndexedDB Stamper — github.com/niclasmattsson/turnkey-sdk-js/packages/indexed-db-stamper
- Corbado: Cross-Origin iframe Passkey Challenges — corbado.com/blog/iframe-passkeys-webauthn/cross-origin-iframe-passkey-challenges
- web.dev: RP ID Deep Dive — web.dev/articles/webauthn-rp-id
- web.dev: Related Origin Requests — web.dev/articles/webauthn-related-origin-requests

### Porto/Tempo (Primary Reference)
- Porto SDK Documentation — https://porto.sh/sdk
- Porto GitHub — https://github.com/ithacaxyz/porto
- Porto Dialog.ts (iframe management) — github.com/ithacaxyz/porto/blob/main/src/core/Dialog.ts
- Porto Messenger.ts (postMessage protocol) — github.com/ithacaxyz/porto/blob/main/src/core/Messenger.ts
- Porto trusted-hosts.ts — github.com/ithacaxyz/porto/blob/main/src/trusted-hosts.ts
- Tempo Docs — https://docs.tempo.xyz
- Ithaca x Tempo announcement — paradigm.xyz/2025/10/ithaca-x-tempo

### Browser Storage & Partitioning
- Chrome Storage Partitioning — developer.chrome.com/docs/privacy-sandbox/storage-partitioning/
- Firefox State Partitioning — developer.mozilla.org/en-US/docs/Web/Privacy/State_Partitioning
- WebKit Tracking Prevention — webkit.org/tracking-prevention/
- Safari Full Third-Party Cookie Blocking — webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- WebKit Storage Quota Updates (Safari 17) — webkit.org/blog/14403/updates-to-storage-policy/

### Storage Access API
- W3C Storage Access API Spec — privacycg.github.io/storage-access/
- SAA Non-Cookie Storage Proposal — github.com/privacycg/saa-non-cookie-storage
- Chrome SAA Non-Cookie Storage — chromestatus.com/feature/5175585823522816
- MDN StorageAccessHandle — developer.mozilla.org/en-US/docs/Web/API/StorageAccessHandle
- Mozilla Standards Position (Positive) — github.com/mozilla/standards-positions/issues/898
- WebKit Standards Position (No Response) — github.com/WebKit/standards-positions/issues/262

### Cross-Origin Isolation & Performance
- Document-Isolation-Policy — developer.chrome.com/blog/document-isolation-policy
- COOP/COEP guide — web.dev/articles/coop-coep
- StackBlitz Cross-Browser COEP — blog.stackblitz.com/posts/cross-browser-with-coop-coep/
- V8 WASM Code Caching — v8.dev/blog/wasm-code-caching
- Barretenberg Proving Benchmarks — blog.hyli.org/benchmarking-in-browser-p256-ecdsa-proving-systems/

### Security
- Dfns: Cracks in Wallet Iframe Security — dfns.co/article/cracks-in-wallet-iframe-security
- Microsoft PostMessage Vulnerabilities — microsoft.com/en-us/msrc/blog/2025/08/postmessaged-and-compromised
- DoubleClickjacking (Dec 2024) — evil.blog/2024/12/doubleclickjacking-what.html
- SVG Clickjacking (2025) — lyra.horse/blog/2025/12/svg-clickjacking/
- Chromium Post-Spectre Threat Model — chromium.googlesource.com/chromium/src/+/master/docs/security/side-channel-threat-model.md
- MetaMask Snaps Audit — osec.io/blog/2023-11-01-metamask-snaps/
- IntersectionObserver v2 — web.dev/articles/intersectionobserver-v2
- Polyfill.io Supply Chain Attack — sonatype.com/blog/polyfill.io-supply-chain-attack

### UX & Iframe Patterns
- Privy Embedded Wallet Architecture — privy.io/blog/embedded-wallet-architecture
- Cartridge Controller — docs.cartridge.gg/controller/getting-started
- Magic Widget UI — magic.link/docs/wallets/customization/widget-ui
- Comlink (iframe RPC) — github.com/GoogleChromeLabs/comlink
- Penpal (iframe communication) — github.com/Aaronius/penpal
- Turnkey: Why They Abandoned Iframes — turnkey.com/blog/introducing-indexeddb-improved-session-persistence

### WebAuthn & Passkeys
- W3C WebAuthn Level 3 — w3.org/TR/webauthn-3/
- Corbado: Cross-Origin iframe Passkey Challenges — corbado.com/blog/iframe-passkeys-webauthn/cross-origin-iframe-passkey-challenges
- WebKit Safari WebAuthn iframe issue — github.com/WebKit/standards-positions/issues/304
- PRF Extension Explainer — github.com/w3c/webauthn/wiki/Explainer:-PRF-extension
