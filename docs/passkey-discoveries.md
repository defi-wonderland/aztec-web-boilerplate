# Passkey Discoveries

**Date**: 2026-03-27
**Status**: Living document — updated as investigation continues
**Context**: Findings from deep-diving into PRF, WebAuthn, Aztec integration, and webauthx/ox

---

## 1. PRF Is the Core Primitive (Not Passkey Signing)

The passkey never signs an Aztec transaction. Its only role is **deterministic key derivation** via the PRF extension. The actual transaction signing happens in software with `@noble/curves/p256`.

```
Passkey's job:  biometric gate → PRF → 32 bytes of deterministic secret
Our code's job: 32 bytes → HKDF → master secret, signing key, encryption key → sign transactions
```

This completely bypasses the WebAuthn envelope problem (authenticatorData + clientDataJSON wrapping). We don't need to verify WebAuthn signatures on-chain. We just need the 32 bytes.

---

## 2. How PRF Actually Works

### CredRandom

A 32-byte random value generated **once** at passkey creation. Stored permanently inside the credential. Never exposed via any API. It's the HMAC key.

- "Random" describes its **origin** (CSPRNG), not its behavior (constant forever)
- Syncs with the passkey across devices (iCloud Keychain, Google PM)
- Independent from the passkey's P-256 private key

### The computation

```
output = HMAC-SHA-256(CredRandom, SHA-256("WebAuthn PRF" || 0x00 || developerSalt))
```

- Browser adds domain separation (`"WebAuthn PRF" || 0x00`) before the salt reaches the authenticator
- Same credential + same salt = same 32 bytes, always
- Biometric (Face ID / Touch ID / fingerprint) is just the **gate** — it doesn't create anything, it unlocks access to CredRandom

### CTAP 2.1 dual keys

Authenticators store TWO CredRandom values:
- `CredRandomWithUV` — used when biometric/PIN verified
- `CredRandomWithoutUV` — used when UV skipped

**`userVerification: "required"` is non-negotiable.** Otherwise the authenticator might silently switch between keys, producing different outputs for the same salt.

---

## 3. One Passkey = One Wallet Everywhere

```
Face ID on app1.com  →  same CredRandom + same salt  →  same 32 bytes  →  same wallet
Face ID on app2.com  →  same CredRandom + same salt  →  same 32 bytes  →  same wallet
Touch ID on MacBook  →  same CredRandom + same salt  →  same 32 bytes  →  same wallet
Face ID on iPhone    →  same CredRandom + same salt  →  same 32 bytes  →  same wallet
```

The biometric method doesn't matter. Different biometrics are different locks on the same door. CredRandom is inside the room.

---

## 4. The Salt Is Public and Hardcoded

```javascript
prf: { eval: { first: encode("aztec-wallet/v1/master-key") } }
```

- The salt is **not a secret**. Security comes from CredRandom, not the salt.
- Hardcoded in the SDK, same across all dapps — this is what makes the wallet universal.
- If each dapp used a different salt → different keys → different wallet per dapp (bad).
- The API supports two salts per ceremony (`first` and `second`) for two independent outputs from one biometric prompt.

---

## 5. RP ID = Domain Binding (Permanent)

RP ID (Relying Party ID) = the domain that owns the passkey. Set at creation, can never change.

```javascript
rp: { id: "aztec.network" }   // passkey works on *.aztec.network
```

- Subdomains can use a parent domain's RP ID (`wallet.aztec.network` can use `aztec.network`)
- Choosing `aztec.network` gives maximum flexibility for future subdomains
- **Permanent decision** — changing RP ID later breaks all existing passkeys

---

## 6. Why Aztec Needs Multiple Keys (EVM Comparison)

On EVM, one private key does everything — sign transactions, done. Balances and history are public.

Aztec is a **private chain**. Your balances are encrypted, your transactions are hidden. That privacy requires more cryptographic machinery:

| Key | EVM equivalent | What it does on Aztec |
|-----|---------------|----------------------|
| **Signing key** | Your MetaMask private key | Signs transactions. The only one EVM wallets need. |
| **Viewing key** (ivsk) | Nothing — EVM balances are public | Decrypts your own transaction history and balances. Without it, you can't read your own notes. |
| **Nullifier key** (nhk) | Nothing — EVM spends are public | Proves you spent a note without revealing which one. Like proving "I used one of my UTXOs" without saying which. |
| **Tagging key** (tsk) | Nothing — you just filter by address | Helps you efficiently find which encrypted transactions on the network are yours, without scanning everything. |
| **Outgoing viewing key** (ovsk) | Nothing | Lets you decrypt details of transactions you *sent* (not just received). |
| **Encryption key** | Nothing — nothing to encrypt locally | Protects the local database (IndexedDB) where all the above decrypted data is cached. |
| **Account salt** | CREATE2 salt | Makes the contract address deterministic from the passkey. |

