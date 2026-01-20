# aztec-wallet Library Refactor Plan

> **Goal**: Transform `aztec-wallet` into a clean, well-documented library with a minimal public API surface.

## Principles

1. **Minimal API surface** - Only export what users need
2. **Encapsulation** - Internal stores/services are implementation details
3. **Stability** - Exported API becomes a contract, don't export what might change
4. **Documentation** - Every export must have JSDoc documentation

---

## Target Public API

```typescript
// ===== PROVIDER =====
export { AztecWalletProvider } from './providers';

// ===== CONFIG =====
export { createAztecWalletConfig } from './config';

// ===== COMPONENTS =====
export { ConnectButton } from './components';

// ===== HOOKS =====
export {
  useAztecWallet,     // Main hook
  useConnectModal,    // For custom UI
  useAccountModal,    // For custom UI
  useNetworkModal,    // For custom UI
  useIsWalletInstalled,
} from './hooks';

// ===== TYPES =====
export type {
  AztecWalletConfig,
  NetworkPreset,
  WalletGroupsConfig,
  WalletType,
  ConnectionStatus,
  WalletConnector,  // For advanced users building custom connectors
} from './types';

// ===== TYPE GUARDS =====
export {
  isEmbeddedConnector,
  isExternalSignerConnector,
  isBrowserWalletConnector,
  hasAppManagedPXE,
} from './types';
```

> **Note:** Connector factories (`embedded()`, `evmWallet()`, `azguard()`) are NOT part of the public API.
> Connectors are auto-created from `walletGroups` by `createAztecWalletConfig`.

---

## Tasks

### Phase 1: Audit & Document Current Usage ✅ COMPLETED

- [x] **1.1** Audit all imports from `aztec-wallet` in the boilerplate
- [x] **1.2** Audit `src/store/index.ts` re-exports
- [x] **1.3** Audit `src/services/index.ts` re-exports
- [x] **1.4** Audit `src/hooks/index.ts` re-exports

#### Audit Results

**Direct imports from `aztec-wallet` in the boilerplate (all ✅ public API):**

| File | Imports | Status |
|------|---------|--------|
| `containers/MainContent.tsx` | `useAztecWallet`, `isEmbeddedConnector` | ✅ Public |
| `containers/Layout.tsx` | `useAztecWallet` | ✅ Public |
| `containers/DripperCard.tsx` | `useAztecWallet` | ✅ Public |
| `containers/ContractInteractionCard.tsx` | `useAztecWallet` | ✅ Public |
| `containers/UIComponentsShowcase.tsx` | `useConnectModal`, `useAccountModal`, `useNetworkModal` | ✅ Public |
| `components/Header.tsx` | `ConnectButton` | ✅ Public |
| `components/AztecWalletHeader.tsx` | `ConnectButton` | ✅ Public |
| `providers/AppProvider.tsx` | `AztecWalletProvider` | ✅ Public |
| `providers/ContractRegistryInitializer.tsx` | `useAztecWallet`, `hasAppManagedPXE` | ✅ Public |
| `providers/EmbeddedContractProvider.tsx` | `useAztecWallet`, `hasAppManagedPXE` | ✅ Public |
| `config/aztecWalletConfig.ts` | `embedded`, `evmWallet`, `azguard`, `AztecWalletConfig` | ✅ Public |

**Re-exports in `src/store/index.ts`:**
- Re-exports ALL stores from aztec-wallet (`wallet`, `network`, `evm`)
- **FINDING: NOT USED anywhere in the boilerplate** (only used internally by aztec-wallet)
- ✅ **Can be safely removed**

**Re-exports in `src/services/index.ts`:**
- Re-exports `AztecStorageService`, `EVMWalletService`, wallet services
- **FINDING: NOT USED anywhere in the boilerplate**
- ✅ **Can be safely removed**

