# Passkey Integration for Aztec Embedded Wallets

## Comprehensive Research & Implementation Plan

**Date**: 2026-03-21
**Status**: Research Complete
**Authors**: Research synthesized from 20+ sources across WebAuthn specs, Aztec internals, ZK cryptography, and industry implementations

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Background: WebAuthn & Passkeys](#2-background-webauthn--passkeys)
3. [Aztec Cryptographic Landscape](#3-aztec-cryptographic-landscape)
4. [Industry Analysis: How Others Solved This](#4-industry-analysis-how-others-solved-this)
5. [Architecture Options for Aztec](#5-architecture-options-for-aztec)
6. [Recommended Architecture: Hybrid PRF + Direct Signing](#6-recommended-architecture-hybrid-prf--direct-signing)
7. [Implementation Plan](#7-implementation-plan)
8. [Security Analysis](#8-security-analysis)
9. [Recovery & Multi-Device Strategy](#9-recovery--multi-device-strategy)
10. [Limitations & Open Questions](#10-limitations--open-questions)
11. [Sources & References](#11-sources--references)

---

## 1. Executive Summary

### The Question

Can we securely introduce passkey-based authentication for embedded wallets in `@wonderland/aztec-wallet`, and if so, how?

### The Answer: Yes — but a Custom Account Contract Is Required

Aztec provides the cryptographic primitives needed for passkey wallets, but **not a stable, production-ready account contract** we can depend on:

- **`std::ecdsa_secp256r1::verify_signature()`**: A first-class Noir opcode implemented as a Barretenberg blackbox function — highly optimized, not a Noir circuit. Proving time: ~1-3s server, <10s mobile. **This is the stable foundation.**
- **`aztec-nr` account framework**: `AccountActions`, `AppPayload`, `AuthWitness` patterns — the stable API for building account contracts. **This is the stable scaffolding.**
- **Flexible key hierarchy**: Aztec's master secret key is a single `Fr` element (BN254 scalar, 32 bytes). ALL derived keys (nullifier, viewing, tagging) are deterministic from this single value. Any 32-byte material can serve as the master secret via `Fr.fromBufferReduce()`.

#### What About `EcdsaRAccountContract`?

Aztec ships an `EcdsaRAccountContract` in `@aztec/accounts` that uses P-256/secp256r1. However, **this is a sample implementation, not a canonical stable API**:

- The `@aztec/accounts` package is documented as *"Sample account contract implementations"* (official TypeScript API reference)
- The README describes ECDSA as *"Recommended for building integrations with Ethereum wallets"* — no mention of P-256/passkeys
- `std::ecdsa_secp256r1::verify_signature` is used exactly **once** in the entire Aztec codebase — only in this sample contract
- The official default is **Schnorr** everywhere; the ECDSA variants are reference implementations
- Searching for "EcdsaRAccountContract" in the official docs returns **zero results**
- The contract depends on `ecdsa_public_key_note` (an internal library) and `sha256` (external git dependency) — both could change across versions

**Conclusion**: We should **vendor a forked P-256 account contract** based on the sample `EcdsaRAccountContract`, giving us full control over the contract's stability, and optionally extend it later with WebAuthn-specific features (Tier 2). This is a small, well-understood Noir contract (~100 lines) with only 3 dependencies (`aztec`, `ecdsa_public_key_note`, `sha256`).

### Recommended Architecture

We recommend a **two-tier hybrid approach** inspired by Porto/Tempo but adapted for Aztec's privacy architecture:

| Tier | Mechanism | Contract | Use Case |
|------|-----------|----------|----------|
| **Tier 1: PRF Key Derivation** | WebAuthn PRF extension derives deterministic master secret | Our vendored P-256 account contract (forked from EcdsaR sample) | Account creation, key recovery, session restoration |
| **Tier 2: Direct WebAuthn Signing** | WebAuthn assertion signs transaction hashes directly | Extended P-256 contract with WebAuthn envelope parsing | High-value transactions, per-tx biometric confirmation |

**Tier 1 (PRF)** is the primary path. We fork the ~100-line `EcdsaRAccountContract` as our own contract, giving us version stability and a base to extend. PRF browser support is now broad: Chrome 128+, Safari 18.4+, Android, Windows Hello.

**Tier 2 (Direct Signing)** extends our vendored contract with WebAuthn envelope parsing (authenticatorData + clientDataJSON). This is the enhanced path that provides the strongest security guarantees — every transaction requires biometric confirmation, signing key never enters JavaScript.

### Contract Strategy: Fork vs Depend vs Write From Scratch

| Strategy | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Depend on `@aztec/accounts`** | Zero contract maintenance | API can break across versions; no control; labeled "sample" | **Not recommended** |
| **Fork `EcdsaRAccountContract`** | Small (~100 lines); proven pattern; full control; can extend for WebAuthn | Must track aztec-nr API changes; own the contract build | **Recommended** |
| **Write from scratch** | Maximum control; custom-fit for passkeys | Unnecessary work — the sample is already well-designed | Not recommended for Tier 1 |

The fork approach means we vendor:
1. `ecdsa_r_account_contract/src/main.nr` (~100 lines) — the account contract
2. `ecdsa_public_key_note/src/lib.nr` (~60 lines) — the note type for storing P-256 public keys
3. Dependencies: `aztec` (aztec-nr framework), `sha256` (external Noir lib)

Total: **~160 lines of Noir** to own and maintain. This is a very small surface area.

---

## 2. Background: WebAuthn & Passkeys

### 2.1 How Passkeys Work

Passkeys are FIDO2/WebAuthn credentials that use **public-key cryptography** with the **P-256 (secp256r1)** elliptic curve. The private key never leaves the authenticator (Secure Enclave, TPM, or cloud-synced credential store).

**Registration Ceremony** (`navigator.credentials.create()`):
1. Server (Relying Party) sends a random `challenge` and RP ID
2. Authenticator generates a P-256 key pair
3. Returns: `credentialId`, `publicKey` (x, y coordinates), `attestationObject`
4. Private key stored in authenticator, never exposed

**Authentication Ceremony** (`navigator.credentials.get()`):
1. Server sends a `challenge` (in our case: the transaction hash)
2. Authenticator signs: `ECDSA-P256(authenticatorData || SHA-256(clientDataJSON))`
3. Returns: `authenticatorData`, `clientDataJSON`, `signature` (DER-encoded r||s)

### 2.2 The WebAuthn Envelope

WebAuthn does NOT sign the raw challenge. It wraps it in an envelope:

```
signedData = authenticatorData || SHA-256(clientDataJSON)

Where:
  authenticatorData = rpIdHash[32] || flags[1] || signCount[4] || extensions[?]
  clientDataJSON = { "type": "webauthn.get", "challenge": base64url(txHash), "origin": "https://app.example.com" }
```

The **signature** is: `ECDSA-P256(SHA-256(signedData))` — a P-256 signature over the SHA-256 hash of the concatenated authenticator data and client data hash. For ES256 (P-256), the WebAuthn API returns the signature as raw `r || s` (64 bytes), not DER-encoded.

### 2.3 What Passkeys CAN'T Do

| Limitation | Impact |
|-----------|--------|
| Cannot export private keys | No raw key access — signing must go through WebAuthn API |
| Cannot sign arbitrary data | Only signs via the authentication ceremony (challenge-based) |
| Origin-bound (RP ID) | Passkey created for `app.example.com` only works on that origin |
| Requires user gesture | Every signing operation needs biometric/PIN — no background signing |
| Platform-custodied | Private key managed by Apple/Google/Microsoft, not the user |
| No batch signing | Each signature requires a separate user interaction |

### 2.4 WebAuthn PRF Extension

The PRF (Pseudo-Random Function) extension (WebAuthn Level 3) provides deterministic key derivation from passkeys:

```javascript
const assertion = await navigator.credentials.get({
  publicKey: {
    challenge: new Uint8Array(32), // can be any challenge
    extensions: {
      prf: {
        eval: {
          first: new TextEncoder().encode("aztec-wallet-master-key-v1")  // salt
        }
      }
    }
  }
});

const prfOutput = assertion.getClientExtensionResults().prf.results.first;
// prfOutput is a 32-byte ArrayBuffer — deterministic for same credential + salt
```

**How PRF works internally**:
1. Browser transforms the salt: `actualSalt = SHA-256("WebAuthn PRF" || 0x00 || developerSalt)`
2. Authenticator computes: `output = HMAC-SHA-256(credentialSecretKey, actualSalt)`
3. Output is deterministic: same credential + same salt = same 32 bytes, every time
4. The credential's internal key never leaves the secure element

**Platform Support** (as of March 2026):

| Platform | PRF Support | Notes |
|----------|------------|-------|
| Chrome/Edge 128+ | Yes | Via OS APIs |
| Safari 18.4+ | Yes | Platform passkeys; limited for roaming authenticators |
| Android | Yes | Broad support across browsers |
| iOS 18+ | Partial | Platform passkeys only |
| YubiKey 5+ | Yes | Via CTAP2 hmac-secret |
| Windows Hello | Yes | Via CTAP2 hmac-secret |
| Firefox | No | Not yet implemented |

### 2.5 P-256 vs Blockchain Curves

| Property | P-256 (secp256r1) | secp256k1 | Grumpkin |
|----------|-------------------|-----------|---------|
| Used by | WebAuthn/Passkeys | Ethereum/Bitcoin | Aztec (internal) |
| Field size | 256-bit | 256-bit | 254-bit (BN254 base) |
| ZK circuit cost | ~1.5M constraints (Circom), blackbox in Noir | ~1.5M constraints | Native (embedded curve) |
| Noir support | `std::ecdsa_secp256r1` (blackbox) | `std::ecdsa_secp256k1` (blackbox) | `std::embedded_curve_ops` (native) |
| Standard body | NIST | SECG | Custom (BN254 embedded) |

---

## 3. Aztec Cryptographic Landscape

### 3.1 Key Hierarchy

Aztec derives ALL protocol keys from a single **master secret key** (`Fr` — BN254 scalar field element, 32 bytes):

```
Master Secret Key (Fr, 32 bytes)
  ├── SHA-512 + reduce mod Fq → Master Nullifier Hiding Key (nhk_m)
  │     └── × G → npk_m (Nullifier Public Key)
  ├── SHA-512 + reduce mod Fq → Master Incoming Viewing Key (ivsk_m)
  │     └── × G → ivpk_m (Incoming Viewing Public Key)
  ├── SHA-512 + reduce mod Fq → Master Outgoing Viewing Key (ovsk_m)
  │     └── × G → ovpk_m (Outgoing Viewing Public Key)
  └── SHA-512 + reduce mod Fq → Master Tagging Key (tsk_m)
        └── × G → tpk_m (Tagging Public Key)

Signing Key: SEPARATE from protocol keys — curve depends on account contract type
Address: derived from all 4 public keys + partial address (contract artifact + salt)
```

**Critical insight**: The signing key is completely independent from the protocol key hierarchy. For `EcdsaRAccountContract`, the signing key is a P-256 key pair. For `SchnorrAccountContract`, it's a Grumpkin scalar. The protocol keys (nullifier, viewing, tagging) are always on Grumpkin regardless of the account contract type.

### 3.2 Using External Key Material

The master secret key can be created from any 32-byte material:

```typescript
// From PRF output — deterministic from passkey + salt
const prfOutput: ArrayBuffer = /* 32 bytes from PRF extension */;
const masterSecret = Fr.fromBufferReduce(Buffer.from(prfOutput));

// Or with extra domain separation via Poseidon2 (preferred — adds domain separation)
const masterSecret = await poseidon2Hash([Fr.fromBufferReduce(Buffer.from(prfOutput))]);
```

**Note on bias**: `Fr.fromBufferReduce` computes `value % Fr.MODULUS` where Fr.MODULUS ≈ 2^254. Reducing a 32-byte (256-bit) value mod ~2^254 introduces a negligible bias of ~2^-252. Aztec's own `Fr.random()` reduces a 64-byte value for perfect uniformity, but since PRF output is inherently bounded at 256 bits, reducing 64 bytes wouldn't increase entropy. The Poseidon2 wrapper adds domain separation without affecting the bias. This bias is cryptographically irrelevant.

This is already the pattern used by the ExternalSignerConnector (EVM wallet → Aztec keys):
```typescript
// Current ExternalSigner pattern in the codebase
const secretKeyBuffer = await signer.deriveSecretKey();
const secretKey = await poseidon2Hash([Fr.fromBuffer(secretKeyBuffer)]);
```

### 3.3 Account Contract: EcdsaRAccountContract — Complete Hash Chain Analysis

> **Important**: `EcdsaRAccountContract` is a **sample implementation** from `@aztec/accounts`, not a canonical stable API. We will fork it as our own contract (see Section 1). The analysis below documents the sample's behavior, which our fork will preserve.

**Source**: `aztec-packages/noir-projects/noir-contracts/contracts/account/ecdsa_r_account_contract/src/main.nr`

**Constructor**: Takes `signing_pub_key_x: [u8; 32]`, `signing_pub_key_y: [u8; 32]`

**The complete hash/signing chain (verified from source)**:

```
Step 1: Transaction Creation (TypeScript)
  AppPayload { function_calls[], nonce }
    → poseidon2_hash_with_separator(payload.serialize(), DOM_SEP__SIGNATURE_PAYLOAD)
    → outer_hash (Field, 254-bit Poseidon2 hash)

Step 2: Auth Witness Creation (TypeScript - EcdsaRAuthWitnessProvider)
  messageHash (Fr = outer_hash)
    → messageHash.toBuffer() → Buffer (32 bytes, big-endian)
    → Barretenberg.ecdsaSecp256r1ConstructSignature(buffer, privateKey)
      → [Barretenberg internally computes SHA-256(buffer) before ECDSA signing]
    → AuthWitness(messageHash, [...signature.r, ...signature.s])

Step 3: Verification (Noir circuit - is_valid_impl)
  outer_hash (Field)
    → outer_hash.to_be_bytes::<32>() → [u8; 32]
    → sha256::digest([u8; 32]) → hashed_message [u8; 32]
    → ecdsa_secp256r1::verify_signature(pk_x, pk_y, signature, hashed_message)
```

**Both sides agree**: The signed message is `SHA-256(outer_hash_as_32_bytes)`. Barretenberg's `ecdsaSecp256r1ConstructSignature` internally SHA-256 hashes the input before signing, which matches the Noir contract's `sha256::digest()` before verification. The SSH agent variant (`EcdsaRSSHAccountContract`) follows the same pattern — the SSH protocol also SHA-256 hashes before ECDSA signing.

**Key observation**: Any P-256 signing backend that performs standard ECDSA signing (hash-then-sign with SHA-256) over the raw `outer_hash_bytes` will produce signatures compatible with this contract. This includes software P-256 libraries like `@noble/curves/p256`.

### 3.4 The WebAuthn Envelope Problem — Why Direct Passkey Signing Is Incompatible

The EcdsaRAccountContract expects:
```
signature = ECDSA-P256(SHA-256(outer_hash_bytes))
```

But the WebAuthn authentication ceremony produces:
```
signature = ECDSA-P256(SHA-256(authenticatorData || SHA-256(clientDataJSON)))
  where clientDataJSON = {"type":"webauthn.get","challenge":"<base64url(outer_hash)>","origin":"https://app.example.com"}
  where authenticatorData = rpIdHash[32] || flags[1] || signCount[4]
```

**These are fundamentally different hashes.** The WebAuthn specification does NOT allow signing raw data — every authentication ceremony wraps the challenge in the `clientDataJSON` envelope and prepends `authenticatorData`. There is no way to bypass this.

**Confirmed from source code analysis**: No WebAuthn, passkey, or biometric code exists anywhere in the Aztec codebase (aztec-packages, aztec-examples, or docs). This would be a novel integration.

This incompatibility creates three possible architecture paths:

- **Option A (PRF approach)**: Bypass the WebAuthn signing entirely. Use PRF to derive a P-256 private key in JavaScript, then sign `SHA-256(outer_hash)` directly in software. Uses our forked P-256 account contract (based on the sample `EcdsaRAccountContract`).
- **Option B (Direct WebAuthn signing)**: Create a custom `WebAuthnAccountContract` in Noir that reconstructs and verifies the full WebAuthn envelope. Requires a new Noir contract.
- **Option C (Hybrid)**: Use PRF for key derivation (Tier 1) and direct WebAuthn for high-security operations (Tier 2).

---

## 4. Industry Analysis: How Others Solved This

### 4.1 Porto / Tempo (Ithaca / Paradigm)

**Approach**: Direct WebAuthn P-256 signing with ERC-7702 smart accounts

Porto is the most advanced passkey wallet implementation, now powering Tempo (Paradigm + Stripe's payment L1). Key decisions:

- **WebAuthnP256** is a native key type in the Porto Account contract
- Verification happens on-chain via RIP-7212 precompile (3,450 gas)
- **Ephemeral key trick**: On sign-up, an ephemeral secp256k1 key is generated in an iframe, signs an ERC-7702 authorization + passkey addition, then is immediately discarded. This avoids the "chicken-and-egg" problem of needing a transaction to add a passkey.
- **Session keys**: Passkey validates once → creates a session key for frequent operations → avoids repeated biometric prompts
- **Intent-based execution**: Users submit intents to the Ithaca Relay, which handles gas abstraction, simulation, and on-chain execution
- **Cross-chain**: `chainId=0` in ERC-7702 authorization makes the same account work on all EVM chains

**Relevance to Aztec**: Porto's approach verifies WebAuthn on-chain directly via the RIP-7212 precompile — infrastructure that doesn't exist in Aztec. We take architectural inspiration from Porto's decisions (passkey + session keys, ephemeral key trick, intent-based execution) but cannot use any of their code. Porto is EVM-only and targets transparent chains; Aztec's privacy layer requires a fundamentally different implementation.

### 4.2 Coinbase Smart Wallet (Base Account)

**Approach**: Direct WebAuthn P-256 signing with ERC-4337

- Passkey as primary signer via `UserOperation.signature` field
- WebAuthn signature verified on-chain using Daimo's P256Verifier as fallback
- Uses RIP-7212 precompile on Base/Optimism
- "Recovery phrase" backup (effectively a seed phrase — the "recovery paradox")

### 4.3 Safe Passkey Module

**Approach**: Modular WebAuthn signer proxy per passkey

- `SafeWebAuthnSignerProxy` deployed per passkey credential
- Implements ERC-1271 for signature validation
- Dual-path: RIP-7212 precompile → Daimo P256Verifier fallback
- No storage slots used (ERC-4337 compatible)
- Passkey is one signer in a multi-sig — not the sole key

### 4.4 ZeroDev Kernel

**Approach**: Progressive passkey validator with session keys

- Automatically uses RIP-7212 when available, falls back to Solidity verifier
- **100x cost difference**: 3,450 gas (precompile) vs 300,000-400,000 gas (Solidity)
- Requires a passkey server for counterfactual deployment (stores public key before contract deployment)
- Recommends: passkey + ECDSA session key combo for best UX

### 4.5 Breez SDK (Bitcoin/Lightning)

**Approach**: PRF key derivation (our Tier 1)

- Uses WebAuthn PRF extension to derive deterministic Bitcoin wallet seeds
- PRF output → HKDF → wallet seed
- Optional BIP-39 mnemonic export for backward compatibility
- No P-256 signature verification on-chain at all
- Shipped March 2026

### 4.6 Comparative Summary

| Project | Approach | Custom Contract? | P-256 On-Chain? | PRF? | Session Keys? |
|---------|----------|-----------------|----------------|------|---------------|
| **Porto/Tempo** | Direct WebAuthn | Yes (Account) | Yes (RIP-7212) | No | Yes |
| **Coinbase** | Direct WebAuthn | Yes (4337 Account) | Yes | No | No |
| **Safe** | Direct WebAuthn | Yes (Signer Proxy) | Yes | No | No |
| **ZeroDev** | Direct WebAuthn + Session | Yes (Validator) | Yes | No | Yes |
| **Breez** | PRF Key Derivation | No | No | Yes | N/A |
| **Our Recommendation** | PRF + Optional WebAuthn | No (Tier 1) / Yes (Tier 2) | Yes (Tier 2 only) | Yes | Implicit |

---

## 5. Architecture Options for Aztec

### Option A: PRF Key Derivation Only (No Custom Noir Contract)

```
Passkey Authentication
  └── PRF Extension (salt: "aztec-wallet-v1")
       └── 32-byte deterministic output
            └── poseidon2Hash([Fr.fromBuffer(prfOutput)])
                 ├── Master Secret Key (Fr) → protocol keys (nullifier, viewing, etc.)
                 └── P-256 signing key derived in JS → PasskeyAccountContract (our fork)
```

**Pros**:
- No custom Noir contracts needed
- Works with our forked P-256 account contract (minimal Noir work)
- Deterministic recovery (same passkey + same salt = same account)
- Enables batch/background signing (key lives in JS memory after derivation)
- Fastest implementation path

**Cons**:
- P-256 private key exists in JavaScript memory during session
- Not hardware-bound after derivation (key could be extracted from memory by malware)
- PRF not supported on Firefox (minor — <5% market share for web3)
- Passkey provides authentication, not per-transaction authorization

### Option B: Direct WebAuthn Signing (Custom Noir Contract Required)

```
Transaction Request
  └── navigator.credentials.get({ challenge: base64url(outerHash) })
       └── WebAuthn Assertion
            ├── authenticatorData (37+ bytes)
            ├── clientDataJSON (variable length JSON)
            └── signature (P-256 over SHA-256(authData || SHA-256(clientDataJSON)))
                 └── WebAuthnAccountContract (custom Noir)
                      ├── Verify: SHA-256(authData || SHA-256(clientDataJSON)) == signedHash
                      ├── Verify: P-256 signature over signedHash
                      └── Verify: challenge in clientDataJSON == outer_hash
```

**Pros**:
- Strongest security — every transaction requires biometric confirmation
- Private key never leaves the secure element
- Phishing-resistant (origin-bound)
- Matches Porto/Coinbase architecture

**Cons**:
- Requires custom Noir contract (SHA-256 over variable-length data in ZK circuit)
- Every transaction needs user gesture — no batch/background operations
- More complex implementation
- `clientDataJSON` parsing in Noir is non-trivial (variable-length JSON)

### Option C: Hybrid (Recommended)

Combine both approaches with our forked P-256 account contract that supports two authentication modes:

**Tier 1 (Default)**: PRF-derived signing key for everyday operations
**Tier 2 (High-security)**: Direct WebAuthn signing for critical operations (future enhancement)

This matches Porto's architecture (passkey + session keys) adapted for Aztec's privacy model.

---

## 6. Recommended Architecture: Hybrid PRF + Direct Signing

### 6.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    @wonderland/aztec-wallet                   │
│                                                               │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Embedded      │  │  External    │  │  Passkey          │  │
│  │  Connector     │  │  Signer      │  │  Connector (NEW)  │  │
│  │  (Fr.random)   │  │  (EVM sig)   │  │  (PRF-derived)    │  │
│  └───────┬───────┘  └──────┬───────┘  └───────┬───────────┘  │
│          │                  │                   │               │
│          ▼                  ▼                   ▼               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              SharedPXEService (singleton per network)    │  │
│  └─────────────────────────────────────────────────────────┘  │
│          │                  │                   │               │
│          ▼                  ▼                   ▼               │
│  ┌────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │ EcdsaR     │  │ EcdsaK         │  │ EcdsaR             │  │
│  │ Account    │  │ EthSigner      │  │ Account            │  │
│  │ Contract   │  │ Account        │  │ Contract           │  │
│  │            │  │ Contract       │  │ (same as Embedded) │  │
│  └────────────┘  └────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Passkey Connector: Registration Flow

```
User clicks "Create Account with Passkey"
  │
  ├── 1. navigator.credentials.create({
  │        publicKey: {
  │          rp: { name: "Aztec Wallet", id: window.location.hostname },
  │          user: { name: "aztec-user", displayName: "Aztec Account" },
  │          pubKeyCredParams: [{ alg: -7, type: "public-key" }],  // ES256 = P-256
  │          authenticatorSelection: {
  │            residentKey: "required",
  │            userVerification: "required"
  │          },
  │          extensions: { prf: {} }  // Request PRF capability
  │        }
  │      })
  │
  ├── 2. Store credential metadata:
  │        { credentialId, publicKey, prfCapable, rpId, createdAt }
  │        → IndexedDB (encrypted) or localStorage
  │
  ├── 3. Check PRF capability:
  │        const prfCapable = credential.getClientExtensionResults().prf?.enabled
  │
  ├── 4. If PRF capable → derive master key:
  │        navigator.credentials.get({
  │          publicKey: {
  │            challenge: randomBytes(32),
  │            allowCredentials: [{ id: credentialId }],
  │            extensions: {
  │              prf: { eval: { first: encode("aztec-wallet-master-key-v1") } }
  │            }
  │          }
  │        })
  │        prfOutput (32 bytes) → poseidon2Hash([Fr.fromBuffer(prfOutput)]) → masterSecret
  │
  ├── 5. Derive P-256 signing key from PRF output (NOT masterSecret — separate path):
  │        signingKeyMaterial = HKDF-SHA-256(prfOutput, salt="aztec-p256-signing", info="v1")
  │        P-256 private key = signingKeyMaterial mod P-256 order (n)
  │        P-256 public key = privateKey × G (on P-256 curve)
  │
  ├── 6. Create AccountManager:
  │        AccountManager.create(
  │          wallet,
  │          masterSecret,           // Fr — for protocol keys (nullifier, viewing, etc.)
  │          new PasskeyAccountContract(signingPrivateKeyBuffer),  // Our forked P-256 contract
  │          salt                    // Deterministic from PRF: poseidon2Hash([prfOutput, "salt"])
  │        )
  │        // PasskeyAccountContract internally derives public key from private key
  │
  └── 7. Deploy account + persist session
```

### 6.3 Passkey Connector: Authentication (Reconnection) Flow

```
Page Load → Check stored passkey credential
  │
  ├── 1. Retrieve stored credentialId from IndexedDB
  │
  ├── 2. Authenticate + derive keys in one step:
  │        navigator.credentials.get({
  │          publicKey: {
  │            challenge: randomBytes(32),
  │            allowCredentials: [{ id: storedCredentialId }],
  │            extensions: {
  │              prf: { eval: { first: encode("aztec-wallet-master-key-v1") } }
  │            }
  │          }
  │        })
  │
  ├── 3. Reconstruct account:
  │        prfOutput → masterSecret (same as registration — deterministic)
  │        masterSecret → signing key (same derivation)
  │        masterSecret + salt → same account address (deterministic)
  │
  ├── 4. Re-register with PXE:
  │        AccountManager.create(wallet, masterSecret, accountContract, salt)
  │
  └── 5. Session active — signing key in memory for duration
```

### 6.4 Passkey Connector: Transaction Signing Flow

```
Transaction Request (e.g., drip(), transfer())
  │
  ├── 1. Wallet creates AppPayload → Poseidon2 hash → outer_hash
  │
  ├── 2. PasskeyAccountContract (our fork) expects:
  │        auth_witness = P-256 signature over SHA-256(outer_hash_bytes)
  │
  ├── 3. PasskeyAuthWitnessProvider.createAuthWit(messageHash):
  │        a. Convert messageHash (Fr) to 32 bytes
  │        b. SHA-256 hash the bytes
  │        c. Sign with in-memory P-256 private key (derived from PRF)
  │        d. Return AuthWitness(messageHash, signatureBytes)
  │
  └── 4. Transaction submitted with auth witness → PXE proves → network validates
```

### 6.5 Key Derivation Detail

```
PRF Output (32 bytes, from passkey + salt)
  │
  ├── Domain Separation: poseidon2Hash([Fr.fromBuffer(prfOutput)])
  │     └── masterSecret (Fr)
  │
  ├── Protocol Keys (automatic via Aztec SDK):
  │     ├── nhk_m = SHA-512(masterSecret || NHK_M) mod Fq → Nullifier Hiding Key
  │     ├── ivsk_m = SHA-512(masterSecret || IVSK_M) mod Fq → Incoming Viewing Key
  │     ├── ovsk_m = SHA-512(masterSecret || OVSK_M) mod Fq → Outgoing Viewing Key
  │     └── tsk_m = SHA-512(masterSecret || TSK_M) mod Fq → Tagging Key
  │
  ├── Signing Key (app-level):
  │     ├── signingKeyMaterial = HKDF-SHA-256(prfOutput, salt="aztec-p256-signing", info="v1")
  │     ├── P-256 private key = signingKeyMaterial mod n (P-256 order)
  │     └── P-256 public key = privateKey × G
  │
  └── Account Salt:
        └── salt = poseidon2Hash([Fr.fromBuffer(prfOutput), Fr.from("salt-v1")])
```

**Note on signing key derivation**: We derive the P-256 signing key from the raw PRF output (not the master secret) to maintain clean separation between protocol keys (Grumpkin-based, derived from masterSecret) and the signing key (P-256, derived from PRF output via HKDF). This ensures the signing key never touches the Aztec key derivation path.

**Why HKDF over Aztec's built-in `deriveSigningKey()`**: Aztec's `deriveSigningKey(secretKey)` produces a `GrumpkinScalar` (designed for the Schnorr account contract). The existing EcdsaR code path works around this by using the Grumpkin scalar's raw bytes as a P-256 private key — an unclean cross-curve hack. Our HKDF approach derives a proper P-256 key natively, using a P-256-specific KDF with appropriate domain separation. This is cryptographically cleaner and avoids any implicit dependencies on Grumpkin scalar format.

### 6.6 Why This Works Without a Custom Noir Contract

**The critical insight**: In the PRF approach, we do NOT use the WebAuthn signing ceremony for transactions. We use the passkey ONLY for key derivation (via PRF). The actual transaction signing is done with a software P-256 library (`@noble/curves/p256`) using the PRF-derived private key. This completely bypasses the WebAuthn envelope problem.

**Important: low-S normalization is mandatory.** Barretenberg's ECDSA verification enforces low-S signatures (the SSH account contract explicitly normalizes high-S values before verification). When signing with `@noble/curves`, always pass `{ lowS: true }` to ensure signature malleability prevention. Without this, valid signatures may be rejected by the Noir circuit.

Our forked contract's `is_valid_impl` does (identical to the sample `EcdsaRAccountContract`):
```noir
let message_hash = sha256::digest(outer_hash.to_be_bytes::<32>());
let valid = std::ecdsa_secp256r1::verify_signature(
    public_key.x, public_key.y,
    signature,          // 64 bytes: r[32] || s[32]
    message_hash        // SHA-256(outer_hash_bytes)
);
```

Our `PasskeyAuthWitnessProvider` uses `@noble/curves/p256` to produce exactly this:
```typescript
import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha256';

async createAuthWit(messageHash: Fr): Promise<AuthWitness> {
  const outerHashBytes = messageHash.toBuffer();           // 32 bytes
  const sha256Hash = sha256(outerHashBytes);               // SHA-256(outer_hash_bytes)
  const sig = p256.sign(sha256Hash, this.signingPrivateKey, { prehash: false, lowS: true });
  const sigBytes = Buffer.concat([sig.r.toBuffer(32), sig.s.toBuffer(32)]);
  return new AuthWitness(messageHash, [...sigBytes].map(b => new Fr(b)));
}
```

**Why this is the same pattern as the SSH agent**: The `EcdsaRSSHAccountContract` also delegates signing to an external backend (SSH agent) that performs standard ECDSA-P256 signing over the raw `outer_hash_bytes`. The SSH agent, like our software P-256 library, performs `SHA-256(data)` before ECDSA signing internally. The Noir contract is agnostic to the signing backend — it only verifies the mathematical correctness of the P-256 signature.

**What the passkey actually does in this architecture**:
1. **Authentication**: User touches biometric sensor → passkey authenticates the user
2. **Key derivation**: PRF extension returns deterministic 32-byte output → becomes the seed for all keys
3. **Signing**: Software P-256 library signs transactions with the PRF-derived private key

The passkey never signs a transaction directly. It only proves the user's identity and provides deterministic key material.

---

## 7. Implementation Plan

### Prerequisite: Cross-Library ECDSA Compatibility Test

**Before any implementation begins**, run this verification:

```typescript
// Test: sign with @noble/curves/p256, verify with Barretenberg (and vice versa)
import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha256';
import { Ecdsa } from '@aztec/foundation/crypto';

const testMessage = Buffer.from('test-message-32-bytes-padded!!!');
const privateKey = p256.utils.randomPrivateKey();
const publicKey = p256.getPublicKey(privateKey);

// Sign with noble, verify with Barretenberg
const nobleSig = p256.sign(sha256(testMessage), privateKey, { prehash: false, lowS: true });
const bbVerify = await barretenbergEcdsa.verifySignature(testMessage, publicKey, nobleSig);
assert(bbVerify, '@noble/curves signature must verify in Barretenberg');

// Sign with Barretenberg, verify with noble
const bbSig = await barretenbergEcdsa.constructSignature(testMessage, privateKey);
const nobleVerify = p256.verify(bbSig, sha256(testMessage), publicKey, { lowS: true });
assert(nobleVerify, 'Barretenberg signature must verify in @noble/curves');
```

This confirms that Barretenberg's ECDSA internally uses SHA-256 (as assumed by this paper). If this test fails, the entire PRF approach needs revision. Estimated time: 1-2 hours.

### Phase 0: Fork P-256 Account Contract (1-2 days)

Before any TypeScript work, vendor the Noir contract:

#### 7.0.1 Files to Fork

```
contracts/
└── passkey_account/
    ├── Nargo.toml                    # Dependencies: aztec, sha256
    └── src/
        ├── main.nr                   # Forked from ecdsa_r_account_contract (~100 lines)
        └── ecdsa_public_key_note.nr  # Forked from libs/ecdsa_public_key_note (~60 lines)
```

The fork is nearly identical to the sample `EcdsaRAccountContract` for Tier 1. The key changes:
1. Inline the `ecdsa_public_key_note` dependency (eliminate external lib dependency)
2. Rename to `PasskeyAccount` for clarity
3. Pin the `sha256` dependency to a specific commit (not just a tag)
4. Add a `// @version` comment for tracking upstream changes

**Why fork instead of depend**: The `@aztec/accounts` package labels its contracts as "sample implementations". The contract API (`entrypoint` signature, `AccountActions` usage, note format) may change across Aztec versions. By owning the contract, we control when and how to adopt upstream changes. The contract is only ~160 lines — the maintenance burden is minimal.

**Future Tier 2 extension**: This forked contract becomes the base for adding WebAuthn envelope parsing. The `is_valid_impl` function is the only function that changes — the rest (constructor, entrypoint, storage) stays identical.

#### 7.0.2 TypeScript Account Contract Wrapper

```typescript
// src/aztec-wallet/contracts/PasskeyAccountContract.ts
import PasskeyAccountContractArtifact from '../../artifacts/passkey_account-PasskeyAccount.json';

class PasskeyAccountContract extends DefaultAccountContract {
  constructor(private signingPrivateKey: Buffer) {
    super(PasskeyAccountContractArtifact);
  }

  getInitializationFunctionAndArgs() {
    const pubKey = p256.getPublicKey(this.signingPrivateKey);
    return {
      constructorName: 'constructor',
      constructorArgs: [pubKey.x, pubKey.y],
    };
  }

  getAuthWitnessProvider(address: CompleteAddress) {
    return new PasskeySigner(this.signingPrivateKey, address);
  }
}
```

### Phase 1: Core PasskeyConnector (2-3 weeks)

#### 7.1.1 New Files

```
src/aztec-wallet/
├── contracts/
│   └── PasskeyAccountContract.ts     # TypeScript wrapper for our forked Noir contract
├── connectors/
│   └── PasskeyConnector.ts           # New connector implementing WalletConnector
├── services/
│   └── passkey/
│       ├── PasskeyService.ts          # WebAuthn API wrapper (create/get credentials)
│       ├── PasskeyKeyDerivation.ts    # PRF → master secret → signing key derivation
│       └── PasskeyStorage.ts          # Credential metadata persistence (IndexedDB)
├── signers/
│   └── PasskeySigner.ts              # P-256 signer using PRF-derived key
└── types/
    └── passkey.ts                    # PasskeyCredential, PasskeyConfig types
```

#### 7.1.2 PasskeyConnector Interface

```typescript
interface PasskeyWalletConnector extends WalletConnector {
  readonly type: typeof WalletType.PASSKEY;  // New wallet type

  // App-managed PXE (same as Embedded)
  getPXE: () => PXE | null;
  getWallet: () => Wallet | null;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;

  // Passkey-specific
  getCredentialId: () => string | null;
  isPRFCapable: () => boolean;
  hasStoredCredential: () => boolean;
}
```

#### 7.1.3 Configuration

```typescript
// Simple: just enable passkey
const config = createAztecWalletConfig({
  networks: [{ name: 'devnet', nodeUrl: '...' }],
  wallets: {
    passkey: true,                    // Enable passkey wallet with defaults
    embedded: true,                   // Keep embedded as fallback
    browserWallets: ['azguard'],
  },
  fees: { default: 'native' },
});

// Advanced: passkey with options
const config = createAztecWalletConfig({
  networks: [{ name: 'devnet', nodeUrl: '...' }],
  wallets: {
    passkey: {
      rpName: 'My Aztec App',
      prfSalt: 'my-app-v1',          // Custom PRF salt (optional, defaults to app RP ID)
      requirePRF: true,              // Fail if PRF not supported (default: true)
    },
    embedded: true,
    browserWallets: ['azguard'],
  },
  fees: { default: 'native' },
});
```

#### 7.1.4 PasskeyService Implementation Sketch

```typescript
class PasskeyService {
  private rpId: string;
  private rpName: string;

  async createCredential(): Promise<PasskeyCredential> {
    const credential = await navigator.credentials.create({
      publicKey: {
        rp: { name: this.rpName, id: this.rpId },
        user: {
          id: crypto.getRandomValues(new Uint8Array(32)),
          name: `aztec-${Date.now()}`,
          displayName: 'Aztec Account',
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'required',
        },
        extensions: { prf: {} },
      },
    });

    const prfCapable = credential.getClientExtensionResults().prf?.enabled ?? false;

    return {
      credentialId: credential.rawId,
      publicKey: extractP256PublicKey(credential.response),
      prfCapable,
      createdAt: Date.now(),
    };
  }

  async deriveKeysFromPRF(credentialId: ArrayBuffer, salt: string): Promise<{
    masterSecret: Fr;
    signingPrivateKey: Uint8Array;
    signingPublicKey: { x: Uint8Array; y: Uint8Array };
    accountSalt: Fr;
  }> {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: credentialId, type: 'public-key' }],
        userVerification: 'required',
        extensions: {
          prf: {
            eval: { first: new TextEncoder().encode(salt) },
          },
        },
      },
    });

    const prfOutput = new Uint8Array(
      assertion.getClientExtensionResults().prf.results.first
    );

    // Derive master secret (for protocol keys)
    const masterSecret = await poseidon2Hash([Fr.fromBufferReduce(Buffer.from(prfOutput))]);

    // Derive P-256 signing key (for account contract)
    const signingKeyMaterial = await hkdfSha256(prfOutput, 'aztec-p256-signing-v1');
    const signingPrivateKey = reduceModP256Order(signingKeyMaterial);
    const signingPublicKey = p256GetPublicKey(signingPrivateKey);

    // Derive deterministic salt
    const accountSalt = await poseidon2Hash([
      Fr.fromBufferReduce(Buffer.from(prfOutput)),
      Fr.fromString('0x73616c74'), // "salt"
    ]);

    return { masterSecret, signingPrivateKey, signingPublicKey, accountSalt };
  }
}
```

#### 7.1.5 PasskeySigner (AuthWitnessProvider)

```typescript
class PasskeySigner implements AuthWitnessProvider {
  constructor(
    private signingPrivateKey: Uint8Array,
    private address: CompleteAddress,
  ) {}

  async createAuthWit(messageHash: Fr): Promise<AuthWitness> {
    // Convert to bytes and SHA-256 hash (matching Noir contract)
    const outerHashBytes = messageHash.toBuffer();
    const sha256Hash = sha256(outerHashBytes);

    // Sign with P-256 private key
    const signature = secp256r1.sign(sha256Hash, this.signingPrivateKey);

    // Return r || s (64 bytes) as auth witness
    const sigBytes = Buffer.concat([
      signature.r.toBuffer(32),
      signature.s.toBuffer(32),
    ]);

    return new AuthWitness(messageHash, [...sigBytes].map(b => new Fr(b)));
  }
}
```

### Phase 2: UI Integration (1 week)

#### 7.2.1 ConnectWalletModal Updates

Add "Passkey" as a wallet option in the connection flow:

```
┌─────────────────────────────────┐
│     Connect Your Wallet          │
│                                  │
│  ┌───────────────────────────┐  │
│  │  🔑  Sign in with Passkey │  │  ← New option
│  └───────────────────────────┘  │
│                                  │
│  ┌───────────────────────────┐  │
│  │  📱  Embedded Wallet      │  │
│  └───────────────────────────┘  │
│                                  │
│  ┌───────────────────────────┐  │
│  │  🦊  MetaMask             │  │
│  └───────────────────────────┘  │
│                                  │
│  ┌───────────────────────────┐  │
│  │  🛡️  Azguard              │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

#### 7.2.2 Session Management

- On page load: check for stored passkey credential in IndexedDB
- If found: prompt user for passkey authentication (biometric)
- On success: derive keys via PRF, restore session silently
- On failure: show connect modal
- Session lifetime: until page close (keys cleared from memory)
- No emoji verification needed (unlike browser wallet flow)

### Phase 3: Recovery & Multi-Credential (1-2 weeks)

#### 7.3.1 Multiple Passkeys Per Account

Allow users to register additional passkeys (cross-device, backup key):

```typescript
// Store mapping: credentialId → accountAddress
interface PasskeyAccountMapping {
  credentialId: string;
  accountAddress: string;
  prfSalt: string;
  isBackup: boolean;
  createdAt: number;
  lastUsed: number;
}
```

Since PRF output is credential-specific (same salt, different credential = different output), adding a second passkey requires:
1. Authenticate with existing passkey → derive keys
2. Create new passkey credential
3. Derive keys from new passkey (different PRF output = different raw keys)
4. Store encrypted mapping: `newCredentialId → { encryptedMasterSecret, encryptedSigningKey }`
5. Encryption key: derived from new passkey's PRF output with a different salt

#### 7.3.2 Recovery Options

| Recovery Method | Implementation | Trust Model |
|----------------|----------------|-------------|
| **Cloud-synced passkey** | Default — iCloud/Google sync handles backup | Apple/Google custody |
| **Second passkey** | Register hardware key (YubiKey) as backup | Self-custody |
| **Encrypted export** | Export encrypted master secret, decrypt with passkey PRF | Self-custody + passkey |
| **Social recovery** | Future: guardian-based key rotation in account contract | Requires custom Noir contract |

### Phase 4 (Future): WebAuthn Direct Signing Contract

This is the optional Tier 2 enhancement — a custom `WebAuthnAccountContract` in Noir that verifies the full WebAuthn envelope. This would enable per-transaction biometric confirmation without the signing key ever existing in JavaScript memory.

**Feasibility**: HIGH — but requires a new Noir contract (custom account contract, not just a library).

**What it gains over Tier 1 (PRF)**:
- Private key NEVER enters JavaScript memory (stays in secure element)
- Every transaction requires biometric confirmation (strongest authorization)
- Full WebAuthn phishing resistance for every operation

**What it costs**:
- Custom Noir contract development and maintenance
- Every transaction needs user gesture (no batch operations)
- SHA-256 over variable-length data in ZK circuit (additional proving cost)
- Base64url decoding in Noir (for challenge extraction from clientDataJSON)
- This IS a custom Noir contract — the one thing the user wants to avoid if possible

**Implementation sketch** (Noir):
```noir
fn is_valid_impl(context: &mut PrivateContext, outer_hash: Field) -> bool {
    // Auth witness now carries more than 64 bytes:
    // [signature[64], auth_data_len[1], authenticatorData[37+], clientDataJSON[~200]]
    let witness = unsafe { get_auth_witness(outer_hash) };

    // Extract components (fixed-offset parsing)
    let auth_data = witness[0..37];       // Fixed 37 bytes (no extensions)
    let client_data = witness[37..N];     // Variable length JSON
    let signature = witness[N..N+64];     // P-256 signature

    // Verify challenge in clientDataJSON matches outer_hash
    // (simplified — real impl needs base64url decode)
    let expected_challenge = outer_hash.to_be_bytes::<32>();
    assert(client_data_contains_challenge(client_data, expected_challenge));

    // Reconstruct signed data
    let client_data_hash = sha256::sha256_var(client_data, client_data.len());
    let signed_data = concat(auth_data, client_data_hash);
    let message_hash = sha256::digest(signed_data);

    // Verify P-256 signature
    let public_key = load_public_key(context);
    std::ecdsa_secp256r1::verify_signature(
        public_key.x, public_key.y,
        signature, message_hash
    )
}
```

**Estimated complexity**: 2-4 weeks of Noir development + testing. Not needed for Phase 1 launch.

---

## 8. Security Analysis

### 8.1 Threat Model Comparison

| Threat | Current Embedded | Passkey (PRF Tier 1) | Passkey (WebAuthn Tier 2) |
|--------|-----------------|---------------------|--------------------------|
| **Key theft from localStorage** | CRITICAL — plaintext keys | ELIMINATED — keys derived on-demand from passkey, not stored | ELIMINATED — keys never in JS |
| **XSS / JS injection** | Keys extractable | Signing key in memory during session | Signing key never in JS memory |
| **Phishing** | N/A (no auth) | PRF is origin-bound | Full WebAuthn origin binding |
| **Device loss** | Keys lost if no backup | Cloud-synced passkeys survive | Cloud-synced passkeys survive |
| **Cloud account compromise** | N/A | Attacker gets passkey → derives keys | Attacker gets passkey → can sign |
| **Malware on device** | Keys in plaintext storage | Keys in memory during use | Keys in secure element only |
| **Server compromise** | N/A (no server) | N/A (no server — PRF is client-side) | N/A (no server) |

### 8.2 Security Properties of PRF-Derived Keys

1. **Deterministic**: Same passkey + same PRF salt = same 32-byte output, always. This enables seamless recovery when passkeys are synced across devices.

2. **Credential-bound**: Different passkeys with the same PRF salt produce different outputs. A stolen salt alone is useless without the passkey.

3. **Origin-bound**: PRF is tied to the Relying Party ID. Even if the salt is the same, a passkey from a different origin produces a different output.

4. **Hardware-rooted** (when using platform authenticators): The PRF computation happens inside the secure element. The credential secret key never enters JavaScript.

5. **Not extractable**: There is no API to extract the PRF key or the credential private key. Only the PRF output is returned.

### 8.3 Analysis: PRF-Encrypted At-Rest vs PRF-Direct Derivation

Two architectures for using the passkey's PRF output:

```
Model A: PRF-Direct (our baseline)
  Passkey → PRF → deterministic keys → keys in memory → nothing secret persisted

Model B: PRF-Encrypted At-Rest
  ┌─────────────────────────────────────────────────────────────┐
  │ Layer 1 - Passkey (Touch ID)                                 │
  │   WebAuthn PRF → HKDF → AES-256-GCM                        │
  │   Protects: wallet blob in IndexedDB (secretKey, salt,      │
  │             encrypted signing key)                           │
  │                                                               │
  │ Layer 2 - Memory-Only KeyStore                                │
  │   PXE master keys (ivsk, ovsk, tsk, nhk) live only in JS    │
  │   memory — never written to IndexedDB.                        │
  │   Locking the wallet wipes keys from memory.                  │
  │   PXE sync data persists across sessions.                     │
  └─────────────────────────────────────────────────────────────┘
```

**The key distinction**: In Model A, PRF output *is* the key material (deterministic derivation). In Model B, PRF output is an *encryption key* that protects separately-generated key material stored in IndexedDB.

#### Why This Distinction Matters

In Model A, keys are deterministic from the passkey — they don't need storage because they can always be re-derived. In Model B, the signing key and master secret are **randomly generated at account creation time** (like the current embedded wallet does with `Fr.random()`), then encrypted and persisted. The PRF only unlocks the encrypted vault.

| Property | Model A (PRF-Direct) | Model B (PRF-Encrypted) |
|----------|---------------------|------------------------|
| Key generation | Deterministic from passkey | Random, then encrypted by passkey |
| What's in IndexedDB | Credential metadata only (no secrets) | Encrypted vault blob (secrets at rest) |
| Can keys be re-derived without storage? | Yes — PRF is deterministic | No — if IndexedDB is cleared, keys are lost |
| Passkey change/rotation | New passkey = new keys = new account | New passkey = re-encrypt vault with new PRF, same account |
| Multiple passkeys per account | Difficult (each passkey derives different keys) | Natural (re-encrypt vault with each passkey's PRF key) |
| IndexedDB cleared accidentally | No impact — re-derive from passkey | **Keys lost** unless backed up elsewhere |

#### Security Comparison (Passkey-Only, No Password)

| Threat | Model A | Model B |
|--------|---------|---------|
| **XSS reads IndexedDB** | Safe — no secrets stored | Safe — only encrypted blobs |
| **XSS reads JS memory** | Keys exposed during session | Keys exposed during session — **same** |
| **Physical device access (unlocked browser)** | Attacker triggers PRF → gets keys | Attacker triggers PRF → decrypts vault → gets keys — **same** |
| **Physical device access (locked browser)** | Safe — no secrets stored | Safe — encrypted blobs unreadable without PRF |
| **Cloud account compromise (synced passkey stolen)** | Attacker uses passkey → PRF → gets keys | Attacker uses passkey → PRF → decrypts vault → gets keys — **same** |
| **IndexedDB export/theft (without passkey)** | Useless — no secrets | Useless — encrypted blobs without PRF key |

**Critical finding**: Against all practical threats, both models provide **identical security** when using passkey-only (no additional password). The PRF assertion is the single gate in both cases. The encrypted vault doesn't add security because the same passkey that decrypts the vault could also re-derive the keys.

#### Where Model B Wins: Operational Flexibility

The real advantage of Model B isn't security — it's **key management flexibility**:

1. **Passkey rotation without account migration**: If a user needs to switch passkeys (new device, revoked credential), Model B re-encrypts the vault with the new passkey's PRF output. Model A creates entirely new keys = new account address = must migrate funds.

2. **Multiple passkeys per account**: Model B naturally supports encrypting the same vault with multiple PRF keys (one per passkey). Model A requires complex multi-credential key-sharing schemes.

3. **Decoupled key lifecycle**: The signing key's lifetime is independent of any specific passkey. Keys can outlive passkey rotations, device changes, etc.

4. **Encrypted backup/export**: The encrypted vault blob can be backed up to cloud storage, another device, or a QR code. It's inert without the passkey.

#### Where Model B Loses: Fragility

1. **IndexedDB dependency**: If IndexedDB is cleared (user clears browser data, incognito mode, storage eviction), the encrypted vault is gone. In Model A, nothing is lost — keys re-derive from passkey.

2. **Storage eviction risk**: Browsers can evict IndexedDB data under storage pressure. Without `navigator.storage.persist()`, the vault could be silently deleted. This is a **fund loss** scenario in Model B.

3. **Cross-origin isolation**: IndexedDB is origin-scoped. If the app changes domains, the vault is inaccessible. Model A works from any origin sharing the same passkey RP ID.

4. **Backup complexity**: To be safe, Model B needs a vault backup strategy (cloud, export, etc.). Model A needs no backup — the passkey IS the backup.

#### Efficiency Comparison

| Operation | Model A | Model B |
|-----------|---------|---------|
| First setup | 1 PRF assertion → derive keys | 1 PRF assertion → generate keys → encrypt → store |
| Page load reconnect | 1 biometric → PRF → derive (~50ms) | 1 biometric → PRF → decrypt vault (~50ms) |
| Transaction signing | Instant (in memory) | Instant (in memory) — **same** |
| Add second passkey | Complex (key sharing) | Re-encrypt vault with new PRF key |
| Rotate passkey | New account (fund migration needed) | Re-encrypt vault, same account |
| Implementation complexity | Low | Medium (AES-GCM, vault management, backup) |

**Day-to-day performance is identical.** The difference is in setup and key management operations.

#### Verdict

| Criteria | Winner | Why |
|----------|--------|-----|
| **Security (passkey-only)** | **Tie** | Same single gate (PRF) in both models |
| **Resilience to data loss** | **Model A** | Keys survive IndexedDB wipe |
| **Passkey rotation** | **Model B** | Re-encrypt vault vs migrate entire account |
| **Multi-passkey support** | **Model B** | Encrypt vault with N passkey PRF keys |
| **Implementation simplicity** | **Model A** | No vault management, no backup strategy |
| **Backup complexity** | **Model A** | Passkey IS the backup; nothing to export |

#### Recommendation

**Start with Model A** (PRF-direct). It's simpler, more resilient to data loss, and provides identical security. The passkey itself is both the authentication factor and the key material.

**Upgrade to Model B when passkey rotation or multi-passkey becomes a requirement.** The two models aren't mutually exclusive — a future version can detect whether an encrypted vault exists in IndexedDB and use Model B, falling back to Model A (PRF re-derivation) if the vault is missing. This gives the best of both: encrypted at-rest when available, deterministic recovery when storage is lost.

**Adopt the memory-only keystore for PXE master keys regardless of model choice.** Protocol keys (ivsk, ovsk, tsk, nhk) should never be written to IndexedDB. This is good practice that applies to both models and to the current embedded wallet.

### 8.4 Key Exposure Window

In the PRF approach, the derived P-256 signing key and master secret exist in JavaScript memory:
- **When**: From passkey authentication until page close
- **Risk**: A sophisticated attacker with JS execution (XSS) could read the key from memory
- **Mitigation**: Same security model as the current ExternalSigner connector (EVM wallet signs → key in memory)
- **Comparison**: This is strictly better than the current Embedded wallet (keys in plaintext localStorage permanently)

### 8.5 PRF Salt Security

The PRF salt (`"aztec-wallet-master-key-v1"`) is public and hardcoded. This is safe because:
- The PRF output depends on: `HMAC-SHA-256(credentialInternalKey, SHA-256("WebAuthn PRF" || 0x00 || salt))`
- Without the credential's internal key (which never leaves the secure element), knowing the salt reveals nothing
- Domain separation in the WebAuthn PRF spec prevents cross-context attacks

---

## 9. Recovery & Multi-Device Strategy

### 9.1 Default Recovery: Cloud Sync

Most users will use **synced passkeys** (iCloud Keychain, Google Password Manager). When a user sets up a passkey:

1. The passkey private key is stored in the platform's credential store
2. It syncs automatically across the user's devices (iPhone → Mac → iPad)
3. If the user gets a new device and signs into their Apple/Google account, the passkey is available
4. PRF output is deterministic → same keys are derived → same Aztec account is restored

**Risk**: This means account security = Apple/Google account security. For testnet and moderate-value usage, this is acceptable. For high-value accounts, recommend hardware keys.

### 9.2 Backup Key Strategy

For users who want stronger guarantees:

```
Primary Account Setup:
  1. Create passkey (cloud-synced) → derive keys → deploy account
  2. Create backup passkey (hardware key, e.g., YubiKey)
  3. Encrypt master secret with backup passkey's PRF output
  4. Store encrypted blob in IndexedDB + optional cloud backup

Recovery with backup key:
  1. Authenticate with hardware key → PRF → decryption key
  2. Decrypt master secret
  3. Restore full account access
```

### 9.3 The Recovery Paradox

Every passkey wallet must answer: *"What if the user loses ALL their passkeys?"*

Honest answer: **In a pure passkey model, the funds are lost.** This is the same as losing a seed phrase.

Mitigations:
1. **Cloud sync** makes total loss unlikely (Apple ID recovery, Google Account recovery)
2. **Multiple passkeys** across platforms/devices reduce single-point-of-failure
3. **Encrypted export** lets users back up their master secret elsewhere
4. **Future: Social recovery** via a custom account contract with guardian keys (requires Noir)

### 9.4 Cross-Platform Considerations

| Scenario | Impact | Mitigation |
|----------|--------|-----------|
| Apple user → Android switch | iCloud passkeys don't sync to Android | Register a cross-platform passkey (hardware key) before switching |
| Lost all Apple devices | Apple ID recovery restores passkeys | Ensure Apple ID has strong 2FA |
| Chrome on Windows → Safari on Mac | Google Password Manager passkeys don't sync to iCloud | Use a cross-platform authenticator or hardware key |
| New browser on same device | Platform passkeys work across browsers | No issue |

### 9.5 Session Persistence: The Page Refresh Question

**Q: Does the user need to re-authenticate on page refresh?**

**A: Yes, one biometric prompt per session.** When the page loads:
1. Check for stored `credentialId` (in IndexedDB — this is just metadata, no secrets)
2. Call `navigator.credentials.get()` with PRF extension — triggers biometric prompt
3. PRF output → derive keys → session active

This is a single biometric touch, not an emoji verification flow. It takes <2 seconds and is much better UX than the current embedded wallet's "generating keys..." spinner.

**Optimization**: Use `conditional mediation` (autofill UI) for a more seamless experience:
```javascript
const credential = await navigator.credentials.get({
  publicKey: { /* ... */ },
  mediation: 'conditional',  // Shows passkey in browser's autofill UI
});
```

---

## 10. Limitations & Open Questions

### 10.1 Known Limitations

| Limitation | Severity | Mitigation |
|-----------|----------|-----------|
| Firefox does not support PRF | Low (<5% web3 users) | Fallback to embedded wallet on Firefox |
| PRF output is 32 bytes fixed | None | Sufficient for Fr (32-byte field) |
| Passkey requires user gesture per authentication | Low | One touch per session, not per transaction |
| Cloud-synced passkeys = cloud account security | Medium | Document risk; recommend hardware backup for high-value |
| Domain-bound (origin lock-in) | Medium | PRF salt is app-specific; migration requires export/import |
| No background/automated signing | Low | PRF-derived key enables background signing after authentication |
| P-256 proving cost higher than Schnorr | Low | Blackbox opcode makes it fast enough; ~1-3s server |

### 10.2 Open Questions

1. **PRF salt versioning**: How do we handle salt rotation for security upgrades? Need a migration strategy.

2. **Multi-account support**: Should one passkey be able to derive multiple accounts (using different salts)? Porto supports multiple keys per account; we might want the reverse too.

3. **Fee payment**: How does the passkey wallet interact with FPC (Fee Paying Contract) selection? Same as embedded — this is orthogonal to the signing mechanism.

4. **Account deployment gas**: Who pays for deploying the passkey user's account contract? Same sponsored fee pattern as current embedded wallet.

5. **Tier 2 WebAuthn contract priority**: Is direct WebAuthn signing important enough to prioritize? The PRF approach covers 90% of use cases. The direct signing approach mainly adds "per-transaction biometric confirmation" which is arguably worse UX for most users.

6. **Alternative to PRF (if user's platform doesn't support it)**: Should we implement a `largeBlob` fallback that stores an encrypted key in the passkey's largeBlob extension? This is less elegant but more broadly supported.

### 10.3 Noir Contract Work Required

We maintain a **forked P-256 account contract** (~160 lines). This is minimal Noir work:

| What | Noir Work | Status |
|------|-----------|--------|
| P-256 account contract (Tier 1) | Fork from sample EcdsaRAccountContract (~160 lines) | Required — Phase 0 |
| Key derivation from passkey | None — PRF happens client-side | No Noir needed |
| Account creation / deployment | None — standard `AccountManager.create()` | No Noir needed |
| Protocol keys (nullifier, viewing) | None — Aztec SDK's `deriveKeys(secretKey)` | No Noir needed |
| WebAuthn envelope verification (Tier 2) | Extend forked contract with authenticatorData + clientDataJSON parsing | Future enhancement |
| Social recovery with guardian keys | New contract or contract extension | Future enhancement |
| Key rotation | New contract logic | Future enhancement |

### 10.4 Contract Maintenance Considerations

Since we own the forked contract:

| Concern | Mitigation |
|---------|-----------|
| aztec-nr API changes across versions | Monitor `AccountActions`, `AppPayload` imports; update fork when upgrading Aztec SDK |
| `sha256` external dependency updates | Pin to specific git commit, not just tag |
| `EcdsaPublicKeyNote` format changes | We inline this (~60 lines), so we control it |
| Noir compiler version requirements | `Nargo.toml` specifies `compiler_version = ">=0.25.0"` |
| `std::ecdsa_secp256r1::verify_signature` stability | This is a Noir stdlib blackbox opcode — the most stable layer; unlikely to break |

---

## 11. Sources & References

### WebAuthn / FIDO2

1. W3C WebAuthn Level 3 Specification (January 2026) — https://www.w3.org/TR/webauthn-3/
2. Yubico: PRF Extension Overview — https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/
3. Yubico: CTAP2 HMAC Secret Deep Dive — https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/CTAP2_HMAC_Secret_Deep_Dive.html
4. W3C PRF Extension Explainer — https://github.com/w3c/webauthn/wiki/Explainer:-PRF-extension
5. Bitwarden: PRF WebAuthn and Its Role in Passkeys — https://bitwarden.com/blog/prf-webauthn-and-its-role-in-passkeys/
6. Trail of Bits: The Cryptography Behind Passkeys (May 2025) — https://blog.trailofbits.com/2025/05/14/the-cryptography-behind-passkeys/

### Aztec Network

7. Aztec Accounts Documentation — https://docs.aztec.network/aztec/concepts/accounts
8. Aztec EcdsaRAccountContract (Noir source) — `aztec-packages/noir-projects/noir-contracts/contracts/account/ecdsa_r_account_contract/`
9. Aztec Key Derivation — `aztec-packages/yarn-project/stdlib/src/keys/derivation.ts`
10. Noir ECDSA secp256r1 stdlib — `noir/noir_stdlib/src/ecdsa_secp256r1.nr`
11. Aztec Embedded Wallet — `aztec-packages/yarn-project/wallets/src/embedded/`

### Industry Implementations

12. Porto SDK & Architecture — https://porto.sh/sdk
13. Porto Account Contract — https://porto.sh/contracts
14. Paradigm: Tempo — Payments-First Blockchain — https://paradigm.xyz/2025/09/tempo-payments-first-blockchain
15. Coinbase Smart Wallet (Base Account) — https://smartwallet.dev
16. Safe Passkey Module — https://github.com/safe-global/safe-modules/tree/main/modules/passkey
17. ZeroDev Passkey Docs — https://docs.zerodev.app/sdk/advanced/passkeys
18. Daimo P256Verifier — https://github.com/daimo-eth/p256-verifier
19. Breez SDK Passkey Login — https://bitcoinmagazine.com/business/breez-sdk-launches-passkey-login-for-seedless-bitcoin-wallets

### Standards

20. RIP-7212: secp256r1 Precompile — https://github.com/ethereum/RIPs/blob/master/RIPS/rip-7212.md
21. ERC-7702: Set Code for EOAs — https://eips.ethereum.org/EIPS/eip-7702
22. ERC-4337: Account Abstraction — https://eips.ethereum.org/EIPS/eip-4337
23. ERC-7579: Modular Smart Accounts — https://eips.ethereum.org/EIPS/eip-7579

### Academic & Security

24. Deshpande & Khade: A Passkey Based Recovery Mechanism for Blockchain Hardware Wallets (IEEE/ACM UCC 2024) — https://ieeexplore.ieee.org/document/10971809/
25. Korea KIIS: Harmonizing Private Key Security with FIDO2 and AA (2024) — https://koreascience.or.kr/article/JAKO202431757600340.page
26. Hyle: Benchmarking In-Browser P256 ECDSA Proving Systems (March 2025) — https://blog.hyle.eu/blog/benchmarking-in-browser-p256/
27. Base Engineering: Benchmarking ZKP Systems for Passkey ECDSA — https://blog.base.dev/benchmarking-zkp-systems

### Critical Analysis

28. Para: Why Passkey-Only Wallets Will Fail (March 2026) — https://blog.getpara.com/passkey-wallets/
29. Varun Srinivasan: The Problem with Passkeys (January 2026) — https://www.varunsrinivasan.com/2026/01/10/the-problem-with-passkeys
30. Polkadot Forum: WebAuthn Passkeys with PRF Extension for Stateless Private Keys — https://forum.polkadot.network/t/webauthn-passkeys-with-prf-extension-for-stateless-private-keys/14368

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| **PRF** | Pseudo-Random Function — WebAuthn extension that produces deterministic output from credential + salt |
| **P-256 / secp256r1** | The elliptic curve used by passkeys (NIST standard) |
| **Grumpkin** | The embedded curve of BN254, used for Aztec's internal protocol keys |
| **Fr** | BN254 scalar field element (~32 bytes, modulus ≈ 2^254) |
| **Fq** | BN254 base field element / Grumpkin scalar (used for derived keys) |
| **outer_hash** | The Poseidon2 hash of an Aztec transaction's AppPayload — what gets signed |
| **AuthWitness** | Aztec's signature mechanism — a witness (e.g., signature bytes) proving authorization |
| **EcdsaRAccountContract** | Aztec's **sample** Noir account contract for P-256 ECDSA verification (from `@aztec/accounts`) |
| **PasskeyAccountContract** | Our vendored fork of EcdsaRAccountContract — the contract we own and maintain |
| **Barretenberg** | Aztec's proving backend (C++ ZK proof generation) |
| **Blackbox function** | A Noir function implemented as native code in Barretenberg, not as ZK constraints |

## Appendix B: Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary approach | PRF key derivation (Tier 1) | Broad browser support; enables batch signing; minimal Noir work |
| Account contract | **Fork** EcdsaRAccountContract (~160 lines) | The `@aztec/accounts` sample is not a stable API; by forking we control versioning and can extend for Tier 2. The contract is small enough (~160 lines) that maintenance is trivial. |
| Why not depend on `@aztec/accounts` | Sample implementations may change across versions | Official docs call these "sample"; `EcdsaRAccountContract` has zero documentation; `std::ecdsa_secp256r1` opcode is the real stable layer |
| PRF salt | Static per-app, versioned | Simple, secure (salt alone reveals nothing without credential), enables deterministic recovery |
| Signing key derivation | HKDF from raw PRF output | Clean separation from protocol keys (which derive from poseidon2Hash of PRF output) |
| Session model | Keys in memory until page close | Same model as ExternalSigner; strictly better than current Embedded (localStorage plaintext) |
| Recovery default | Cloud-synced passkeys + optional hardware backup | Balances UX and security; matches industry standard (Porto, Coinbase) |
| Tier 2 direct WebAuthn | Deferred — extend forked contract later | PRF covers 90% of use cases; owning the contract makes Tier 2 a natural extension |