**If MetaMask had to encrypt your tx history, prove spends without revealing your address, and scan for your transactions without anyone knowing — it would need all these keys too.**

---

## 7. HKDF — How We Derive Each Key

### The problem

PRF gives us 32 bytes. We need 6 independent keys. Reusing the same bytes for multiple purposes is a security disaster — compromise one, compromise all.

### The solution

HKDF (Hash-based Key Derivation Function, RFC 5869) takes one input and produces multiple independent outputs. The `info` string acts as a label — same input + different label = completely unrelated output.

Internally it's just HMAC-SHA-256 applied in a chain:
```
T1 = HMAC-SHA-256(key, info || 0x01)          → first 32 bytes
T2 = HMAC-SHA-256(key, T1 || info || 0x02)    → next 32 bytes
...keep going until you have enough bytes
```

### How we generate each key

```
PRF output (32 bytes from passkey)
  │
  │  ┌─ info="aztec-wallet/v1/master-secret" ──→ 48 bytes
  │  │   → Fr.fromBufferReduce(48 bytes) → masterSecret
  │  │   → Aztec's deriveKeys(masterSecret) internally produces:
  │  │       ├─ nhk_m  (nullifier key)   — proves spends without revealing which note
  │  │       ├─ ivsk_m (viewing key)     — decrypts your balances and incoming txs
  │  │       ├─ ovsk_m (outgoing key)    — decrypts txs you sent
  │  │       └─ tsk_m  (tagging key)     — finds your txs in the encrypted pool
  │  │
  ├──┤  ┌─ info="aztec-wallet/v1/p256-signing-key" ──→ 48 bytes
  │  │   → mod P-256 order → signingPrivateKey
  │  │   → signingPrivateKey × G (on P-256 curve) → signingPublicKey
  │  │   → this is what signs transactions (like your MetaMask private key)
  │  │
  │  ├─ info="aztec-wallet/v1/encryption-key" ──→ 32 bytes
  │  │   → AES-256-GCM CryptoKey (non-extractable)
  │  │   → encrypts IndexedDB at rest (PXE notes, nullifiers, sync state)
  │  │
  │  └─ info="aztec-wallet/v1/account-salt" ──→ 48 bytes
  │      → Fr.fromBufferReduce(48 bytes) → accountSalt
  │      → input to address computation (like CREATE2 salt on EVM)
  │
  ▼
  All deterministic. Same PRF output → same keys → same wallet, every time.
```

### Why 48 bytes for some, 32 for others

- **48 bytes** for anything reduced mod a ~254-bit prime (Fr, P-256 order). This avoids the bias bug — reducing 48 bytes mod a 254-bit number gives negligible bias (2^-130).
- **32 bytes** for symmetric keys (AES-256). No modular reduction needed — 32 bytes = 256 bits = exactly what AES wants.

### Who controls what

| Key | Generated by | Used by |
|-----|-------------|---------|
| masterSecret | Our HKDF code | Aztec SDK (`deriveKeys()` produces the 4 protocol sub-keys) |
| signingKey | Our HKDF code | Our PasskeySigner (signs txs with @noble/curves) |
| encryptionKey | Our HKDF code | Our storage layer (encrypts/decrypts IndexedDB) |
| accountSalt | Our HKDF code | Aztec SDK (address computation) |
| nhk, ivsk, ovsk, tsk | Aztec SDK (from masterSecret) | Aztec PXE (note decryption, nullifier tracking, etc.) |

We control the first four. Aztec controls the sub-derivation from masterSecret. We never touch nhk/ivsk/ovsk/tsk directly — `deriveKeys()` handles that.

---

## 8. What a Passkey Actually Signs (The Envelope Problem)

When a passkey signs something, it doesn't sign your raw data. It wraps it:

```
You want signed: "send 10 tokens" (a transaction hash)

What the passkey actually signs:
  SHA-256(
    authenticatorData (37 bytes of metadata — rpIdHash, flags, counter)
    ||
    SHA-256(clientDataJSON)
  )

Where clientDataJSON looks like:
  {"type":"webauthn.get","challenge":"c2VuZCAxMCB0b2tlbnM=","origin":"https://app.example.com"}
```

