# Capability-Based Permissions for Passkey Wallet

**Date**: 2026-04-09
**Status**: Approved
**Parent**: [passkey-wallet-capabilities-design.md](../../passkey-wallet-capabilities-design.md)

---

## Overview

The passkey wallet implements capability-based permission enforcement using the standard `AppCapabilities` / `WalletCapabilities` protocol from `@aztec/aztec.js/wallet`. The dapp builds a full `AppCapabilities` manifest (like GregoSwap does) and passes it to `connect()`. The wallet displays it for user approval, stores grants in memory, and enforces them on every subsequent RPC call via a `CapabilityGuard` middleware in the iframe's `RPCHandler`.

---

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Manifest authorship | Dapp builds full `AppCapabilities` | Simplest approach, same as GregoSwap/Raven House. No SDK generator needed. |
| Human-readable display | Prettified function names + abbreviated addresses | Standard-compliant, no extensions to `AppCapabilities` metadata. Matches what the ecosystem does today. |
| Permission UI grouping | Grouped by contract with read/write badges | Users think per-contract: "what can this dapp do with my tokens?" |
| Connect model | Fused: manifest + biometric in one popup | Single ceremony, better UX than GregoSwap's two-step pattern. |
| No manifest behavior | Everything prompts (secure by default) | Forces dapps to adopt capabilities for smooth UX. Users always informed. |
| Behavior mode | Permissive only (v1) | Out-of-scope operations get runtime prompt, not rejection. |
| Writes | Always popup + biometric, regardless of scope | Never blind sign. Hardware signing is per-tx. |
| Grant storage | Memory-only (same lifecycle as protocol keys) | Cleared on disconnect/refresh. No persistence across sessions. |
| Guard location | `RPCHandler.ts` in iframe main thread | Trust boundary. Sees every call. Can open popups for runtime prompts. |
| Types | Import from `@aztec/aztec.js/wallet` | No custom types. Standard `AppCapabilities`, `WalletCapabilities`, `ContractFunctionPattern`, etc. |
| `requestCapabilities()` | Not implemented as separate method | Fused into `connect()`. No compatibility layer needed — dapps use our SDK. |

---

## Out of Scope (v1)

- `expiresAt` — capability expiration (always valid for session duration)
- `behavior.mode` — always permissive (strict mode deferred)
- Grant persistence across sessions — re-approved each connect
- Capability narrowing by the wallet — we grant exactly what was requested
- Capability upgrade flow — must disconnect + reconnect with new manifest
- `data` capability auto-generation
- `requestCapabilities()` as standalone RPC method
- Contract name enrichment in manifest metadata

---

## Architecture

### Capability Lifecycle

Three phases:

**Phase 1 — Connect (fused ceremony)**

```
Dapp calls connect(manifest?)
  │
  SDK sends manifest to iframe via SecureChannel
  │
  Iframe opens popup with two steps:
  ┌──────────────────────────────────┐
  │  Step 1: Permission Review       │
  │  (grouped by contract,           │
  │   read/write badges)             │
  │  [Reject]    [Approve & Continue]│
  └──────────────────────────────────┘
              │ user clicks Approve
  ┌──────────────────────────────────┐
  │  Step 2: Biometric (WebAuthn/PRF)│
  │  (existing, unchanged)           │
  └──────────────────────────────────┘
  │
  Keys derived → PXE initialized
  Grants stored in iframe JS memory
  WalletCapabilities returned to dapp
```

If no manifest is provided, the popup skips the permission review screen and goes straight to biometric. The guard will have no grants, so every subsequent operation triggers a runtime prompt.

**Phase 2 — Enforcement (every RPC call)**

```
Dapp calls wallet method (e.g., simulateTx)
  │
  SecureChannel → RPCHandler
  │
  CapabilityGuard.check(method, payload)
  │
  ├─ Ungated method (getChainInfo, registerSender)
  │    → pass through
  │
  ├─ Within granted scope
  │    → pass through silently
  │
  └─ Outside scope (or no grants)
       → open runtime prompt popup
       → user approves → pass through
       → user rejects → throw error (call never reaches PXE)
  │
  Worker executes via PXE/PasskeyWallet
```

Writes (`sendTx`, `createAuthWit`) always open the sign popup + biometric regardless of scope. The guard adds a "NOT PRE-APPROVED" warning badge if the operation is outside scope.

**Phase 3 — Cleanup**

Disconnect or page refresh → grants cleared from memory (same lifecycle as protocol keys).

### Data Flow

