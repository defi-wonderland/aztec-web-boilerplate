# Spec: Vendorable Connector Factories

**Target:** `defi-wonderland/aztec-web-boilerplate`  
**File:** `src/aztec-wallet/config/` or `src/aztec-wallet/connectors/factories.ts`  
**Purpose:** Document connector factory exports for vendoring. Factories compose connectors with config.

---

## 1. Problem

Apps need to create connectors (embedded, Azguard, etc.) with their own config. The boilerplate should export factory functions that accept config and return `ConnectorFactory` (or `IWalletConnector`).

---

## 2. Proposed API

### 2.1 Factory Functions

```typescript
/** Create embedded connector with app config. */
export function createEmbeddedConnector(
  config: EmbeddedConnectorConfig
): ConnectorFactory;

/** Create browser wallet connector (e.g. Azguard). */
export function createBrowserWalletConnector(
  config: BrowserWalletConfig
): IWalletConnector;

/** Convenience: create Azguard connector with default config. */
export function createAzguardConnector(
  overrides?: Partial<BrowserWalletConfig>
): ConnectorFactory;
```

### 2.2 Composition Helper

```typescript
/** Create connector instances from factory array. */
export function createConnectors(
  factories: ConnectorFactory[]
): IWalletConnector[];
```

---

## 3. Example: App Usage

```typescript
import {
  createEmbeddedConnector,
  createAzguardConnector,
  createConnectors,
} from "@vendor/aztec-wallet";

const connectors = createConnectors([
  createEmbeddedConnector({
    storageKeyPrefix: "hive_embedded_account",
    getCurrentNetworkId: () => getCurrentNetwork().id,
    getPXEInstance: () => SharedPXEService.getCurrentInstance(),
  }),
  createAzguardConnector({ id: "azguard", label: "Azguard Wallet" }),
]);

<WalletProvider connectors={connectors} autoConnect>
  {children}
</WalletProvider>
```

---

## 4. Summary

| Item | Purpose |
|------|---------|
| `createEmbeddedConnector(config)` | Config-driven embedded connector |
| `createAzguardConnector(overrides?)` | Convenience for Azguard |
| `createBrowserWalletConnector(config)` | Generic browser wallet |
| `createConnectors(factories)` | Compose connector array |