You can't turn this off. Every passkey signature has this wrapper. It's the WebAuthn spec — not optional.

### Why this matters for Aztec

To verify a passkey's signature on-chain, you'd need to reconstruct and parse this envelope inside a ZK circuit:
- **Parse JSON** in Noir — find `"challenge"` in a variable-length string
- **Decode base64url** in Noir — the challenge is encoded
- **SHA-256 over variable-length data** in Noir — `clientDataJSON` changes size depending on the origin URL

On EVM, Porto solves this with RIP-7212 (a precompile that verifies P-256 + envelope natively for 3,450 gas). **Aztec has no equivalent.** We'd have to write all that parsing logic in a custom Noir contract — possible but non-trivial (Tier 2).

### How Tier 1 avoids all of this

```
Tier 2 (direct passkey signing — future):
  passkey signs → wrapped signature → Noir must parse JSON, decode base64,
  hash variable data → custom Noir contract needed

Tier 1 (our approach — now):
  passkey → PRF → 32 bytes → derive P-256 key in JS → sign in software
  → signature is just: P-256(SHA-256(transaction_hash))
  → no JSON, no base64, no variable-length anything
  → existing EcdsaRAccountContract works as-is
```

Tier 1 sidesteps the envelope entirely by not using passkey signing for transactions. The passkey only provides key material (PRF). The actual signing is plain P-256 math in JavaScript.

---

## 9. The Noir Contract Needs Zero Changes (Tier 1)

The forked `EcdsaRAccountContract` already does exactly what we need:

```
Noir contract expects:  P-256 signature over SHA-256(outer_hash_bytes)
Our PasskeySigner does: p256.sign(sha256(outerHashBytes), derivedKey, { lowS: true })
Barretenberg does:      ecdsa_construct_signature<Sha256Hasher>(outerHashBytes, key)
```

All three compute SHA-256 then ECDSA-P256. Same math, same result. The fork is for **stability** (the `@aztec/accounts` package labels these as "sample implementations"), not behavioral changes.

---

## 10. The Bias Bug Is Real

`Fr.fromBufferReduce(32 bytes)` has ~17.6% relative bias (`2^256 / Fr.MODULUS ≈ 3.64`). Aztec's own `Fr.random()` uses 64 bytes to avoid this.

**Fix:** Derive 48 bytes via HKDF before reducing mod Fr. Bias drops to `2^-130` (negligible per RFC 9380).

```
PRF output (32 bytes)
  → HKDF-SHA-256(output, "", "aztec-wallet/v1/master-secret", 48 bytes)
  → Fr.fromBufferReduce(48 bytes)  ← bias: 2^-130 (safe)

NOT:
  → Fr.fromBufferReduce(32 bytes)  ← bias: ~17.6% (unsafe)
```

---

## 11. PRF Determinism Risks

| Risk | Severity | Status |
|------|----------|--------|
| Apple hybrid transport bug | **CRITICAL** | Safari 18.2+ returns different PRF values via cross-device QR code vs on-device. Active, unpatched. |
| UV inconsistency | HIGH | Must always use `userVerification: "required"` |
| iOS 18.0-18.3 bugs | MEDIUM | Fixed in 18.4+. Pin minimum OS version. |
| Hardware key factory reset | PERMANENT | Destroys CredRandom. No recovery possible. |
| CXP/CXF passkey migration | LOW | Spec preserves CredRandom, but real-world migration untested. |

The Apple hybrid bug is a **production blocker** until patched. A user creates wallet on Mac, scans QR to auth from iPhone, gets different PRF output, derives different keys, wallet shows empty.

---

## 12. ox/webauthx as Foundation Layer

`webauthx` (by wevm — the wagmi/viem team) wraps `ox/webauthn`. We can use `ox` for the WebAuthn ceremony layer:

**What ox gives us:**
- Credential creation with 1Password Firefox workaround
- PRF salt serialization (base64url ↔ Uint8Array)
- DER signature parsing with low-S normalization
- P-256 key generation and verification (wraps @noble/curves)
- AES-GCM encryption

**What ox does NOT do (we build):**
- PRF output extraction (`getClientExtensionResults().prf.results.first`)
- HKDF key derivation (PRF → master secret, signing key, encryption key)
- PasskeySigner (Aztec AuthWitnessProvider)
- PasskeyConnector (WalletConnector implementation)
- The forked Noir contract