```
Dapp (untrusted)          │  Wallet iframe (trusted)             │  Worker
──────────────────────────│──────────────────────────────────────│──────────
SDK                       │  RPCHandler                          │  PXE
  connect(manifest)       │    ↓ receives manifest               │
  ↓                       │    ↓ opens popup (permission review) │
  PopupManager ──────────→│    ↓ stores grants in CapabilityGuard│
                          │                                      │
  wallet.simulateTx()     │    CapabilityGuard.check()           │
  ↓ serializes            │    ↓ allowed → forward               │
  SecureChannel ─────────→│    ↓ prompt → popup → user decision  │
  (encrypted)             │    ↓ forward to worker ─────────────→│ callWallet()
```

---

## CapabilityGuard

### Method → Capability Mapping

```
Method                      Required Capability             Scope Check
──────────────────────────────────────────────────────────────────────────
getAccounts                 accounts.canGet                  boolean
createAuthWit               accounts.canCreateAuthWit        boolean
registerContract            contracts.canRegister            contract address
getContractMetadata         contracts.canGetMetadata         contract address
getContractClassMetadata    contractClasses.canGetMetadata   class ID
simulateTx                  simulation.transactions          contract + function
executeUtility              simulation.utilities             contract + function
profileTx                   simulation.transactions          contract + function
sendTx                      transaction.scope                contract + function
getPrivateEvents            data.privateEvents               contract address
getAddressBook              data.addressBook                 boolean
──────────────────────────────────────────────────────────────────────────
getChainInfo                (ungated)
registerSender              (ungated)
```

### PatternMatcher

Matches incoming calls against `ContractFunctionPattern`:

- `'*'` scope → matches everything
- `{ contract: '0xABC', function: '*' }` → any function on that contract
- `{ contract: '0xABC', function: 'transfer' }` → exact match
- `{ contract: '*', function: 'transfer' }` → that function on any contract

For multi-call payloads (`ExecutionPayload` with multiple `FunctionCall` entries), **every call** must be within scope. If any single call is outside scope, the entire operation triggers a runtime prompt.

### Guard Behavior

```typescript
check(method: string, payload?: unknown): 'allowed' | 'prompt'
```

- No grants at all (no manifest provided) → `'prompt'` for everything except ungated
- Ungated method → `'allowed'` always
- Grant exists + scope matches → `'allowed'`
- Grant exists but scope doesn't match → `'prompt'`
- No matching grant type → `'prompt'`

The guard never throws. It returns `'allowed'` or `'prompt'`. The `RPCHandler` decides what to do with `'prompt'` (open runtime popup, await user decision). If the user denies, the RPCHandler throws before any execution — nothing reaches PXE or the network.

### Integration with RPCHandler

```typescript
// RPCHandler.register() — modified
channel.onRequest(async (method, params) => {
  if (method === 'initWithKeys') → handleInitWithKeys(params[0])
  if (method === 'disconnect')   → handleDisconnect()
  if (method === 'wallet') {
    const [methodName, serializedArgs] = params;

    // ── Capability Guard ──
    const decision = capabilityGuard.check(methodName, serializedArgs);
    if (decision === 'prompt') {
      const approved = await openRuntimePrompt(methodName, serializedArgs);
      if (!approved) throw new Error('User denied: operation not authorized');
    }
    // ── End guard ──

    return pxeManager.callWallet(methodName, serializedArgs);
  }
  return pxeManager.callPXE(method, params);
});
```

---

## Popup UI

### Connect Flow — Permission Review Screen

New step added to `ConnectFlow.tsx` before the biometric prompt. Shows the dapp's requested permissions grouped by contract.

**Layout:**
- App name + origin URL (from `manifest.metadata`)
- Account access row (if `accounts` capability present)
- Per-contract cards with:
  - Abbreviated contract address
  - READ badge (blue) + prettified function names from `simulation` capabilities
  - WRITE badge (red) + prettified function names from `transaction` capability
- Wildcard patterns (`contract: '*'`) shown as "Any Contract" section
- Contract registration row (if `contracts` capability present)
- "Reject" and "Approve & Continue" buttons

### Runtime Prompt — Out-of-Scope Operations

**Read operations** (simulateTx, executeUtility, getPrivateEvents, etc.):
- "NOT PRE-APPROVED" warning badge (orange)
- App name + origin
- Operation details: READ/WRITE badge + prettified function name + abbreviated contract address
- "Deny" / "Allow" buttons
- No biometric required (user already authenticated at connect)

**Write operations** (sendTx, createAuthWit):
- Same as read prompt but with additional note: "Biometric confirmation required"
- "Deny" / "Approve & Sign" button (orange, signals extra weight)
- Biometric fires after approval

### Writes Within Scope