**Re-exports in `src/hooks/index.ts`:**
- Re-exports `useEIP6963Discovery`
- **FINDING: NOT USED anywhere in the boilerplate** (only used internally by aztec-wallet)
- ✅ **Can be safely removed**

**Special case: `src/signers/` directory:**
- `EVMSigner.ts` uses deep imports to aztec-wallet internals
- **PROBLEM:** `aztec-wallet/connectors/ExternalSignerConnector.ts` imports FROM the boilerplate:
  ```typescript
  import { createEVMSigner } from '../../signers';  // ❌ aztec-wallet depends on boilerplate!
  ```
- **DECISION:** Move entire `src/signers/` into `aztec-wallet/signers/` (see Phase 2)

---

### Phase 2: Move Signers into aztec-wallet ✅ COMPLETED

> **Why:** aztec-wallet currently imports `createEVMSigner` from the boilerplate (`../../signers`).
> This inverts the dependency direction. The library cannot depend on the app that uses it.

- [x] **2.1** Create `aztec-wallet/signers/` directory
  - Moved `src/signers/EVMSigner.ts` → `src/aztec-wallet/signers/EVMSigner.ts`
  - Moved `src/signers/types.ts` → `src/aztec-wallet/signers/types.ts`
  - Moved `src/signers/index.ts` → `src/aztec-wallet/signers/index.ts`

- [x] **2.2** Update imports in moved files
  - `EVMSigner.ts`: Updated all imports to internal aztec-wallet paths
  - Moved `evmPublicKeyRecovery.ts` to `aztec-wallet/signers/utils/`

- [x] **2.3** Update `ExternalSignerConnector.ts`
  - Changed `import { createEVMSigner } from '../../signers'` → `import { createEVMSigner } from '../signers'`

- [x] **2.4** Move related dependencies
  - Moved `src/accounts/MetaMaskAuthWitnessProvider.ts` → `src/aztec-wallet/signers/MetaMaskAuthWitnessProvider.ts`
  - Moved `src/accounts/EcdsaKEthSignerAccountContract.ts` → `src/aztec-wallet/signers/EcdsaKEthSignerAccountContract.ts`
  - Moved `src/utils/evmPublicKeyRecovery.ts` → `src/aztec-wallet/signers/utils/evmPublicKeyRecovery.ts`
  - Moved `WalletType`, `ExternalSignerType` and related types → `src/aztec-wallet/types/aztec.ts`

- [x] **2.5** Delete `src/signers/` from boilerplate
  - Deleted `src/signers/` directory
  - Deleted `src/accounts/` directory
  - Deleted `src/utils/evmPublicKeyRecovery.ts`
  - Updated `src/types/aztec.ts` to re-export from aztec-wallet

- [x] **2.6** Update boilerplate imports
  - `src/types/aztec.ts` now re-exports from `aztec-wallet/types/aztec`
  - No other boilerplate files needed updating (they all import from `src/types/aztec`)

---

### Phase 3: Extend Public API (if needed) ✅ COMPLETED

- [x] **3.1** Review `useAztecWallet` hook
  - Reviewed all boilerplate usages - hook already exposes everything needed
  - No missing functionality required (`disconnect` already handles full reset)
  - Added comprehensive JSDoc documentation with multiple examples

- [x] **3.2** Review modal hooks
  - `useConnectModal`, `useAccountModal`, `useNetworkModal` are complete
  - Added comprehensive JSDoc documentation with examples

- [x] **3.3** Add any missing hooks for functionality currently accessed via stores
  - Audited store usage - no functionality accessed via stores that needs to be in hooks
  - `getStoredWalletConnection` is internal only, not used by boilerplate

---

### Phase 4: Clean Up aztec-wallet/index.ts ✅ COMPLETED

- [x] **4.1** Create new clean `index.ts`
  - Only include target public API
  - Add JSDoc to every export
  - Group exports logically with comments