**ox doesn't change our architecture.** Same PRF → HKDF → keys → software signing approach. It just handles the ceremony layer better than calling `navigator.credentials` directly.

---

## 13. Full Deterministic Chain

```
Passkey + Face ID
  → CredRandom (fixed 32 bytes inside credential)
  → HMAC-SHA-256(CredRandom, SHA-256("WebAuthn PRF" || 0x00 || "aztec-wallet/v1/master-key"))
  → 32 bytes (deterministic)
  → HKDF-SHA-256 with domain-separated info strings
  → masterSecret (Fr), signingKey (P-256), encryptionKey (AES-256), accountSalt (Fr)
  → deriveKeys(masterSecret) → 4 protocol keys (nhk, ivsk, ovsk, tsk)
  → signingKey → P-256 public key → constructor args
  → accountSalt + contractClassId + constructorArgs → address

  Every step is pure math. Same input = same output, always.
```

---

## 14. @noble/curves ↔ Barretenberg Compatibility (Must Verify)

Before any implementation, run the cross-library compatibility test:

```typescript
// Sign with @noble/curves, verify signature matches Barretenberg
const msg = randomBytes(32);
const nobleSig = p256.sign(sha256(msg), privateKey, { prehash: false, lowS: true });
const bbSig = await ecdsa.constructSignature(msg, privateKeyBuffer);
assert(nobleSig.r === toBigInt(bbSig.r));
assert(nobleSig.s === toBigInt(bbSig.s));
```

If this test fails, the entire Tier 1 approach is invalid. Most likely failure point: different low-S normalization behavior.

---

## 15. contractClassId Stability

The account address depends on `contractClassId`, derived from the compiled Noir artifact. If we recompile with a different Noir compiler version → different artifact → different classId → **different address for the same user**.

- Pin the Noir compiler version exactly
- Pin all Noir dependencies to specific commits
- Store the compiled artifact as the source of truth
- Any recompilation is a breaking change for all existing users

---

## 16. Account Deployment

The address exists before deployment. It's computed locally from pure math (public keys + contract artifact + salt). Users can receive funds immediately — no on-chain action needed.

Deployment happens automatically on the **first outgoing transaction**. The SDK deploys the account contract (with the P-256 public key as constructor arg) and executes the first transaction in the same batch. All future transactions use the already-deployed contract.

Deployment costs gas — covered by sponsored fees (dapp or fee-paying contract pays). The user shouldn't need tokens to deploy their account.

Returning users: Face ID → PRF → same keys → same address → contract already deployed → ready to sign.

---

## 17. Recovery

**Default (cloud sync):** Most users have synced passkeys (iCloud Keychain / Google Password Manager). Lose a device → sign into cloud account on new device → passkey is there → same PRF → same wallet. This covers the majority of cases.

**Multi-passkey (Model B, future):** For stronger guarantees, register a second passkey (e.g., YubiKey hardware key). Since different passkeys have different CredRandom → different PRF output, the master secret is encrypted with each passkey's PRF output and stored. Any registered passkey can decrypt it → same wallet.

**Total passkey loss = funds locked.** Same as losing a seed phrase. Mitigations: cloud sync recovery, multi-passkey across ecosystems (iCloud + YubiKey), and future social recovery via guardian keys in the account contract.

**Phase plan:** Ship Model A (single passkey, stateless derivation) first. Upgrade to Model B (encrypted vault, multi-passkey) when passkey rotation or backup becomes a requirement. The two models are compatible — detect if an encrypted vault exists, fall back to Model A if not.

---

## Things to Consider

### Viewing keys are always exposed during a session

Aztec's PXE runs client-side. It needs viewing keys in JS memory to decrypt notes (your balances, transaction history). This is true for **every tier**:

| | Funds (signing key) | Privacy (viewing keys) |
|---|---|---|
| Tier 1 | At risk during session (raw bytes in memory) | At risk during session |
| Tier 1.5 | Oracle-only during XSS (non-extractable CryptoKey) | At risk during session |
| Tier 2 | Safe (key never leaves hardware) | At risk during session |

If an XSS attack happens while the session is active, the attacker can read viewing keys and decrypt notes — seeing balances and transaction history. They **cannot** move funds (that requires the signing key), but privacy is compromised.

This is unavoidable without moving the PXE itself into hardware, which doesn't exist. Every client-side privacy chain has this trade-off.

### Tier 1.5: Non-extractable CryptoKey (middle ground)

