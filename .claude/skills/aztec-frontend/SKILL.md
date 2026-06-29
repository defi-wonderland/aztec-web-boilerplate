---
name: aztec-frontend
description: >-
  Build and modify frontend features in this Aztec web boilerplate (React 19 +
  Vite + Tailwind v4 + Zustand + react-query, with @aztec/aztec.js,
  @aztec/wallet-sdk and @aztec/wallets pinned at 5.0.0-rc.1). Use this skill WHENEVER
  you touch anything under `src/` — UI components, hooks, state, providers — and
  ESPECIALLY when reading, writing, registering, or deploying an Aztec smart
  contract from the frontend, generating or wiring up contract artifacts, adding
  a network, or adding a wallet connector. It encodes this project's exact
  conventions (styles-const Tailwind, `&&` rendering, the wallet-connector
  abstraction, react-query data hooks) and the VERSION-CORRECT @aztec 5.0.0-rc.1
  contract APIs, which differ from older tutorials in ways that silently break.
  Trigger even when the user doesn't name the skill — e.g. "add a counter to the
  page", "let users increment a value on-chain", "show a token balance",
  "call my contract from the UI", "support another wallet", "connect to a local
  node", "deploy my contract from the app".
---

# Building Aztec frontends in this boilerplate

This project is a deliberately small Aztec frontend boilerplate. The hard parts —
talking to an Aztec node, abstracting over embedded vs external wallets, holding a
single wallet-agnostic `Wallet` in state — are already solved. Your job is almost
always to **add a feature on top of that foundation without breaking its grain.**

Two things make code feel native here:

1. **Match the conventions.** They aren't arbitrary — each one keeps the code
   readable and diff-friendly. They're summarized below; see
   [references/conventions.md](references/conventions.md) for the full set with examples.
2. **Use the v5-correct Aztec APIs.** The `@aztec/*` packages move fast and most
   tutorials online are for older versions. Several APIs changed in ways that
   *look* fine but fail at runtime or won't type-check. The contract cheat-sheet
   below and [references/contracts.md](references/contracts.md) give you the verified shapes.

## How the project is laid out

```
src/
  config/app.ts          # NETWORKS list, APP_ID, node URL, timeouts — app config
  services/node.ts       # createNode(url) -> AztecNode, getChainInfo(node)
  lib/connectors/        # the wallet abstraction: embedded.ts, external.ts, index.ts, types.ts
  state/walletStore.ts   # Zustand store: node, wallet, address, status, connect/disconnect/setNetwork
  hooks/                 # useWallet (store facade), useBlockNumber (react-query read), useToast...
  providers/             # AppProviders (react-query, Tooltip, Toast) — add global providers here
  components/            # UI: Navbar, BlockPanel, WalletModal, NetworkSwitcher, VerifyDialog...
  contracts/            # ← contract interaction lives here (see "Contract operations")
    artifacts/          # ← `aztec codegen` output goes here
```

New contract code goes in `src/contracts/`, its read/write hooks in `src/hooks/`,
and any UI in `src/components/`. Don't invent new top-level folders.

## The mental model

- A **node client** (`AztecNode`) is created from a URL and lives in the store. It
  works *without a wallet* — that's how `BlockPanel` reads the block height.
- A **connector** (`WalletConnector`) turns a user's choice (embedded / external)
  into a single wallet-agnostic **`Wallet`**. Both connectors produce the *same*
  `Wallet` type, so everything downstream is wallet-agnostic. This is the core
  abstraction — preserve it.
- The **store** (`walletStore`, read via `useWallet()`) owns `node`, `wallet`,
  `address` (the connected `AztecAddress`), `networkId`, and `status`. Components
  read from it; they never create nodes or wallets themselves.
- **Reads** go through react-query hooks (`useQuery`); **writes** through
  `useMutation`. Look at `src/hooks/useBlockNumber.ts` — it's the template.

So any contract feature is: get `wallet` + `address` from the store → build a
contract instance → read with `simulate` (in a `useQuery`) or write with `send`
(in a `useMutation`) → render with the conventions below.

## Core conventions (apply to everything you write)

These are the load-bearing ones. Full list + rationale in [references/conventions.md](references/conventions.md).

