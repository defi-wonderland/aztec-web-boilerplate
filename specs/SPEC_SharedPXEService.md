# Spec: Vendorable SharedPXEService API

**Target:** `defi-wonderland/aztec-web-boilerplate`  
**File:** `src/aztec-wallet/services/aztec/pxe/SharedPXEService.ts`  
**Purpose:** Generalize `SharedPXEService` so it can be vendored (copied or published) into other Aztec apps without app-specific logic.

---

## 1. Problem

The current `SharedPXEService` in the boilerplate works well for the boilerplate app, but it has hardcoded dependencies that make it unsuitable for reuse:

| Issue | Current State | Why It Blocks Vendoring |
|-------|---------------|-------------------------|
| **Config imports** | Imports `AVAILABLE_NETWORKS` from `config/networks` | Every app has different network config. The service cannot assume this module exists or has the same shape. |
| **Prover logic** | `getProverEnabled(networkName)` looks up `networkConfig.proverEnabled` from `AVAILABLE_NETWORKS` | Prover requirements vary by app and environment. |
| **Node client** | Uses `NetworkService.getNodeClient(nodeUrl)` | Node creation may need proxy URLs, test mocks, or custom options. |
| **Fee payment** | Uses `FeePaymentRegister` + `feePaymentConfig` from network config | Fee payment contract config is app-specific. |
| **Storage service** | Imports `AztecStorageService`, `registerSavedSenders` | Sender persistence is optional; not all apps use it. |
| **Wallet** | Creates `MinimalWallet` and bundles it in `SharedPXEInstance` | Some apps create wallets elsewhere (e.g. per connector); others want a shared one. The service shouldn't dictate this. |

When another app (e.g. Hive Training) forks the boilerplate, it must either:

- Reimplement `SharedPXEService` with its own config and contracts, or  
- Fork and heavily patch the service to remove/change these imports.

Both paths lead to divergence and duplication instead of a single vendorable implementation.

---

## 2. Goal

`SharedPXEService` should:

1. **Be configuration-driven** — All app-specific behavior comes from a config object passed at construction.
2. **Avoid importing app modules** — No imports from `config/`, `services/`, or app-specific artifacts.
3. **Support optional extensions** — Fee payment, contract registration, storage, and wallet are pluggable via callbacks or optional config.
4. **Stay generic** — A new app can use it by supplying its own config; no changes to the service code.

---

## 3. Proposed API

### 3.1 Config Interface

```typescript
/**
 * Configuration for SharedPXEService.
 * All app-specific behavior is injected via this config.
 */
export interface SharedPXEServiceConfig {
  /** Unique prefix for PXE store names (e.g. "my-app-pxe"). Used for IndexedDB. */
  storePrefix: string;

  /** Resolve whether prover is enabled for a given network. */
  getProverEnabled: (networkName: string) => boolean;

  /** Create Aztec node client from URL. Allows proxy logic, mocks, etc. */
  createNodeClient: (nodeUrl: string) => AztecNode;

  /**
   * Optional. Called after PXE is created and base contracts (e.g. SponsoredFPC) are registered.
   * App registers its own contracts here.
   */
  onPxeReady?: (
    pxe: PXE,
    aztecNode: AztecNode,
    context: { networkName: string; networkId?: string }
  ) => Promise<void>;

  /**
   * Optional. Customize fee payment registration beyond SponsoredFPC.
   * If omitted, only SponsoredFPC is registered.
   */
  registerFeePaymentContracts?: (pxe: PXE, context: { networkName: string }) => Promise<void>;

  /**
   * Optional. Format connection errors for user-facing messages.
   */
  formatConnectionError?: (
    error: unknown,
    ctx: { nodeUrl: string; networkName?: string }
  ) => string;

  /**
   * Optional. Create IndexedDB store for PXE. If omitted, PXE uses its default store.
   * Providing this allows explicit store naming and fallback logic (e.g. size limit).
   */
  createStore?: (
    networkName: string,
    storeName: string
  ) => Promise<AztecKVStore>;

  /** Optional. Logger. Defaults to console. */
  logger?: { info: (msg: string, ...args: unknown[]) => void; warn: (...); error: (...); };
}
```

### 3.2 Instance Interface

```typescript
export interface SharedPXEInstance {
  pxe: PXE;
  aztecNode: AztecNode;
  nodeInfo: { nodeVersion: string };
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;

  /** Optional. Only present if config provided a wallet factory. */
  wallet?: MinimalWallet;
}
```

### 3.3 Factory and Public Methods

```typescript
/**
 * Create a SharedPXEService instance. Replaces the current singleton constructor.
 */
export function createSharedPXEService(
  config: SharedPXEServiceConfig
): SharedPXEService;

interface SharedPXEService {
  getInstance(nodeUrl: string, networkName: string): Promise<SharedPXEInstance>;
  getCurrentInstance?(networkId?: string): Promise<SharedPXEInstance>;  // Optional convenience
  getExistingInstance(networkName: string): SharedPXEInstance | null;
  isInitialized(networkName: string): boolean;
  isInitializing(networkName: string): boolean;
  clearInstance(networkName: string): void;
  clearAll(): void;

  /**
   * Clear the IndexedDB store for a network. Requires config.storePrefix to be set.
   * Store names are derived as `${storePrefix}-${networkName}` and `${storePrefix}-${networkName}-tmp`.
   */
  clearPXEStore(networkName: string): Promise<void>;
}
```

