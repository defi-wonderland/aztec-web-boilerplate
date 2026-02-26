# PR #53 Review: refactor: react query contract hooks

**+2192 / -821** across 12 commits | Draft PR

## Overview

This PR introduces a new `src/use-aztec/` module — a wallet-agnostic abstraction layer for Aztec contract interaction hooks. It replaces the old `useReadContract` and `useWriteContract` hooks with declarative TanStack Query-backed equivalents that mirror wagmi's API (`useReadContract`, `useWriteContract`, `useReadContracts`).

**Architecture:**
- **Config adapters** (connector, app-managed, browser wallet) → resolve to a unified `UseAztecConfig`
- **Core execution** functions (pure async, no React) → `executeRead`, `executeBatchRead`, `executeWrite`
- **Hooks** consume context config via `useAztec()` and delegate to TanStack Query
- **Bridge provider** (`UseAztecConfigProvider`) wires `aztec-wallet` state into the new config system

The design is well-structured: separation of concerns between core logic and React is clean, the adapter pattern makes it extensible, and the wagmi-like API is a good DX choice.

---

## Issues

### 1. Sequential → Parallel batch reads may break PXE

**`src/use-aztec/core/executeBatchRead.ts`** — `executeAppManagedBatch` uses `Promise.all(promises)` for parallel contract reads. The old `readContracts` in the deleted `useReadContract.ts` explicitly ran these **sequentially** with the comment:

> "ctx.type === 'app_managed' — sequential with contract instance caching"

This was intentional because PXE may not support concurrent operations. This behavioral change could cause intermittent failures or race conditions.

### 2. `useDynamicContractCaller` not migrated

This hook was rewritten to inline all wallet type detection + execution logic instead of using the new `use-aztec` core functions. It directly imports `isBrowserWalletConnector`, `hasAppManagedPXE`, `createFeePaymentMethod`, etc. — the exact logic the new module was designed to centralize.

This creates two parallel codepaths for the same operations, defeating the refactor's purpose. It should use `useAztec()` context or at minimum the core execution functions.

### 3. `useDripper` shares mutation state across two operations

`useDripper` now uses a single `useWriteContract()` instance for both `dripToPrivate` and `dripToPublic`. Since there's one underlying `useMutation`, calling `dripToPublic` after `dripToPrivate` would reset/overwrite the mutation's `isPending`/`error`/`data` state. The old code had two separate `useMutation` instances to keep their states independent.

If a user triggers one drip and then quickly another, the state tracking becomes unreliable. Consider using two `useWriteContract()` instances, or moving to a pattern where each drip function doesn't share mutation state.

### 4. `DEFAULT_FEE_PAYMENT_METHOD` defined in 3 places

The constant `'sponsored'` is hardcoded in:
- `src/use-aztec/config/adapters/connectorAdapter.ts:78`
- `src/use-aztec/config/adapters/appManagedAdapter.ts:78`
- `src/use-aztec/hooks/useWriteContract.ts:12`

Should be a single export from `config/types.ts` or similar.

### 5. `ContractRegistryInitializer` — dependency removed from useMemo

```tsx
// Before:
const initialContracts = useMemo(() => getInitialContracts(typedContractsConfig), [typedContractsConfig]);

// After:
const initialContracts = useMemo(() => getInitialContracts(typedContractsConfig), []);
```

If `typedContractsConfig` is truly static this is fine, but dropping the dependency with no comment explaining why is suspicious. The linter should flag this (eslint `react-hooks/exhaustive-deps`).

### 6. Duplicated receipt polling logic

There are now two implementations:
- `src/use-aztec/utils/txReceipt.ts` — new, parameterized, used by core write
- `src/utils/txReceipt.ts` — old, used by `useDynamicContractCaller`

If `useDynamicContractCaller` gets migrated (point 2), the old one can be removed. Until then, there are two codepaths to maintain.

---

## Minor / Style

- **`AGENTS.md` added** — This is documentation not mentioned in the PR description. Consider whether it belongs in this PR or a separate chore commit.
- **`src/utils/azguard.ts` → `src/utils/caip.ts` rename** — Good. More descriptive name.
- **Store formatting fix** in `store/contractInteraction/store.ts` — Unrelated cleanup, fine to include.
- **`ContractClassFor` type** changed `at` signature from `(address, wallet) => TContract` to `(...args: any[]) => Promise<TContract> | TContract` with an eslint-disable for `any`. The broadening is pragmatic but loses type safety on the `at` call. Worth a comment explaining why.

---

## What looks good

- Clean separation: core execution functions have zero React dependencies
- Adapter pattern is extensible for future wallet types
- wagmi-like API is well-typed and developer-friendly
- `UseAztecProvider` bridge keeps `use-aztec` decoupled from `aztec-wallet`
- Batch reads use a proper `allowFailure` discriminated union
- Silent default logger avoids noisy library output
- Type re-export strategy keeps canonical types in `src/types/contractTypes.ts`

---

## Summary

The architecture is solid and the direction is right. The main blockers are:

1. **Sequential vs parallel PXE batch reads** — potential runtime breakage
2. **Shared mutation state in `useDripper`** — UI state bugs
3. **`useDynamicContractCaller` not migrated** — defeats centralization goal

Everything else is minor cleanup. Recommend addressing items 1-3 before moving out of draft.
