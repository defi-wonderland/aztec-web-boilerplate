# Spec: Vendorable NetworkProvider

**Target:** `defi-wonderland/aztec-web-boilerplate`  
**File:** `src/aztec-wallet/providers/NetworkProvider.tsx` or equivalent  
**Purpose:** Generalize the network provider so it can be vendored without app-specific deployment config or storage keys.

---

## 1. Problem

The current `NetworkProvider` hardcodes:

| Issue | Current State | Why It Blocks Vendoring |
|-------|---------------|-------------------------|
| **Storage key** | `SELECTED_NETWORK_STORAGE_KEY = "hive_selected_network"` | Apps need unique keys for localStorage. |
| **Deployment check** | `getDeploymentConfig("local-network")` to check if contracts exist | Deployment config shape is app-specific (Dripper/Token vs neural contracts). |
| **Network config** | Imports `getNetwork`, `getAvailableNetworks` from `config/networks` | Network definitions are app-specific. |

---

## 2. Goal

The provider should:

1. Accept config for storage key, network list, and optional "is local deployed" check.
2. Avoid importing app `config/` modules.
3. Support different network config shapes via injection.

---

## 3. Proposed API

### 3.1 Config Interface

```typescript
export interface NetworkConfig {
  id: string;
  name: string;
  nodeUrl: string;
  chainId?: string;
  // ... other fields
}

export interface NetworkProviderProps {
  children: React.ReactNode;
  onNetworkChange?: (networkId: string) => void;

  /** Networks available for selection. */
  networks: NetworkConfig[] | (() => NetworkConfig[]);

  /** Default network ID when no stored preference. */
  defaultNetworkId?: string;

  /**
   * localStorage key for persisting selected network.
   * Default: "aztec_selected_network".
   */
  storageKey?: string;

  /**
   * Optional. Check if local network has deployed contracts.
   * If provided and returns false for "local-network", initial network falls back to defaultNetworkId or first available.
   */
  isLocalNetworkDeployed?: () => boolean;
}
```

### 3.2 Provider Behavior

- Reads initial network from `localStorage.getItem(storageKey)` if valid.
- If `isLocalNetworkDeployed` is provided and stored value is "local-network" but check returns false, override to `defaultNetworkId` or first non-local network.
- Persists selection changes to `localStorage.setItem(storageKey, networkId)`.
- Exposes `selectedNetwork`, `availableNetworks`, `setNetwork`, and optionally `localNetworkDeployed`.

---

## 4. Example: App Usage

```typescript
// Hive
const isLocalDeployed = () => {
  const { contracts } = getDeploymentConfig("local-network");
  return !!(contracts.singleLayer.address || contracts.multiLayerPerceptron.address || contracts.cnnGap.address);
};

<NetworkProvider
  networks={Object.values(NETWORKS)}
  defaultNetworkId="devnet"
  storageKey="hive_selected_network"
  isLocalNetworkDeployed={isLocalDeployed}
  onNetworkChange={(id) => { SharedPXEService.clearInstance(id); }}
>
  {children}
</NetworkProvider>

// Boilerplate
<NetworkProvider
  networks={AVAILABLE_NETWORKS}
  storageKey="aztec_selected_network"
  isLocalNetworkDeployed={() => hasDeployedContracts("sandbox")}
>
  {children}
</NetworkProvider>
```

---

## 5. Summary

| Change | Purpose |
|--------|---------|
| `networks` prop | Inject network list; no import from app config |
| `storageKey` prop | App-owned localStorage key |
| `isLocalNetworkDeployed` callback | App-specific deployment check |
| `defaultNetworkId` prop | Control fallback when local not deployed |