---

## 4. Rationale for Each Change

### 4.1 `storePrefix`

**Why:** IndexedDB store names must be unique per app. Hardcoding `aztec-pxe` causes collisions when multiple Aztec apps run in the same origin. Apps need to own their store namespace.

### 4.2 `getProverEnabled(networkName)`

**Why:** Prover requirements differ by network and environment. Sandbox often uses `proverEnabled: false`; devnet uses `true`. The service should not assume a fixed mapping from network name to prover config.

### 4.3 `createNodeClient(nodeUrl)`

**Why:** Node creation may require:

- Proxying through `/rpc` in the browser
- Custom headers or auth
- Test mocks (`createNodeClient` returns a fake node)

Centralizing this in config keeps the service generic.

### 4.4 `onPxeReady(pxe, aztecNode, context)`

**Why:** Contract registration is app-specific. The boilerplate uses Dripper, Token; other apps use neural contracts, custom FPCs, etc. The service should only guarantee SponsoredFPC (for sponsored txs). All other contracts are registered by the app in this callback.

### 4.5 `registerFeePaymentContracts(pxe, context)` (optional)

**Why:** The boilerplate supports MeteredFPC in addition to SponsoredFPC. Making this a config callback allows apps to plug in any fee payment setup without changing the service.

### 4.6 `formatConnectionError(error, ctx)` (optional)

**Why:** Connection failure messages are app-specific (e.g. "Start with `yarn aztec:start`"). A config callback keeps UX control in the app.

### 4.7 `createStore(networkName, storeName)` (optional)

**Why:** The boilerplate uses explicit IndexedDB store creation with size limits and fallback. This gives predictable store names and robustness. If provided, `clearPXEStore` can reliably delete the correct databases. If omitted, the service uses PXE's default store behavior (simpler but less controllable).

### 4.8 `clearPXEStore(networkName)`

**Why:** Accumulated accounts can cause RPC errors. Apps need a way to reset the store. The service must derive store names from `storePrefix` so it knows exactly which IndexedDB databases to delete.

---

## 5. Migration Path

1. Introduce `SharedPXEServiceConfig` and `createSharedPXEService(config)`.
2. Move current behavior behind a default config that matches the boilerplate's existing imports (e.g. `AVAILABLE_NETWORKS`, `NetworkService`, `FeePaymentRegister`).
3. Export the factory; keep a convenience singleton that uses this default config for backward compatibility.
4. Gradually replace direct imports in `SharedPXEService` with config callbacks.
5. Document the config interface and provide a minimal example for a fresh app.
6. Update the boilerplate app to pass explicit config; deprecate the legacy singleton if desired.

---

## 6. Example: Boilerplate Usage

```typescript
// src/config/sharedPxeConfig.ts
import { createSharedPXEService } from './aztec-wallet/services/aztec/pxe';
import { AVAILABLE_NETWORKS } from './config/networks';
import { NetworkService } from './services/aztec/network';
import { FeePaymentRegister } from './services/aztec/feePayment/FeePaymentRegister';
// ... other app imports

export const SharedPXEService = createSharedPXEService({
  storePrefix: 'aztec-pxe',
  getProverEnabled: (networkName) => {
    const cfg = AVAILABLE_NETWORKS.find((n) => n.name === networkName);
    if (!cfg) throw new Error(`Network not found: ${networkName}`);
    return cfg.proverEnabled;
  },
  createNodeClient: (nodeUrl) => NetworkService.getNodeClient(nodeUrl),
  registerFeePaymentContracts: async (pxe, { networkName }) => {
    const config = getFeePaymentConfig(networkName);
    await new FeePaymentRegister().registerAll(pxe, config);
  },
  createStore: (networkName, storeName) =>
    createStore(storeName, { dataDirectory: 'pxe', dataStoreMapSizeKb: 5e5 }, undefined, pxeLogger),
});
```

---

## 7. Example: Minimal App (e.g. Hive)

```typescript
// app/config/sharedPxeConfig.ts
import { createSharedPXEService } from '@vendor/shared-pxe'; // or vendored copy

export const SharedPXEService = createSharedPXEService({
  storePrefix: 'hive-pxe',
  getProverEnabled: (name) =>
    ['devnet', 'aztec-devnet'].includes(name.toLowerCase().replace(/\s+/g, '-')),
  createNodeClient: createAztecNodeClient,
  onPxeReady: async (pxe, aztecNode, { networkId }) => {
    const deployment = getDeploymentConfig(networkId ?? 'local-network');
    await registerNeuralContracts(pxe, aztecNode, deployment.contracts);
  },
  formatConnectionError: (err, { nodeUrl, networkName }) =>
    formatConnectionError(err, nodeUrl, networkName),
});
```

---

## 8. Summary

| Change | Purpose |
|--------|---------|
| Config-driven construction | Remove app imports from the service |
| `storePrefix` | Unambiguous, app-owned IndexedDB names |
| `getProverEnabled` | App controls prover per network |
| `createNodeClient` | App controls node creation (proxy, mocks, etc.) |
| `onPxeReady` | App registers its own contracts |
| `registerFeePaymentContracts` | Pluggable fee payment beyond SponsoredFPC |
| `formatConnectionError` | App-specific error UX |
| `createStore` | Explicit store creation and reliable `clearPXEStore` |

With these changes, `SharedPXEService` becomes a reusable, vendorable component that any Aztec app can configure without modifying its source code.