- **Tailwind via a `styles` const.** Every component defines
  `const styles = { ... } as const` **at the bottom of the file, after the
  component**, mapping semantic names to class strings, then uses
  `className={styles.x}`. Don't scatter long class strings through JSX.
  Compose conditionally with template strings:
  `` className={`${styles.option} ${isActive ? styles.optionActive : ''}`} ``.
- **Use theme tokens, not raw hex.** The palette is defined in `src/index.css`
  (`@theme`): `bg-base/surface/elevated/field`, `text-ink/ink-soft/ink-dim`,
  `border-line/violet-line`, `text-violet-300/400/500`, `text-success`. Reach for
  an arbitrary value (`bg-[#1b1430]`) only for a genuine one-off shade.
- **Conditional rendering with `&&`, never `cond ? <X/> : null`.** Guard each
  branch: `{node && !isError && <Live/>}`, `{meta.recommended && <Badge/>}`.
  `BlockPanel` stacks several `&&` guards instead of a nested ternary — follow that.
- **`import type` for type-only imports** — `verbatimModuleSyntax` is on, so a
  value import of a type breaks the build. Import Aztec symbols from their
  **subpath** (`@aztec/aztec.js/contracts`, `/fields`, `/addresses`, …), not the
  package root.
- **Reads = `useQuery`, writes = `useMutation`.** Key reads on `networkId` (and
  any inputs) so switching network refetches; gate with `enabled`. Never fetch in
  `useEffect`+`useState`, and never copy chain data into local state.
- **State comes from the store.** Use `useWallet()` for the common fields, or
  `useWalletStore(s => s.x)` selectors (wrap multi-field selects in `useShallow`).
- **Named exports** for components/hooks/lib; a short **file-header comment**
  explaining the file's role and any non-obvious decision (read the existing files
  — they all have one).

## Contract operations (the v5-correct cheat-sheet)

⚠️ **These shapes are verified against @aztec 5.0.0-rc.1 (the version this project
targets). Many online examples — and the 4.x tutorials — are wrong for v5.** The full, copy-ready code — read hook,
write hook, register/deploy helpers, fee setup, the external-wallet caveat — is in
[references/contracts.md](references/contracts.md), and working templates you can adapt live in
[assets/templates/](assets/templates/) (`counter.ts`, `useCounter.ts`, `CounterPanel.tsx`).

Assume you already have `wallet` and `address` (the sender, an `AztecAddress`)
from the store, and a typed contract class from codegen (e.g. `CounterContract`)
or a `ContractArtifact`.

| Operation | v5 (5.0.0-rc.1) shape |
|---|---|
| **Instance** | `const c = CounterContract.at(addr, wallet)` (typed, **synchronous**, 2 args) or `Contract.at(addr, artifact, wallet)` (generic, **synchronous**, 3 args). **Do not `await`.** |
| **Read** | `const { result } = await c.methods.get_counter().simulate({ from })` — in v5 `simulate` resolves to a **`{ result, offchainEffects, offchainMessages }` wrapper**; the decoded value is at **`.result`** (it is NOT returned bare). `includeMetadata: true` only *adds* `stats` + `gasUsed`. `from` is **required**. There is no `.view()`/`.read()`/`.call()`. |
| **Write** | `const { receipt } = await c.methods.increment().send({ from, fee })` — `.send()` **waits by default and resolves to a `{ receipt, offchainEffects, offchainMessages }` wrapper** — read **`.receipt`** (it is NOT returned bare); there is no SentTx/`.wait()` two-step. `from` is required; `fee` is **optional** (omit it to let the wallet pay — see Fee). ⚠️ The default waits until `TxStatus.CHECKPOINTED`, which lags far behind inclusion on testnet — public state is applied (balances readable, `hasExecutionSucceeded()` valid) at the earlier `PROPOSED`. For snappy UIs pass `.send({ from, fee, wait: { waitForStatus: TxStatus.PROPOSED } })` (import `TxStatus` from `@aztec/aztec.js/tx`), or the button stays "pending" long after the effect shows. |
| **Register** | `await wallet.registerContract(instance, artifact)` — **positional args, not `{ instance, artifact }`**. For an **already-deployed** contract, get the instance salt-free from the node: `const instance = await node.getContract(addr)`. Otherwise rebuild it with `getContractInstanceFromInstantiationParams(artifact, { salt, constructorArgs })`. |
| **Deploy** | `const { contract } = await CounterContract.deploy(wallet, owner, { salt }).send({ from, fee })` — typed `.deploy()` takes the **constructor args plus an optional `instantiation` object** (`{ salt, deployer, universalDeploy, publicKeys }`); `.send()` waits and resolves to a **`{ contract, instance, receipt, offchainEffects, offchainMessages }` wrapper** — read **`.contract`**. There is **no `.deployed()`**; the salt goes in the **`deploy()` instantiation arg as `salt`** (there is **no `contractAddressSalt`** and **no `wait: { returnReceipt }` / `DeployTxReceipt`** — the receipt is already on the result as `.receipt`). A **freshly-created embedded account is NOT deployed on-chain** — deploy it (sponsored) before its first write; see [references/contracts.md §4a](references/contracts.md). |
| **Fee** | A per-network **strategy, not a guarantee.** Default: **omit `fee`** and let the connected wallet/account pay (right for **external wallets**, which pay their own fees, and funded accounts). The **embedded** wallet's fresh account is unfunded → use a sponsored FPC: derive it (`getContractInstanceFromInstantiationParams(SponsoredFPCContractArtifact, { salt: new Fr(SPONSORED_FPC_SALT) })`, salt `0`), **register it with its artifact** (`wallet.registerContract(fpc, SponsoredFPCContractArtifact)` — needs `@aztec/noir-contracts.js`), then `new SponsoredFeePaymentMethod(fpc.address)`. See [references/contracts.md §4](references/contracts.md). |

