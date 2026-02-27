# Spec: Vendorable useSharedPXE Hook

**Target:** `defi-wonderland/aztec-web-boilerplate`  
**File:** `src/aztec-wallet/hooks/useSharedPXE.ts`  
**Purpose:** Generalize the shared PXE hook so it can be vendored without app-specific network resolution or error messages.

---

## 1. Problem

The current `useSharedPXE` hook:

| Issue | Current State | Why It Blocks Vendoring |
|-------|---------------|-------------------------|
| **Network resolution** | Imports `useNetwork`, `getPxeUrl` from app config | Network config is app-specific. |
| **PXE service** | Calls `SharedPXEService.getInstance(nodeUrl, selectedNetwork.name)` | Service must be injectable. |
| **Error message** | Hardcodes `"yarn aztec:start"` for local network connection failures | Apps may use different commands (e.g. `aztec start`). |

---

## 2. Goal

The hook should:

1. Accept an optional config for `getPxeUrl`, `formatLocalNetworkError`, and `SharedPXEService` reference.
2. Work with any network provider that supplies `selectedNetwork`.
3. Use generic or configurable error messages.

---

## 3. Proposed API

### 3.1 Config Interface

```typescript
export interface UseSharedPXEOptions {
  /** If true, automatically initialize on mount when network is selected. Default: false. */
  autoInitialize?: boolean;

  /** Resolve PXE node URL from network ID. Required if no SharedPXEService.getCurrentInstance. */
  getPxeUrl?: (networkId: string) => string;

  /**
   * SharedPXEService instance. If not provided, uses the default singleton.
   * Allows apps to pass a configured instance from createSharedPXEService().
   */
  sharedPXEService?: SharedPXEService;

  /**
   * Format connection errors for local network. Used when connection fails and network is local.
   * Default: generic "Local network is not running" message.
   */
  formatLocalNetworkError?: () => string;
}
```

### 3.2 Hook Signature

```typescript
export function useSharedPXE(
  options?: UseSharedPXEOptions
): UseSharedPXEReturn;
```

### 3.3 Internal Logic

- If `sharedPXEService` is provided, use it. Otherwise use the default (or throw if none).
- If `SharedPXEService.getCurrentInstance(networkId)` exists, use it (preferred).
- Otherwise use `getInstance(getPxeUrl(networkId), networkName)`.
- On connection error for local network: call `formatLocalNetworkError?.()` or use default message.

---

## 4. Dependencies

- `useNetwork` – for `selectedNetwork.id` and `selectedNetwork.name`.
- `SharedPXEService` – either default or injected via options.

---

## 5. Example: App Usage

```typescript
// Hive
const result = useSharedPXE({
  autoInitialize: false,
  sharedPXEService: SharedPXEService, // from createSharedPXEService()
  formatLocalNetworkError: () =>
    "Local network is not running. Start it with `yarn aztec:start` or switch to devnet.",
});

// Minimal app
const result = useSharedPXE({
  autoInitialize: true,
  formatLocalNetworkError: () =>
    "Start the local node with `aztec start --local-network`.",
});
```

---

## 6. Summary

| Change | Purpose |
|--------|---------|
| `getPxeUrl` option | App controls URL resolution (proxy, env, etc.) |
| `sharedPXEService` option | App passes configured instance |
| `formatLocalNetworkError` option | App-specific error UX |
