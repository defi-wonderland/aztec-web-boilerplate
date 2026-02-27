# Spec: Vendorable EmbeddedWalletConnector

**Target:** `defi-wonderland/aztec-web-boilerplate`  
**File:** `src/aztec-wallet/connectors/EmbeddedConnector.ts`  
**Purpose:** Generalize the embedded wallet connector so it can be vendored without app-specific storage keys or network resolution.

---

## 1. Problem

The current embedded connector (or a forked version) hardcodes:

| Issue | Current State | Why It Blocks Vendoring |
|-------|---------------|-------------------------|
| **Storage key** | `STORAGE_KEY_PREFIX = "hive_embedded_account"` | Every app needs its own namespace (e.g. `myapp_embedded_account`) to avoid localStorage collisions. |
| **Network resolution** | Imports `getCurrentNetwork()` from `config/networks` | Network config is app-specific. Storage keys include network ID; the connector must resolve "current network" without importing app config. |
| **MinimalWallet** | Inline class definition in connector | Duplicated across connectors and hooks. Should be shared or injectable. |

---

## 2. Goal

The embedded connector should:

1. Accept a config object for storage keys and network resolution.
2. Avoid importing from `config/` or app modules.
3. Support lazy PXE initialization via a callback or shared service reference.

---

## 3. Proposed API

### 3.1 Config Interface

```typescript
export interface EmbeddedConnectorConfig {
  /** Prefix for localStorage keys. Full key = `${storageKeyPrefix}_${networkId}` */
  storageKeyPrefix: string;

  /** Resolve the current network ID (used for storage key, chainId). */
  getCurrentNetworkId: () => string;

  /** Optional. Resolve chainId for the current network. Defaults to a generic value. */
  getChainId?: (networkId: string) => string;

  /** Get or create the PXE instance. Called lazily on connect(). */
  getPXEInstance: () => Promise<SharedPXEInstance>;

  /** Optional. Account contract type. Defaults to EcdsaRAccountContract. */
  accountContractFactory?: (signingKey: Buffer) => AccountContract;
}
```

### 3.2 Factory

```typescript
export function createEmbeddedConnector(
  config: EmbeddedConnectorConfig
): IWalletConnector;
```

### 3.3 Connector Behavior

- Uses `config.storageKeyPrefix` + `config.getCurrentNetworkId()` for storage key.
- On `connect()`: calls `config.getPXEInstance()`, then creates/reconnects account via stored credentials or new generation.
- Emits `onAccountsChanged`, `onDisconnected`, `onError`.
- Implements `IWalletConnector` as today.

---

## 4. Example: App Usage

```typescript
// Hive
const connector = createEmbeddedConnector({
  storageKeyPrefix: "hive_embedded_account",
  getCurrentNetworkId: () => getCurrentNetwork().id,
  getChainId: (id) => getNetwork(id).chainId,
  getPXEInstance: () => SharedPXEService.getCurrentInstance(),
});

// Boilerplate
const connector = createEmbeddedConnector({
  storageKeyPrefix: "aztec_embedded_account",
  getCurrentNetworkId: () => getCurrentNetwork().id,
  getPXEInstance: () => SharedPXEService.getCurrentInstance(),
});
```

---

## 5. Summary

| Change | Purpose |
|--------|---------|
| `storageKeyPrefix` | App-owned localStorage namespace |
| `getCurrentNetworkId` | Decouple from app's network module |
| `getChainId` | Optional chainId for state |
| `getPXEInstance` | Lazy PXE resolution; app provides SharedPXEService or equivalent |
