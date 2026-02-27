# Aztec Keychain Integration — Implementation Summary

## New Files Created (6)

| File | Purpose |
|------|---------|
| `src/aztec-wallet/store/verification.ts` | Zustand vanilla store for emoji verification coordination. Uses promise-with-resolvers pattern: `requestVerification()` pauses the adapter, `confirmVerification()`/`cancelVerification()` resolve it. |
| `src/aztec-wallet/assets/icons/KeychainIcon.tsx` | SVG icon (purple bg, key + shield) following `WalletIconProps` pattern |
| `src/aztec-wallet/adapters/demo-wallet/DemoWalletService.ts` | Wrapper around `@aztec/wallet-sdk/manager`. Handles discovery, secure channel, confirm/cancel, disconnect lifecycle |
| `src/aztec-wallet/adapters/demo-wallet/DemoWalletAdapter.ts` | `IBrowserWalletAdapter` implementation. Connect flow: discover → secure channel → `requestVerification()` (pauses) → confirm → `requestCapabilities()` → `getAccounts()`. Exposes `getConnectedWallet()` for the Wallet proxy |
| `src/aztec-wallet/adapters/demo-wallet/index.ts` | Re-exports |
| `src/aztec-wallet/components/ConnectModal/views/EmojiVerificationView.tsx` | 3x3 emoji grid using `hashToEmoji()` from `@aztec/wallet-sdk/crypto`. Confirm/Cancel buttons. Follows styles pattern |

## Files Modified (11)

| File | Change |
|------|--------|
| `src/aztec-wallet/assets/icons/index.ts` | Added `KeychainIcon` export |
| `src/aztec-wallet/adapters/index.ts` | Added `DemoWalletAdapter`, `createDemoWalletAdapter` exports |
| `src/aztec-wallet/types/index.ts` | Added `'emoji-verification'` to `ModalView` union |
| `src/types/walletConnector.ts` | Added `DemoWalletConnectorLike` interface and `isDemoWalletConnector()` type guard |
| `src/aztec-wallet/connectors/DemoWalletConnector.ts` | **New connector class** — implements `WalletConnector` with `type = BROWSER_WALLET`. Key method: `getWallet(): Wallet \| null` returns the SDK proxy |
| `src/aztec-wallet/connectors/factories.ts` | Added `aztecKeychain()` factory using `DemoWalletConnector` |
| `src/aztec-wallet/config/walletPresets.ts` | Added `'aztec-keychain'` preset with `KeychainIcon` and lazy `DemoWalletAdapter` factory |
| `src/aztec-wallet/config/createConfig.ts` | In `createConnectorsFromWalletGroups`: routes `'aztec-keychain'` to `DemoWalletConnector` instead of `BrowserWalletConnector` |
| `src/aztec-wallet/index.ts` | Exported `isDemoWalletConnector` |
| `src/aztec-wallet/components/ConnectModal/ConnectModal.tsx` | Added `'emoji-verification'` case to header and view routers |
| `src/aztec-wallet/components/ConnectModal/context.tsx` | Subscribes to verification store via `useSyncExternalStore`. Auto-navigates to `'emoji-verification'` when hash appears. Cancels pending verification on modal close |
| `src/hooks/contracts/useWriteContract.ts` | Added `isDemoWalletConnector` check **before** `isBrowserWalletConnector`. Uses `connector.getWallet()` → `Contract.at()` → `send().wait()` |
| `src/hooks/contracts/useReadContract.ts` | Added `isDemoWalletConnector` check in `resolveWallet()`. Returns `{ type: 'app_managed', wallet }` so it uses the standard read path |
| `src/config/aztecWalletConfig.ts` | Added `'aztec-keychain'` to `aztecWallets` array |

## Architecture Decisions

- **Dedicated connector class** (`DemoWalletConnector`) instead of reusing `BrowserWalletConnector` because the demo-wallet returns a full `Wallet` proxy — `executeOperations`/`sendTransaction` don't apply.
- **Hooks detect the connector** via `isDemoWalletConnector()` and use `getWallet()` directly, bypassing the browser wallet operations path.
- **Verification store** uses a module-scoped `pendingResolve` variable (not in Zustand state) to hold the Promise resolver — clean separation between UI state and async coordination.
- **`ChainInfo.version`** hardcoded to `Fr(1)` — needs real `rollupVersion` per network for production.

## Key Fix: requestCapabilities()

The wallet proxy won't respond to `getAccounts()` until the app declares its capabilities via `requestCapabilities()`. The adapter now sends an `AppCapabilities` manifest (version "1.0") requesting: accounts access, contract registration, simulation, and transaction capabilities. This is the same pattern used by GregoSwap.

## Still Needed

1. **Build verification** — run `yarn build-app` and `yarn lint` to catch any TS errors.
2. **Real `rollupVersion`** per network in `ChainInfo` construction (hardcoded to 1 currently).
3. **Manual testing** with the actual demo-wallet Electron app + extension installed.