**The mistakes to never make in v5** (most are real, silent breaks — they compile
but yield `undefined` at runtime):

1. Importing from `@aztec/aztec.js/contract` (singular). It's **`/contracts`** (plural).
2. `await`ing `Contract.at(...)` and expecting magic — it's synchronous; harmless but a tell you're on an old mental model. The real bug is forgetting it returns the instance directly.
3. **NOT reading `.result` from `simulate()`.** In v5 `simulate({ from })` resolves to a **`{ result, offchainEffects, offchainMessages }` wrapper**, never the bare value — `const result = await …simulate(...)` hands you the wrapper object (so `result as bigint` is a lie that renders `[object Object]`). Use `const { result } = await …simulate({ from })`. `includeMetadata: true` only *adds* `stats` + `gasUsed`; it is not what turns on the wrapper.
4. **NOT reading `.receipt` from `send()`, or writing `.send().wait()`.** `.send({ from, fee })` waits and resolves to a **`{ receipt, offchainEffects, offchainMessages }` wrapper** — read `.receipt` (there is no SentTx and `.wait()` doesn't exist). Use `const { receipt } = await …send({ from, fee })`, then `receipt.hasExecutionSucceeded()`.
5. **NOT reading `.contract` from `deploy().send()`.** It resolves to a **`{ contract, instance, receipt, … }` wrapper**, not the bare instance (there is no `.deployed()`). Use `const { contract } = await CounterContract.deploy(wallet, …args, { salt }).send({ from, fee })`. The salt goes in the **`deploy()` instantiation arg as `salt`**, NOT in `.send()` as `contractAddressSalt`; there is no `wait: { returnReceipt }` and no `DeployTxReceipt` type.
6. Calling `.send()` without `from` (required), **or** assuming `SponsoredFeePaymentMethod` always works. Sponsored fees need an FPC that is deployed + funded **and registered in the PXE with its artifact** (`registerContract(fpc, SponsoredFPCContractArtifact)`) — the address alone is not enough on the embedded wallet (see §4).
7. **Sending from a freshly-created embedded account without deploying it first.** `createSchnorrAccount(...)` only registers it locally; the first tx needs the account contract deployed on-chain (sponsored). Deploy it with **`from: NO_FROM`** (import `NO_FROM` from `@aztec/aztec.js/account` — it is the self-paid-deploy sentinel and is **still present** in v5; `AztecAddress.ZERO` is not the API). Check it isn't already deployed via `getContractMetadata`'s **`initializationStatus === ContractInitializationStatus.INITIALIZED`** (the enum is **still present**, imported from `@aztec/aztec.js/wallet`; there is **no `isContractInitialized` boolean**) — see [references/contracts.md §4a](references/contracts.md).
8. Letting `.send()` block on the default `CHECKPOINTED` status in a UI — pass `wait: { waitForStatus: TxStatus.PROPOSED }` so it resolves once state is applied (see the Write row).

### The artifact workflow (codegen)

Contract interaction needs an **artifact**. Compile the Noir contract, then generate
a typed TS class:

```sh
aztec codegen target -o src/contracts/artifacts    # target/ holds the compiled JSON
```

This emits `src/contracts/artifacts/<Name>.ts` exporting `class <Name>Contract`
(e.g. `CounterContract`) and `<Name>ContractArtifact`. Method names match the Noir
function names exactly (`get_counter`, `increment`). If you only have the raw JSON,
`loadContractArtifact(json)` from `@aztec/aztec.js/abi` gives you the artifact for
the generic `Contract.at(addr, artifact, wallet)` path. Details + Vite caveats in
[references/contracts.md](references/contracts.md).

### Reading AND writing contracts via an external wallet needs extra capabilities

The embedded wallet can read + send out of the box. The **external** (wallet-sdk)
connector currently requests only the `accounts` capability — enough to *read
accounts*, but **not enough to even read a contract's state**, let alone send.
Reading via `.simulate()` maps to the wallet's `simulateTx`/`executeUtility`
(needs the **`simulation`** capability) and requires the contract to be registered
(**`contracts`**); sending needs **`transaction`**. So both reads and writes through
an external wallet require broadening the manifest beyond `accounts`. The capability
fields accept a `'*'` wildcard, so a connector can request broadly without knowing
contract addresses up front. And note: `requestCapabilities` **throws on the
embedded wallet** — only call it on the external connector. Full explanation and
the corrected manifest are in [references/contracts.md](references/contracts.md) (external-wallet section).

## Adding a network

Networks are just entries in the `NETWORKS` array in `src/config/app.ts`:

```ts
export const NETWORKS: NetworkConfig[] = [
  { id: "testnet", label: "Testnet", nodeUrl: NODE_URL },
  { id: "localhost", label: "Localhost", nodeUrl: "http://localhost:8080" },
  // add yours here:
  { id: "my-net", label: "My Net", nodeUrl: "https://rpc.my-net.example" },
];
```

That's the whole change. `NetworkSwitcher` maps over `NETWORKS`, `getNetwork(id)`
looks it up, and the store reads/writes the active `networkId` (persisted to
localStorage). Switching a network recreates the node client and disconnects the
wallet on purpose — `chainInfo` differs per network, so a session can't carry over.
If your contract code needs a per-network fee payer (sponsored FPC) address, add an
optional field to `NetworkConfig` and read it where you build the payment method —
see [references/contracts.md](references/contracts.md).

## Adding a wallet connector

The connector abstraction means a new wallet is a *self-contained* file plus a
registration — the store and UI need no changes. Steps:

1. **Add the kind** to the `ConnectorKind` union in `src/lib/connectors/types.ts`.
2. **Implement `WalletConnector`** in `src/lib/connectors/<name>.ts`: `kind`,
   `label`, `connect(opts) -> { wallet, accounts }`, `disconnect()`. Both existing
   connectors are worked examples — `embedded.ts` (in-browser `EmbeddedWallet`) and
   `external.ts` (wallet-sdk `WalletManager`, the model for any extension wallet).
3. **Register it** in the `connectors` array in `src/lib/connectors/index.ts`.
4. **Add presentation** (icon + subtitle) to the `META` record in
   `src/components/WalletModal.tsx`.

For a new wallet-sdk-based wallet, model it on `external.ts`: discovery →
`establishSecureChannel` → surface the emoji grid via `onEmojiGrid` (display-only) →
`confirm()` → `requestCapabilities(manifest)`. **Return *all* granted accounts** —
the store moves to a `selecting` state when there's more than one. If users will
*write* through this wallet, give the manifest the `transaction`/`simulation`/
`contracts` capabilities (see [references/contracts.md](references/contracts.md)), not just `accounts`.
Full walkthrough with the manifest shape: [references/wallets-and-networks.md](references/wallets-and-networks.md).

## Before you finish

This project uses **yarn** (never npm). Verify your changes:

```sh
yarn lint        # eslint — catches unused vars, hook rules, etc.
yarn build       # tsc -b && vite build — catches type errors (verbatimModuleSyntax is strict)
```

A change that adds an Aztec API call should at least type-check. If you can't run
the contract end-to-end (it needs a deployed contract + funded fee payer), say so
plainly rather than claiming it works.
