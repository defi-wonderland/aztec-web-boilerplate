# Vendorable Component Specs

One spec per vendorable file for `defi-wonderland/aztec-web-boilerplate`.

---

## What These Proposals Change

Today, the boilerplate’s wallet/PXE code imports app config (`config/networks`, `config/contracts`, etc.) and hardcodes storage keys (`aztec-pxe`, `hive_embedded_account`). That makes it impossible to reuse in other apps without patching or forking.

**Proposal:** Replace hardcoded values with **injected config**:

1. **Storage keys** — Each component gets a configurable prefix or full key so apps can use their own namespace (e.g. `hive_*`, `myapp_*`).
2. **Network resolution** — Callbacks like `getCurrentNetworkId()`, `getPxeUrl()`, `getProverEnabled()` instead of importing `config/networks`.
3. **Contract registration** — Callback `onPxeReady(pxe, aztecNode)` so apps register their own contracts instead of hardcoding Dripper/Token or neural contracts.
4. **Error messaging** — Optional `formatConnectionError()` and `formatLocalNetworkError()` so apps can customize messages (e.g. “Start with `yarn aztec:start`”).

Apps then pass their own config when creating the service/provider; no edits to the shared code are needed.

---

## Spec Index

| Spec | Target File | Summary |
|------|-------------|---------|
| [SPEC_SharedPXEService](./SPEC_SharedPXEService.md) | `SharedPXEService.ts` | Config-driven PXE lifecycle, contract registration, store management |
| [SPEC_EmbeddedWalletConnector](./SPEC_EmbeddedWalletConnector.md) | `EmbeddedConnector.ts` | Config: storageKeyPrefix, getCurrentNetworkId, getPXEInstance |
| [SPEC_useEmbeddedWallet](./SPEC_useEmbeddedWallet.md) | `useEmbeddedWallet.ts` | Config: storageKeyPrefix |
| [SPEC_useSharedPXE](./SPEC_useSharedPXE.md) | `useSharedPXE.ts` | Config: getPxeUrl, sharedPXEService, formatLocalNetworkError |
| [SPEC_WalletProvider](./SPEC_WalletProvider.md) | `WalletProvider.tsx` | Config: lastConnectorStorageKey |
| [SPEC_NetworkProvider](./SPEC_NetworkProvider.md) | `NetworkProvider.tsx` | Config: networks, storageKey, isLocalNetworkDeployed |
| [SPEC_AuthProvider](./SPEC_AuthProvider.md) | `AuthProvider.tsx` | Config: storageKey, sessionTimeout |
| [SPEC_AzguardAdapter](./SPEC_AzguardAdapter.md) | `adapters/azguard/` | Optional SDK vs raw mode |
| [SPEC_ConnectorFactories](./SPEC_ConnectorFactories.md) | `connectors/factories.ts` | Config-driven createEmbeddedConnector, createAzguardConnector |
