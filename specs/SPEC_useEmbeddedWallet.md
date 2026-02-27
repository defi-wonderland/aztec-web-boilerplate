# Spec: Vendorable useEmbeddedWallet Hook

**Target:** `defi-wonderland/aztec-web-boilerplate`  
**File:** `src/aztec-wallet/hooks/useEmbeddedWallet.ts`  
**Purpose:** Generalize the embedded wallet hook so it can be vendored without app-specific storage keys.

---

## 1. Problem

The current `useEmbeddedWallet` hook hardcodes:

| Issue | Current State | Why It Blocks Vendoring |
|-------|---------------|-------------------------|
| **Storage key** | `getStorageKey(networkId) => \`hive_embedded_account_${networkId}\`` | Apps need their own prefix to avoid localStorage collisions. |

The hook also depends on `useSharedPXE` and `useNetwork` from app providers. Those are acceptable if the hook accepts an optional config that overrides defaults.

---

## 2. Goal

The hook should:

1. Accept an optional config with `storageKeyPrefix`.
2. Default to a generic prefix (e.g. `"embedded_account"`) when not provided.
3. Work with any network provider that supplies `selectedNetwork.id`.

---

## 3. Proposed API

### 3.1 Config Interface

```typescript
export interface UseEmbeddedWalletOptions {
  /** Prefix for localStorage keys. Full key = `${storageKeyPrefix}_${networkId}`. Default: "embedded_account". */
  storageKeyPrefix?: string;
}
```

### 3.2 Hook Signature

```typescript
export function useEmbeddedWallet(
  options?: UseEmbeddedWalletOptions
): UseEmbeddedWalletReturn;
```

### 3.3 Internal Storage Key

```typescript
const prefix = options?.storageKeyPrefix ?? "embedded_account";
const storageKey = `${prefix}_${selectedNetwork.id}`;
```

---

## 4. Dependencies

The hook requires:

- `useSharedPXE` (or equivalent) – for PXE instance.
- `useNetwork` (or equivalent) – for `selectedNetwork.id`.

These can remain as context dependencies; the vendored hook assumes the app provides `NetworkProvider` and `SharedPXEProvider` (or equivalent). The only configurable piece is the storage key prefix.

---

## 5. Example: App Usage

```typescript
// Hive
const result = useEmbeddedWallet({
  storageKeyPrefix: "hive_embedded_account",
});

// Boilerplate (uses default)
const result = useEmbeddedWallet();
```

---

## 6. Summary

| Change | Purpose |
|--------|---------|
| `storageKeyPrefix` option | App-owned localStorage namespace; default avoids collisions when app doesn't care |
