# Spec: Vendorable AzguardAdapter

**Target:** `defi-wonderland/aztec-web-boilerplate`  
**File:** `src/aztec-wallet/adapters/azguard/`  
**Purpose:** Document the Azguard adapter API for vendoring. Implementation is already generic; ensure it is exported and optionally supports both SDK and raw `window.azguard` modes.

---

## 1. Problem

The boilerplate uses `@azguardwallet/client` for Azguard. Some apps (e.g. Hive) use raw `window.azguard` to avoid the SDK dependency. A vendored adapter should:

- Support at least one mode (SDK or raw).
- Implement `IBrowserWalletAdapter` consistently.
- Have no app-specific storage keys or config imports.

---

## 2. Current State

Hive's `AzguardAdapter`:

- Implements `IBrowserWalletAdapter`.
- Uses `window.azguard` directly (no `@azguardwallet/client`).
- No hardcoded app config.

Boilerplate's adapter likely uses `@azguardwallet/client`. Both are valid; the interface is the same.

---

## 3. Proposed Export

### 3.1 Interface (from WalletTypes)

```typescript
export interface IBrowserWalletAdapter {
  readonly id: string;
  readonly label: string;
  initialize(): Promise<void>;
  destroy(): void;
  getState(): WalletState;
  isAvailable(): boolean;
  getAccounts(): Promise<WalletAccount[]>;
  connect(networkName?: string): Promise<WalletAccount[]>;
  disconnect(): Promise<void>;
  onAccountsChanged(callback: (accounts: WalletAccount[]) => void): () => void;
  onDisconnected(callback: () => void): () => void;
}
```

### 3.2 Factory

```typescript
export function createAzguardAdapter(): IBrowserWalletAdapter;
```

### 3.3 Optional: Dual Mode

If the boilerplate wants to support both SDK and raw modes:

```typescript
export interface AzguardAdapterConfig {
  /** "sdk" uses @azguardwallet/client; "raw" uses window.azguard. Default: "sdk". */
  mode?: "sdk" | "raw";
}

export function createAzguardAdapter(config?: AzguardAdapterConfig): IBrowserWalletAdapter;
```

---

## 4. Example: App Usage

```typescript
// Hive (raw mode, no SDK)
import { createAzguardAdapter } from "@vendor/aztec-wallet";
const adapter = createAzguardAdapter({ mode: "raw" });

// Boilerplate (SDK mode)
const adapter = createAzguardAdapter();
```

---

## 5. Summary

| Item | Purpose |
|------|---------|
| Export `createAzguardAdapter` | Reusable adapter factory |
| Optional `mode` config | Support apps that avoid `@azguardwallet/client` |
| No app-specific logic | Already satisfied |