Writes always show the existing `SignFlow` popup with transaction details + biometric. No additional capability prompt needed — the user already pre-approved the function at connect time. The sign popup is the per-transaction confirmation.

---

## PermissionDisplay — Capabilities to UI Transformation

Transforms raw `AppCapabilities` into grouped UI-ready data for the popup.

### Transformation Rules

1. Collect all `ContractFunctionPattern` entries from `simulation` and `transaction` capabilities
2. Functions in `simulation.transactions` + `simulation.utilities` → **reads**
3. Functions in `transaction.scope` → **writes**
4. Group by contract address
5. Patterns where `contract === '*'` go into `wildcardFunctions`
6. Prettify function names: `balance_of_private` → split on `_` → capitalize each word → "Balance of Private"
7. A function appearing in both simulation and transaction stays in both categories (readable AND writable)

### Output Structure

```typescript
{
  accountAccess: { canGet: boolean, canCreateAuthWit: boolean },
  contractRegistration: { contracts: AztecAddress[] | '*', count: number },
  contractGroups: [
    {
      address: string,            // abbreviated: '0xAABB...1234'
      fullAddress: AztecAddress,
      reads: string[],            // prettified: ['Balance of Public', 'Balance of Private']
      writes: string[],           // prettified: ['Transfer']
    },
  ],
  wildcardFunctions: string[],    // prettified: ['Constructor', 'Publish for Public Execution']
}
```

### Edge Cases

- `'*'` scope (global wildcard): display "All functions" instead of a list
- Empty manifest: no groups, show "No specific permissions requested"
- Large manifests (70+ patterns): per-contract grouping keeps it manageable, each card collapsible

---

## SDK-Side Changes

### `connect()` accepts optional manifest

```typescript
// Dapp usage
const manifest = createMyAppCapabilities();  // dapp builds this
const { wallet, capabilities } = await passkeyWallet.connect(manifest);
```

The manifest travels through the existing flow:
1. SDK passes manifest to `PopupManager.openPopup('connect', { manifest })` — popup shows permission review
2. After popup approval + biometric, SDK sends manifest alongside `initWithKeys` to iframe via SecureChannel
3. Iframe's `RPCHandler` stores grants from the approved manifest in `CapabilityGuard`

### `WalletCapabilities` returned after connect

```typescript
// capabilities: WalletCapabilities
{
  version: '1.0',
  granted: GrantedCapability[],
  wallet: { name: 'Passkey Wallet', version: '1.0.0' },
}
```

The dapp can inspect granted capabilities to adapt its UI (e.g., checking if simulation was granted to show a "preview" button).

---

## New Files

```
packages/passkey-wallet/src/
├── host/
│   ├── capabilities/
│   │   ├── CapabilityGuard.ts       # check() middleware — holds grants, returns 'allowed' | 'prompt'
│   │   ├── PatternMatcher.ts        # ContractFunctionPattern wildcard matching
│   │   └── PermissionDisplay.ts     # Transform AppCapabilities → grouped UI data
│   ├── RPCHandler.ts                # Modified: guard inserted before dispatch
│   └── PXEManager.ts               # Unchanged
├── popup/
│   ├── ConnectFlow.tsx              # Modified: permission review step added before biometric
│   ├── PermissionReview.tsx         # NEW: grouped-by-contract permission UI component
│   ├── RuntimePrompt.tsx            # NEW: out-of-scope approval popup component
│   └── SignFlow.tsx                 # Modified: "NOT PRE-APPROVED" warning badge for out-of-scope writes
├── sdk/
│   ├── createPasskeyWallet.ts       # Modified: connect() accepts AppCapabilities parameter
│   └── ...
└── shared/
    └── types.ts                     # Modified: manifest added to connect params / popup data
```

---

## References

- **Spec**: [`capabilities.ts`](https://github.com/AztecProtocol/aztec-packages/blob/next/yarn-project/aztec.js/src/wallet/capabilities.ts) — 6 capability types, `AppCapabilities`, `WalletCapabilities`
- **Zod schemas**: [`wallet.ts`](https://github.com/AztecProtocol/aztec-packages/blob/next/yarn-project/aztec.js/src/wallet/wallet.ts) — `AppCapabilitiesSchema`, `WalletCapabilitiesSchema`
- **GregoSwap reference**: [`capabilities.ts`](https://github.com/AztecProtocol/gregoswap/blob/main/src/config/capabilities.ts) — explicit manifest pattern
- **Raven House**: Observed production manifest from Azguard wallet on [app.ravenhouse.xyz](https://app.ravenhouse.xyz/)
- **Parent design doc**: [passkey-wallet-capabilities-design.md](../../passkey-wallet-capabilities-design.md)
