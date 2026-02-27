# Spec: Vendorable WalletProvider

**Target:** `defi-wonderland/aztec-web-boilerplate`  
**File:** `src/aztec-wallet/providers/WalletProvider.tsx` or equivalent (e.g. within `AztecWalletProvider`)  
**Purpose:** Generalize the wallet provider so it can be vendored without app-specific localStorage keys for auto-reconnect.

---

## 1. Problem

The current wallet provider (or a simplified fork) hardcodes:

| Issue | Current State | Why It Blocks Vendoring |
|-------|---------------|-------------------------|
| **Auto-reconnect key** | `localStorage.getItem("hive_last_connector")` | Apps need unique keys so multiple Aztec apps on the same origin don't overwrite each other. |

---

## 2. Goal

The provider should:

1. Accept an optional config for the localStorage key used for "last connected connector" persistence.
2. Default to a generic key (e.g. `"aztec_last_connector"`) when not provided.
3. Support multiple connectors and auto-connect behavior.

---

## 3. Proposed API

### 3.1 Config Interface

```typescript
export interface WalletProviderProps {
  children: React.ReactNode;
  connectors?: ConnectorFactory[];
  autoConnect?: boolean;

  /**
   * localStorage key for persisting last connected connector ID.
   * Default: "aztec_last_connector".
   */
  lastConnectorStorageKey?: string;
}
```

### 3.2 Usage

```typescript
// Internal
const storageKey = lastConnectorStorageKey ?? "aztec_last_connector";
const storedConnectorId = localStorage.getItem(storageKey);
// ...
localStorage.setItem(storageKey, connectorId);
```

---

## 4. Example: App Usage

```typescript
// Hive
<WalletProvider
  connectors={walletKitConfig.connectors}
  autoConnect={true}
  lastConnectorStorageKey="hive_last_connector"
>
  {children}
</WalletProvider>

// Boilerplate (uses default)
<WalletProvider connectors={connectors} autoConnect={true}>
  {children}
</WalletProvider>
```

---

## 5. Summary

| Change | Purpose |
|--------|---------|
| `lastConnectorStorageKey` prop | App-owned localStorage key for auto-reconnect |
