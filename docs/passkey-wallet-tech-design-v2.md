# Passkey Wallet Technical Design v2

**Date**: 2026-03-27
**Status**: Draft

---

## Scope

A passkey-authenticated Aztec wallet delivered as an embeddable iframe — functionally equivalent to a browser extension wallet (like Azguard) but with zero install.

The iframe IS the wallet. The dapp is just a UI. Signing keys never leave hardware.

- **Authentication**: Passkeys (Face ID / Touch ID / fingerprint)
- **Signing**: Direct WebAuthn — every transaction signed by the secure element, P-256 private key never in JavaScript ([W3C WebAuthn spec](https://w3c.github.io/webauthn/), [MDN Web Authentication API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API), [MDN credentials.get()](https://developer.mozilla.org/en-US/docs/Web/API/CredentialsContainer/get))
- **Privacy keys**: Derived from passkey PRF, live in JS memory for PXE operation. Includes viewing keys (decrypt your balances), nullifier keys (track spent notes), and tagging keys (find your transactions). Must be in JS — Aztec's PXE runs client-side. XSS risk: privacy exposure only, not funds.

  **How PRF works**: The passkey stores a secret value (CredRandom, 32 bytes, generated at creation, [CTAP2 hmac-secret spec](https://fidoalliance.org/specs/fido-v2.1-ps-20210615/fido-client-to-authenticator-protocol-v2.1-ps-errata-20220621.html#sctn-hmac-secret-extension)). On each biometric prompt, the browser domain-separates our salt (`SHA-256("WebAuthn PRF" || 0x00 || salt)`, [W3C PRF explainer](https://github.com/w3c/webauthn/wiki/Explainer:-PRF-extension)) and the authenticator computes `HMAC-SHA-256(CredRandom, transformedSalt)` → deterministic 32 bytes ([Yubico PRF deep dive](https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/CTAP2_HMAC_Secret_Deep_Dive.html)). Same passkey + same salt = same output, always. These 32 bytes are then expanded via HKDF-SHA-256 ([RFC 5869](https://datatracker.ietf.org/doc/html/rfc5869)) into the protocol keys that Aztec's `deriveKeys()` ([Aztec key derivation](https://docs.aztec.network/aztec/concepts/accounts/keys)) consumes.
- **Identity**: One passkey = one wallet = one address across all dapps
- **Contract**: Custom Noir account contract with WebAuthn envelope verification inside ZK circuits
- **Delivery**: Cross-origin iframe (`wallet.aztec.network`) + popup for passkey ceremonies and tx approval

### Out of scope (v1)

- Multi-passkey / key rotation (Model B)
- Social recovery / guardian keys
- Shared PXE across dapps
- Mobile proving
- Session keys
- Cross-device hybrid transport

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Dapp (any origin)                                            │
│  @wonderland/aztec-wallet SDK                                 │
│                                                               │
│  ┌──────────────────────────┐  ┌───────────────────────────┐ │
│  │  Hidden iframe            │  │  Popup (when needed)       │ │
│  │  wallet.aztec.network/pxe │  │  wallet.aztec.network/auth │ │
│  │                           │  │                            │ │
│  │  • PXE (WASM)            │  │  • Passkey create/auth     │ │
│  │  • Viewing keys in memory│  │  • PRF → protocol keys     │ │
│  │  • IndexedDB (encrypted, │  │  • WebAuthn signing        │ │
│  │    partitioned per dapp) │  │    (per-tx biometric)      │ │
│  │  • WebSocket → Node      │  │  • Tx approval UI          │ │
│  └──────────┬───────────────┘  └──────────┬────────────────┘ │
│             │ postMessage                  │ postMessage       │
│             ▼                              ▼                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Dapp SDK (thin RPC client, no keys, no PXE)            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Key design principles

- **Signing key never enters JavaScript.** The passkey's native P-256 key pair handles transaction signing directly in the secure element. PRF is still used for protocol keys (viewing, nullifier, tagging) and encryption.
- **Two operation lanes through the iframe:**
  - **Private reads** (private balances, notes, events): routed through the iframe. Require prior `connect` (biometric) so the user consciously authorizes the dapp to access private state. The iframe returns **results** (e.g., a balance number), never keys or capabilities.
  - **Writes** (transactions): routed through the iframe. Every write triggers a popup with transaction details + WebAuthn biometric signing in the hardware secure element.
- **Public reads** (unconstrained functions, public state) do not require the iframe — dapps can query the Aztec node directly without keys, PXE, or biometric. This is outside the scope of the wallet SDK.

---

## Key Derivation

One passkey provides two things: a **signing key** (hardware-bound, never in JS) and **deterministic bytes** (PRF, used to derive everything else). Different security levels by design.

### Signing key (hardware — from passkey creation)

```
navigator.credentials.create()
  → Authenticator generates P-256 key pair in secure element
  → Public key returned (x, y) → constructor args for account contract
  → Private key NEVER leaves hardware
  → Signs transactions via navigator.credentials.get({ challenge: outer_hash })
```

### Protocol keys, encryption, salt (JS — from PRF)

```
navigator.credentials.get({ extensions: { prf: { eval: { first: "aztec-wallet/v1/master-key" } } } })
  │
  ▼
PRF output (32 bytes)
  │
  ├── HKDF-SHA-256(info="aztec-wallet/v1/master-secret", 48 bytes)
  │     └── Fr.fromBufferReduce → masterSecret
  │           └── deriveKeys(masterSecret):
  │                 ├── nhk_m  (nullifier hiding key)
  │                 ├── ivsk_m (incoming viewing key)
  │                 ├── ovsk_m (outgoing viewing key)
  │                 └── tsk_m  (tagging key)
  │
  ├── HKDF-SHA-256(info="aztec-wallet/v1/encryption-key", 32 bytes)
  │     └── crypto.subtle.importKey("raw", ..., "AES-GCM") → non-extractable AES-256-GCM CryptoKey
  │
  └── HKDF-SHA-256(info="aztec-wallet/v1/account-salt", 48 bytes)
        └── Fr.fromBufferReduce → accountSalt
```

No signing key derived from PRF. The passkey's hardware key IS the signing key.

---

## Account Contract (Custom — WebAuthn Envelope Verification)

**Cannot use `EcdsaRAccountContract`** — it expects `SHA-256(outer_hash)` signatures. WebAuthn produces signatures over `SHA-256(authenticatorData || SHA-256(clientDataJSON))`. Different hash, incompatible.

### What WebAuthn signs

```
Passkey signs: SHA-256(authenticatorData || SHA-256(clientDataJSON))

Where:
  authenticatorData = rpIdHash[32] || flags[1] || counter[4]  (37 bytes, fixed)
  clientDataJSON    = {"type":"webauthn.get","challenge":"<base64url(outer_hash)>","origin":"https://wallet.aztec.network"}
```

### Custom Noir contract (is_valid_impl)

```noir
fn is_valid_impl(context: &mut PrivateContext, outer_hash: Field) -> bool {
    // Auth witness carries: signature[64] + authenticatorData[37] + clientDataJSON[~200]
    let witness = get_auth_witness(outer_hash);

    // 1. Extract components
    let signature: [u8; 64] = witness[0..64];
    let auth_data: [u8; 37] = witness[64..101];
    let client_data: [u8; N] = witness[101..];   // variable length

    // 2. Verify challenge in clientDataJSON matches outer_hash
    let expected_challenge = outer_hash.to_be_bytes::<32>();
    assert(client_data_contains_challenge(client_data, expected_challenge));
    //      ↑ requires: find "challenge" key, extract base64url value, decode, compare

    // 3. Reconstruct what the passkey signed
    let client_data_hash = sha256_var(client_data, client_data.len());
    let signed_payload = concat(auth_data, client_data_hash);
    let message_hash = sha256::digest(signed_payload);

    // 4. Verify P-256 signature (same blackbox as EcdsaR)
    let public_key = storage.signing_public_key.get_note();
    std::ecdsa_secp256r1::verify_signature(
        public_key.x, public_key.y,
        signature, message_hash
    )
}
```

### Circuit complexity

| Operation | Noir difficulty |
|---|---|
| SHA-256 fixed-length (authenticatorData) | Easy — existing `sha256::digest` |
| SHA-256 variable-length (clientDataJSON) | Medium — `sha256_var()` available but more constraints |
| Find "challenge" in JSON | Medium — byte-by-byte search for known prefix |
| Base64url decode | Medium — lookup table, 4 chars → 3 bytes |
| P-256 signature verification | Easy — existing `ecdsa_secp256r1::verify_signature` blackbox |
| Concatenation | Trivial |

### Constructor

Same as EcdsaR — stores P-256 public key from the passkey registration:

```noir
fn constructor(signing_pub_key_x: [u8; 32], signing_pub_key_y: [u8; 32]) {
    let pub_key_note = EcdsaPublicKeyNote { x: signing_pub_key_x, y: signing_pub_key_y };
    storage.signing_public_key.initialize(pub_key_note);
}
```

---

## Communication (Dapp ↔ Iframe ↔ Popup ↔ Node)

### Operation routing

The SDK routes operations based on their privacy requirements:

```
Dapp code
  │
  ├── Private read (balance_of_private, get notes, private events)
  │     → SDK → encrypted MessagePort → iframe (requires prior connect)
  │     Iframe processes via PXE → returns encrypted result only
  │
  └── Write (send tokens, deploy contract, etc.)
        → SDK → encrypted MessagePort → iframe → popup
        Popup shows tx details → WebAuthn biometric → hardware signs
```

Public reads (unconstrained functions, public state) are outside the wallet SDK's scope — dapps query the Aztec node directly for those.

### Secure channel

All dapp ↔ iframe communication runs over an encrypted **MessageChannel** (point-to-point, not broadcast `postMessage`). A single `postMessage` transfers the port to the iframe; all subsequent messages flow through the dedicated port pair, which is invisible to `window.addEventListener('message')` listeners — including isolated-world browser extension content scripts.

#### Key exchange

1. SDK creates `MessageChannel`, transfers `port2` to iframe via one `postMessage` with strict `targetOrigin` (no sensitive data in this message)
2. Both sides generate **ephemeral ECDH P-256** keypairs via Web Crypto (`crypto.subtle.generateKey`)
3. Public keys exchanged over the dedicated `MessagePort`
4. Both sides independently derive `ECDH shared secret` → 32 bytes (P-256 x-coordinate) via `crypto.subtle.deriveBits`

#### Key derivation (HKDF-SHA-256)

From the shared secret, two direction-separated encryption keys are derived:

```
ECDH shared secret (32 bytes)
  │
  ├── HKDF-SHA-256(salt, info="aztec-wallet/v1/parent-to-iframe") → 256 bits
  │     └── AES-256-GCM key (parent encrypts, iframe decrypts)
  │
  └── HKDF-SHA-256(salt, info="aztec-wallet/v1/iframe-to-parent") → 256 bits
        └── AES-256-GCM key (iframe encrypts, parent decrypts)

Salt (128 bytes): appPubX(32) || appPubY(32) || walletPubX(32) || walletPubY(32)
```

Direction-separated keys ensure a nonce collision across directions is harmless (different keys = different keystreams). This matches TLS 1.3, Signal, and WireGuard conventions.

#### Message encryption

Every message is encrypted with **AES-256-GCM**:
- **IV**: 12 bytes, randomly generated per message via `crypto.getRandomValues`
- **Tag**: 128 bits (Web Crypto default)
- **AAD (Additional Authenticated Data)**: the message's `id` UUID — authenticated but not encrypted, used for replay protection
- Keys imported as **non-extractable** `CryptoKey` objects — cannot be read via `exportKey()`

#### Replay protection

The receiver maintains a `Set` of seen message UUIDs. Any message with a previously-seen UUID is rejected. The UUID is bound to the ciphertext via AAD — an attacker cannot change the UUID without breaking the GCM authentication tag.

#### Wire format

```typescript
// Encrypted envelope (over MessagePort)
{
  id: "uuid-123",          // correlates request ↔ response, also serves as AAD
  dir: "p2i" | "i2p",      // direction tag
  iv: "<base64>",           // 12 bytes
  ct: "<base64>",           // ciphertext + 16-byte GCM tag
  version: 1
}

// Plaintext (inside ct, after decryption)
// Request:
{ method: "sendTx", params: { ... } }
// Response:
{ result: { txHash: "0x..." } }
// Error:
{ error: { code: "USER_REJECTED", message: "User cancelled" } }
```

#### Defense layers

| Layer | What it blocks |
|---|---|
| **Site Isolation** (cross-origin iframe = separate OS process) | XSS on dapp reading iframe memory |
| **MessageChannel** (point-to-point, not broadcast) | Isolated-world extension content scripts |
| **AES-256-GCM** (encrypted payload) | MAIN-world extension intercepting port messages |
| **Direction-separated keys** | Cross-direction nonce collision, message reflection |
| **UUID in AAD** | Replay attacks, message tampering |
| **Non-extractable CryptoKeys** | Casual JS key extraction |
| **Ephemeral ECDH per session** | Forward secrecy — past sessions safe if current compromised |

#### Security properties

| Property | Mechanism |
|---|---|
| Confidentiality | AES-256-GCM per message |
| Integrity | 128-bit GCM auth tag |
| Replay protection | UUID deduplication |
| Reflection protection | Separate keys per direction |
| Forward secrecy | Ephemeral ECDH per session (new keys every page load) |
| Dependencies | Zero — entirely Web Crypto API |

### What crosses the boundary

```
Dapp ← → Iframe (encrypted, over MessagePort)
  ✅ tx hashes, balances (computed values), addresses, errors, method calls
  ❌ signing keys, viewing keys, PRF output, raw notes, PXE state, encryption keys

Dapp ← → Aztec Node (public reads, outside wallet SDK scope)
  ✅ public state, contract data, block headers, unconstrained function results
  ❌ private state (requires iframe + PXE + viewing keys)
```

### RPC interface

The iframe exposes the **Wallet interface** (not raw PXE methods) — the same abstraction used by Aztec's wallet-sdk for browser extension wallets. The dapp calls wallet-level methods; the iframe owns PXE internally. Method calls are forwarded transparently via a JS `Proxy` backed by `WalletSchema` (Zod validation on both sides).

All iframe methods below require prior `connect` (biometric). The iframe rejects any request if the user has not authenticated.

| Method | Biometric? | Lane | What it does |
|---|---|---|---|
| `connect` | Yes (PRF) | Auth | Create/restore passkey, derive protocol keys, init PXE |
| `disconnect` | No | Auth | Wipe keys from memory, stop PXE |
| `sendTx` | Yes (WebAuthn) | Write | Build execution request → prove → submit → optionally wait for receipt |
| `simulateTx` | No | Private read | Simulate transaction locally (private + optional public) |
| `executeUtility` | No | Private read | Execute view/unconstrained function (any contract, any method) |
| `createAuthWit` | Yes (WebAuthn) | Write | Create authorization witness (account-level signing) |
| `registerContract` | No | Setup | Register contract instance + artifact (handles class registration and updates automatically) |
| `getContractMetadata` | No | Setup | Get contract instance + initialization/publication status |
| `getAccounts` | No | Account | List registered account addresses (no crypto material exposed) |
| `getAddressBook` | No | Account | List registered senders with aliases |
| `getChainInfo` | No | Network | Chain ID and rollup version |
| `getPrivateEvents` | No | Private read | Query private events by selector and filter |
| `registerSender` | No | PXE state | Register sender for private log scanning |
| `removeSender` | No | PXE state | Remove a registered sender |
| `profileTx` | No | Debug | Profile transaction gate counts and execution traces |
| `batch` | Depends | Batch | Execute multiple wallet methods in a single encrypted round-trip |

**Biometric gates:** `connect` (PRF + passkey) is the authentication gate — all other iframe methods require the user to have connected first. `sendTx` and `createAuthWit` (WebAuthn hardware signing) require an additional per-transaction biometric.

**Contract registration:** Dapps declare contracts at config time. The SDK batch-registers all contracts on connect via `wallet.batch([...registerContract calls])`, so the iframe's PXE has the artifacts it needs before any interaction. Dynamic registration (e.g., user-provided contract addresses) is available via the `registerContract` RPC method as a fallback.

```typescript
createPasskeyWalletConfig({
  walletUrl: "https://wallet.aztec.network",
  network: "devnet",
  contracts: [
    { contract: TokenContract, address: "0x..." },
    { contract: DripperContract, address: "0x..." },
  ]
});
```

**Why Wallet-level, not PXE-level:** The iframe is a wallet, not a PXE proxy. `sendTx` replaces the raw `proveTx` (orchestrates prove → submit → wait). `registerContract` replaces `registerContractClass` + `updateContract` (handles both automatically). `getAccounts` replaces `getRegisteredAccounts` (returns addresses only, no crypto material). Security-sensitive PXE methods like `registerAccount(secretKey)` are internal — the dapp never handles secret keys. This matches how Aztec's gregoswap project implements its iframe wallet, and is consistent with the wallet-sdk's `WalletSchema` interface.

---

## Session Lifecycle

```
Page Load → iframe loads → credentialId in IndexedDB?
  │                              │
  No                            Yes
  │                              │
  Show connect button           Auto biometric prompt (PRF only)
  │                              │
  User clicks → popup           PRF → HKDF → protocol keys (memory)
  │                              │
  Create passkey                PRF → HKDF → encryption key (memory)
  + PRF → protocol keys          │
  │                              Decrypt PXE cache from IndexedDB
  Store credentialId              │
  + store public key             PXE resumes from checkpoint
  │                              (syncs only new blocks)
  PXE syncs from network          │
  │                              Session active
  Session active                  (private reads + signing on demand)
```

### What "memory" means

**JS runtime heap only.** Protocol keys exist as JavaScript variables during page execution. They are:
- Never serialized to any format
- Never written to IndexedDB, localStorage, sessionStorage, or cookies
- Never passed to `structuredClone`, `JSON.stringify`, or any persistence API
- Garbage collected when the page closes, refreshes, or navigates away

### Storage split

**In JS runtime memory (cleared on refresh/close/navigate):**
- Viewing keys (ivsk_m, ovsk_m)
- Nullifier key (nhk_m), tagging key (tsk_m)
- Master secret
- PRF output (32 bytes)
- PRF-derived encryption key (AES-256-GCM, non-extractable CryptoKey — used to decrypt PXE cache, then held in memory for cache writes on disconnect)

**In hardware (never leaves secure element):**
- Signing key (passkey's P-256 private key)
- CredRandom (HMAC key for PRF)

**In IndexedDB (persists, iframe origin, partitioned per dapp):**
- `credentialId` + P-256 public key — unencrypted, public data
- Encrypted PXE cache — see below
- Contract artifacts + instances — unencrypted, public data
- WASM modules — via Cache API / Service Worker

### PXE cache

The PXE cache is the critical persistence optimization. It stores a checkpoint of the PXE's synced state so return visits don't re-sync from genesis.

**What's cached:**
- Decrypted notes (private UTXOs — balances, token amounts, metadata)
- Nullifier index (which notes have been spent)
- Sync cursor (last block number processed)

**Encryption:** The PXE cache is encrypted at rest with the PRF-derived AES-256-GCM key. This key only exists in JS runtime memory after biometric authentication. Between sessions, the encrypted cache is opaque bytes in IndexedDB — no decryption oracle exists on disk.

```
On session end (page close / disconnect):
  encrypted_cache = AES-GCM.encrypt(prf_derived_key, serialize(notes + nullifiers + sync_cursor))
  → store encrypted_cache in IndexedDB
  → prf_derived_key is garbage collected (memory only)
  → IndexedDB contains undecryptable bytes

On next page load:
  biometric → PRF → HKDF → same encryption key (deterministic)
  pxe_state = AES-GCM.decrypt(prf_derived_key, encrypted_cache)
  → PXE resumes from sync cursor, only fetches new blocks
```

**Browser behavior:**
- **Chrome / Firefox:** IndexedDB persists to disk (partitioned per dapp). Return visits decrypt cache and resume. Fast restore (~2-3s after biometric).
- **Safari:** IndexedDB in cross-origin iframes is ephemeral (RAM only, cleared on browser restart). Every session starts with a full PXE re-sync from the network. This is a graceful degradation, not a bug.

**Page refresh**: one biometric → PRF → re-derive protocol keys → decrypt PXE cache → PXE resumes from checkpoint

---

## Transaction Flow

```
User action (e.g., "Send 10 tokens")
  │
  ▼
Dapp SDK → postMessage → iframe
  │
  ▼
Iframe builds AppPayload → poseidon2Hash → outer_hash
  │
  ▼
Popup opens with tx details (trusted context) + WebAuthn signing prompt:

  navigator.credentials.get({
    publicKey: {
      challenge: outer_hash_bytes,              ← tx hash IS the challenge
      allowCredentials: [{ id: credentialId }],
      userVerification: "required"
    }
  })
  │
  ▼
User does Face ID / Touch ID (per transaction)
  │
  ▼
Authenticator signs: SHA-256(authenticatorData || SHA-256(clientDataJSON))
  where clientDataJSON.challenge = base64url(outer_hash)
  │
  ▼
AuthWitness = [signature[64], authenticatorData[37], clientDataJSON[~200]]
  │
  ▼
Custom Noir contract verifies inside ZK proof:
  1. Extract challenge from clientDataJSON → matches outer_hash? ✓
  2. Reconstruct signed payload → SHA-256 → message_hash
  3. verify_signature(stored_pubkey, signature, message_hash) → true ✓
  │
  ▼
PXE generates ZK proof → submits to network
```

Private reads (balances, notes, events) require prior `connect` (biometric) and are processed inside the iframe via PXE — the iframe returns computed results, never keys.

---

## Account Deployment

```
Passkey created → public key returned → address computed locally (pure math)
  │
  ▼
User can RECEIVE funds immediately (address valid before deployment)
  │
  ▼
First SEND triggers automatic deployment:
  Deploy custom WebAuthn account contract
  (constructor receives P-256 public key from passkey registration)
  + execute first transaction in same batch
  Gas covered by sponsored fees
```

---

## Security Model

### Key exposure

| Key type | Location | XSS risk |
|---|---|---|
| **Signing key** | Secure element (hardware) — never in JS | **None** — cannot be extracted |
| **Viewing keys** | JS runtime memory during session only | Privacy risk — attacker sees balances, not funds |
| **Encryption key** | JS runtime memory during session only (non-extractable CryptoKey, never persisted to IndexedDB) | Privacy risk — can decrypt PXE cache while in memory, garbage collected on page close |
| **Master secret** | JS runtime memory during session only (for deriveKeys) | Privacy risk — same as viewing keys |

Signing key never enters JavaScript at any point. Every transaction requires biometric confirmation in the secure element.

### XSS protection

```
Dapp (untrusted)              Iframe (trusted)
  │                              │
  │  Cannot access:              │  Contains:
  │  - keys                      │  - viewing keys (JS memory only)
  │  - PXE data                  │  - encrypted PXE cache (IndexedDB)
  │  - encrypted PXE cache       │  - NO signing key
  │  - iframe's IndexedDB        │
  │                              │  Signing happens in:
  │  Can only:                   │  popup → hardware authenticator
  │  - send postMessage requests │
  │  - receive computed results  │  Protocol keys:
  │                              │  - JS runtime memory only
  │                              │  - never serialized or stored
  └──────────────────────────────┘
```

### Remaining threats

- Wallet host compromised → catastrophic (but signing key still safe in hardware, funds cannot be stolen)
- Browser extensions with iframe host permissions → can read viewing keys during active session (privacy, not funds)
- XSS on dapp during session → cannot access iframe internals, cannot sign transactions, cannot read private state
- Malicious dapp → cannot silently query private state (biometric required to `connect` first)

---

## Recovery

**Model A (Phase 1)**: Single passkey, stateless. Protocol keys derived from PRF, signing key lives in passkey. Cloud sync handles device loss.

**Model B (Phase 2)**: Multi-passkey. Master secret encrypted by each passkey's PRF. Any passkey decrypts it. But signing key is bound to each passkey's native P-256 key — **account contract must support multiple signing keys** (key rotation in the contract).

Total passkey loss = funds locked (same as losing a seed phrase).

---

## Browser Compatibility

| Feature | Chrome | Firefox | Safari |
|---|---|---|---|
| PRF | Yes (128+) | Yes (139+) | Yes (18+) |
| WebAuthn sign in iframe | Yes | Yes | Yes |
| WebAuthn create in iframe | Yes | Yes | **No (popup required)** |
| Iframe IndexedDB persistent | Yes | Yes | **No (ephemeral)** |
| PXE cache survives restart | Yes (encrypted, partitioned per dapp) | Yes (encrypted, partitioned per dapp) | **No (full re-sync every session)** |
| Multi-threaded proving (SAB) | Yes (DIP, 137+) | Only with dapp COOP/COEP | No |

---

## Cross-Origin Isolation Note

Cross-origin iframes cannot get `crossOriginIsolated` — this is a browser spec constraint, not configurable via headers. Barretenberg uses `BarretenbergSync` (synchronous WASM) for Poseidon2 hashing on the iframe main thread, which requires `SharedArrayBuffer`.

ZK proof generation is unaffected — it runs in Web Workers that handle their own isolation independently. The blocker is only synchronous hashing during account registration and address computation.

**Solution:** `@aztec/bb.js` exposes an async Barretenberg backend that delegates to a Worker internally and does not require main-thread `SharedArrayBuffer`. Replace the `BarretenbergSync` Poseidon2 calls in the iframe with the async backend. Same API, same output, no cross-origin constraint.

---

## Passkey Configuration

```
RP ID:              "aztec.network" (permanent, broadest scope)
PRF salt:           "aztec-wallet/v1/master-key" (hardcoded, public)
userVerification:   "required" (always)
transports:         ["internal"] (avoids Apple hybrid PRF bug)
pubKeyCredParams:   [{ alg: -7, type: "public-key" }] (ES256 / P-256)
residentKey:        "required" (discoverable credential)
```

---

## Dependencies

| Dependency | Purpose |
|---|---|
| `@aztec/aztec.js` | AccountManager, PXE, Wallet |
| `@noble/hashes/sha256`, `@noble/hashes/hkdf` | SHA-256, HKDF-SHA-256 for protocol key derivation |
| WebCrypto (built-in) | AES-256-GCM encryption (non-extractable keys) |

**Not needed**: `@aztec/accounts` (custom contract replaces EcdsaR), `@noble/curves/p256` (no software signing).

---

## New Files

```
src/aztec-wallet/
├── connectors/
│   └── PasskeyConnector.ts           # WalletConnector implementation
├── services/
│   └── passkey/
│       ├── PasskeyService.ts          # WebAuthn ceremony (create/get with PRF + signing)
│       ├── PasskeyKeyDerivation.ts    # PRF → HKDF → protocol keys + encryption key
│       └── PasskeyStorage.ts          # credentialId + public key persistence
├── signers/
│   └── WebAuthnSigner.ts             # AuthWitnessProvider (WebAuthn ceremony per tx)
└── types/
    └── passkey.ts                    # PasskeyCredential, PasskeyConfig types

contracts/
└── webauthn_account/
    ├── Nargo.toml
    └── src/
        ├── main.nr                    # Custom account contract with WebAuthn envelope verification
        └── ecdsa_public_key_note.nr   # Inlined from aztec-packages (P-256 public key note)
```

---

## Open Questions

1. **PXE sync cost** — benchmark needed. Determines if per-dapp PXE is acceptable UX.
2. **Noir contract complexity** — estimate constraint count for JSON parsing + base64 decode + variable-length SHA-256 in circuit.
3. **Wallet host ownership** — who operates `wallet.aztec.network`?
4. **Mobile proving** — iPhone OOMs on ZK proofs. Desktop-only initially?
5. **Multi-account** — different PRF salts per account? UX for account switching?
6. **Key rotation** — Model B requires the contract to support adding/removing signing keys. Design the contract with this in mind from the start?
7. **clientDataJSON size limit** — what's the max size we support in the circuit? Depends on origin URL length. Fixed upper bound needed for Noir.