Instead of holding the signing key as raw bytes for the entire session, import it into WebCrypto immediately after derivation and wipe the raw bytes:

```typescript
// Derive key from PRF
const signingKeyBytes = hkdf(prfOutput, "aztec-wallet/v1/p256-signing-key", 48);
const privateKeyScalar = reduceModP256Order(signingKeyBytes);
const publicKey = p256.getPublicKey(privateKeyScalar, false); // uncompressed, 65 bytes

// Import into WebCrypto as non-extractable (raw format only works for public keys —
// private keys must use JWK or PKCS#8)
const cryptoKey = await crypto.subtle.importKey(
  "jwk",
  { kty: "EC", crv: "P-256",
    x: base64url(publicKey.slice(1, 33)),
    y: base64url(publicKey.slice(33, 65)),
    d: base64url(privateKeyScalar) },
  { name: "ECDSA", namedCurve: "P-256" },
  false,     // extractable: false — can't read bytes back, ever
  ["sign"]
);

// Wipe raw bytes immediately
signingKeyBytes.fill(0);
privateKeyScalar.fill(0);

// Attacker can use cryptoKey as a signing oracle during XSS,
// but cannot steal the key bytes to use later or elsewhere
```

Shrinks the attack window from "entire session" to "milliseconds during import." Needs verification that WebCrypto's `crypto.subtle.sign()` output is compatible with the Noir contract.

---

### XSS protection: the iframe boundary

The wallet runs in a cross-origin iframe — a separate browser process from the dapp.

```
app.example.com (dapp)              wallet.aztec.network (iframe)
┌─────────────────────┐             ┌─────────────────────┐
│ Dapp JavaScript     │  postMessage│ PXE + keys + signing│
│                     │────────────►│                     │
│ Can be XSS'd        │  (only RPC) │ Cannot be XSS'd     │
│ (npm deps, user     │             │ (separate origin,   │
│  input, etc.)       │             │  separate process)  │
│                     │             │                     │
│ CANNOT access:      │             │ Has access to:      │
│ - keys              │             │ - signing key       │
│ - viewing keys      │             │ - viewing keys      │
│ - PXE data          │             │ - PXE IndexedDB     │
└─────────────────────┘             └─────────────────────┘
```

An XSS in the dapp cannot read the iframe's memory — Chrome's Site Isolation puts them in separate OS processes. The dapp can only send postMessage requests, not reach into the iframe's JS heap.

Remaining threats:
- **Wallet host compromised** (`wallet.aztec.network` itself) — catastrophic, but it's one domain we control
- **Malicious browser extensions** with host permissions — can inject into any origin, including the iframe
- **Dapp tricks user into approving a malicious transaction** — see below

### Transaction approval must live in the trusted context

A dapp can show fake transaction details in its own UI while sending a different payload via postMessage:

```
Dapp shows the user:          "Send 10 USDC to Alice"
Dapp actually sends to iframe: "Send 10,000 USDC to attacker"
```

The fix: the approval UI renders **inside the iframe or popup** on `wallet.aztec.network`. The dapp cannot modify what the iframe displays.

```
Dapp sends postMessage → iframe receives the REAL payload → shows approval dialog:

  ┌─────────────────────────────────────┐
  │  wallet.aztec.network says:          │
  │                                      │
  │  Send 10,000 USDC to 0xattacker...  │  ← the REAL payload
  │                                      │
  │  [Cancel]              [Approve]     │
  └─────────────────────────────────────┘
```

The user sees the real transaction on the trusted domain. If it doesn't match what the dapp claimed, they cancel. Same pattern as MetaMask's extension popup — the wallet shows the truth, not whatever the dapp says.

---

## Open Questions

1. **Apple hybrid PRF bug** — when will Apple fix it? Do we block on this or ship with a warning?
2. **PXE sync cost** — how long does note sync take? Determines if per-dapp PXE is viable.
3. **`@noble/curves` ↔ Barretenberg test** — must pass before any implementation starts.
4. **Who hosts `wallet.aztec.network`?** — critical trust point for the iframe wallet.
5. **Mobile proving** — iPhone OOMs on ZK proof generation. Desktop-only for now?
6. **WebCrypto signing compatibility** — does `crypto.subtle.sign("ECDSA", cryptoKey, data)` produce signatures the Noir contract accepts? Needed for Tier 1.5.
7. **Tier 2 priority** — is the custom Noir contract for direct WebAuthn signing worth building now, or ship Tier 1/1.5 first?