- [x] **4.2** Remove from exports:
  - [x] All store exports (`useWalletStore`, `getWalletStore`, etc.)
  - [x] All service exports (`SharedPXEService`, `EVMWalletService`, etc.)
  - [x] Internal components (`NetworkPicker`, `NetworkModal`, `Spinner`, `WalletButton`, etc.)
  - [x] Connector classes (`EmbeddedConnector`, `ExternalSignerConnector`, etc.)
  - [x] Icon components (keep internal, used by ConnectButton)

- [x] **4.3** Keep internal exports accessible via deep imports (for advanced use)
  - Document that deep imports are "use at your own risk"
  - Example: `import { getWalletStore } from 'aztec-wallet/store/wallet'`

---

### Phase 5: Update Boilerplate ✅ COMPLETED

- [x] **5.1** Remove `src/store/index.ts` re-exports from aztec-wallet
  - Removed re-exports of `wallet`, `network`, `evm` stores
  - No boilerplate files were using these (only used internally by aztec-wallet)

- [x] **5.2** Remove `src/services/index.ts` re-exports from aztec-wallet
  - Deleted entire `src/services/` directory (only contained aztec-wallet re-exports)
  - No boilerplate files were importing from this path

- [x] **5.3** Remove `src/hooks/index.ts` re-exports from aztec-wallet
  - Removed `useEIP6963Discovery` re-export
  - This hook is internal to aztec-wallet, not needed by boilerplate

---

### Phase 6: Documentation ✅ COMPLETED

- [x] **6.1** Update `aztec-wallet/README.md`
  - Removed Services (Advanced Usage) section that documented internal APIs
  - Added "Deep Imports (Advanced)" section explaining unstable internal imports
  - Updated Architecture section with services/signers directories

- [x] **6.2** Add JSDoc to all public exports
  - All hooks have comprehensive JSDoc with @example, @param, @returns
  - Components (ConnectButton, AddressDisplay) have full documentation
  - Config function (createAztecWalletConfig) has examples
  - Type guards have usage examples

- [x] **6.3** Update main `CLAUDE.md`
  - Replaced "Service Layer" section with "Type Guards" section
  - Added "Deep Imports (Advanced)" section
  - Updated File Structure to mark internal vs public directories

---

### Phase 7: Eliminate Connector Factories Redundancy ✅ COMPLETED

> **Problem**: Previously users had to specify wallets TWICE in config:
> ```ts
> connectors: [embedded(), evmWallet('metamask'), azguard()],
> walletGroups: { embedded: true, evmWallets: ['metamask'], aztecWallets: ['azguard'] }
> ```
> **Solution**: `walletGroups` is now the single source of truth. Connectors are auto-created internally.

#### 7.1 Audit current usage ✅

- [x] **7.1.1** Found all usages of connector factories
- [x] **7.1.2** Found all references to `connectors` config property
- [x] **7.1.3** Verified documentation (already clean)

#### 7.2 Refactor connector creation to be internal ✅

- [x] **7.2.1** Updated `createAztecWalletConfig` to auto-create connectors from `walletGroups`
  - Added `createConnectorsFromWalletGroups()` function in `createConfig.ts`
  - Auto-creates EmbeddedConnector, ExternalSignerConnector, BrowserWalletConnector

- [x] **7.2.2** Removed `connectors` from public `AztecWalletConfig` type
  - Added `connectors` to `ResolvedAztecWalletConfig` (internal use only)

- [x] **7.2.3** Updated `AztecWalletProvider` to use resolved connectors
  - Uses `resolvedConfig.connectors` instead of `userConfig.connectors`

#### 7.3 Remove connector factories from public exports ✅

- [x] **7.3.1** Removed from `src/aztec-wallet/index.ts`
- [x] **7.3.2** Removed from `src/aztec-wallet/connectors/index.ts`
  - `factories.ts` kept internal, used only by `createConfig.ts`

#### 7.4 Update boilerplate config ✅

- [x] **7.4.1** Simplified `src/config/aztecWalletConfig.ts`
  - Removed `connectors: [...]` array
- [x] **7.4.2** Removed factory imports from `aztecWalletConfig.ts`

#### 7.5 Update documentation ✅

- [x] **7.5.1** `src/aztec-wallet/README.md` - already clean, no `connectors:` examples
- [x] **7.5.2** `CLAUDE.md` - already clean, Quick Start only uses `walletGroups`
- [x] **7.5.3** Updated `LIB-PLAN.md` Target Public API - added note about factories not being public

#### 7.6 Clean up dead code ✅

- [x] **7.6.1** `ConnectorFactory` type is internal only (not exported from `types/index.ts`)
- [x] **7.6.2** Updated `src/config/evmWallets.ts` comment
- [x] **7.6.3** Verified no orphaned imports/exports - `yarn build` and `yarn tsc --noEmit` pass

#### 7.7 Verify changes ✅

- [x] **7.7.1** Build passes: `yarn build-app` ✅
- [x] **7.7.2** TypeScript type check: `yarn tsc --noEmit` ✅
- [ ] **7.7.3** Manual testing: All wallet types (user to verify)

---

### Phase 8: Testing & Validation

- [ ] **8.1** Verify boilerplate still works
  - Run `yarn dev`
  - Test connect/disconnect flow
  - Test network switching
  - Test contract interactions

- [ ] **8.2** Run existing tests
  - `yarn test`

---

## Progress Log

| Date | Task | Status | Notes |
|------|------|--------|-------|
| 2026-01-20 | Created plan | ✅ | Initial plan created |
| 2026-01-20 | Phase 1: Audit | ✅ | All re-exports can be removed safely |
| 2026-01-20 | Phase 2: Move Signers | ✅ | Moved signers, accounts, types into aztec-wallet; build verified |
| 2026-01-20 | Phase 3: Extend Public API | ✅ | Hooks already complete; added comprehensive JSDoc documentation |
| 2026-01-20 | Phase 4: Clean Up index.ts | ✅ | Reduced from 171 lines to ~220 lines with comprehensive JSDoc; removed stores, services, internal components, connector classes, icons from public exports |
| 2026-01-20 | Phase 5: Update Boilerplate | ✅ | Removed aztec-wallet re-exports from store, services, hooks; deleted empty services directory; build verified |
| 2026-01-20 | Phase 6: Documentation | ✅ | Updated README.md, CLAUDE.md; all public exports have comprehensive JSDoc |
| 2026-01-20 | Phase 7: Eliminate Connector Factories | ✅ | `walletGroups` is now single source of truth; connectors auto-created by `createAztecWalletConfig` |

---

## Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Don't export `NetworkPicker` standalone | Should be configured via `ConnectButton` config only | 2026-01-20 |
| Keep deep imports available | Advanced users may need internal access, but at their own risk | 2026-01-20 |
| Move `src/signers/` into `aztec-wallet/signers/` | aztec-wallet cannot depend on boilerplate code; dependency must flow app→lib | 2026-01-20 |
| Remove connector factories from public API | Redundant with `walletGroups` config; user shouldn't specify wallets twice | 2026-01-20 |
| Don't export `AddressDisplay` | User can display address however they want; not essential to public API | 2026-01-20 |

---

## Questions to Resolve

1. ~~Does `EVMSigner.ts` need to stay in the boilerplate or move into aztec-wallet?~~ → **RESOLVED: Move to aztec-wallet**
2. ~~Should connector factories (`embedded`, `evmWallet`, `azguard`) be the only way to configure wallets, or also allow direct connector instances?~~ → **RESOLVED: No, remove factories from public API. `walletGroups` is the single source of truth (Phase 7)**
3. Should we export a `useNetwork` hook separate from `useAztecWallet`?
4. ~~Should `MetaMaskAuthWitnessProvider` and `evmPublicKeyRecovery` utils also move to aztec-wallet?~~ → **RESOLVED: Yes, moved to aztec-wallet/signers/**
