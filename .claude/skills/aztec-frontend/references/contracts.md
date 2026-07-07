# Reading, writing, registering & deploying contracts (@aztec 5.0.0-rc.1)

> Every API shape here was verified against @aztec **5.0.0-rc.1** (the version this
> project targets). The v5 APIs differ from 4.x tutorials in ways that compile-but-
> fail or won't type-check at all. When something you remember disagrees with this
> file, trust this file (or check `node_modules/@aztec/aztec.js/dest/**/*.d.ts`).

The running example is a **Counter** contract with this Noir interface:

```
constructor(owner: AztecAddress)   // public initializer
get_owner()  -> AztecAddress       // public read
get_counter() -> u128              // public #[view] read  → decodes to bigint
increment()                        // private write (enqueues a public increment)
```

After codegen its TS class is `CounterContract` with `CounterContractArtifact`,
and method names match the Noir names exactly: `counter.methods.get_counter()`,
`counter.methods.increment()`.

## Contents

1. [Get an artifact (codegen workflow)](#1-get-an-artifact-codegen-workflow)
2. [Reading state](#2-reading-state)
3. [Writing state (sending a tx)](#3-writing-state-sending-a-tx)
4. [Fee payment (required on testnet)](#4-fee-payment-required-on-testnet)
5. [Registering a contract (and senders)](#5-registering-a-contract-and-senders)
6. [Deploying](#6-deploying)
7. [Writing through an external wallet (capabilities)](#7-writing-through-an-external-wallet-capabilities)
8. [Where the files go](#8-where-the-files-go)

The ready-to-adapt files for all of this live in
[../assets/templates/](../assets/templates/): `counter.ts` (interaction module),
`useCounter.ts` (read + write hooks), `CounterPanel.tsx` (UI).

---

## 1. Get an artifact (codegen workflow)

To talk to a contract you need its **artifact** (the ABI + bytecode). The typed
path is to run codegen and import the generated class.

```sh
# 1) Compile the Aztec.nr contract -> target/<package>-<Contract>.json
aztec compile

# 2) Generate a typed TS wrapper into this project's contracts/artifacts dir.
#    The arg can be the target/ directory (recursively picks up every non-debug
#    *.json) or a single JSON file.
aztec codegen target -o src/contracts/artifacts
```

This emits `src/contracts/artifacts/Counter.ts` exporting:

- `class CounterContract extends ContractBase` — with typed `.at()`, static
  `.deploy()`, and a typed `methods` map.
- `const CounterContractArtifact` — the runtime `ContractArtifact` value.

```ts
// src/contracts/artifacts/Counter.ts (generated — do not edit)
export class CounterContract extends ContractBase {
  static at(address: AztecAddress, wallet: Wallet): CounterContract { … }   // 2 args, synchronous
  static deploy(wallet: Wallet, owner: AztecAddressLike, instantiation?: DeployInstantiationOptions): DeployMethod<CounterContract> { … }   // ctor args + optional { salt, deployer, … }
  static get artifact(): ContractArtifact { … }
  methods: { get_counter(): ContractFunctionInteraction; increment(): …; get_owner(): …; };
}
export const CounterContractArtifact: ContractArtifact;
```

**Add the scripts to `package.json`** (yarn, never npm):

```jsonc
"scripts": {
  "codegen": "aztec codegen target -o src/contracts/artifacts",
  "compile:contract": "aztec compile && yarn codegen"
}
```

### No-codegen alternative

If you only have the compiled JSON, load it into a `ContractArtifact` at runtime
and use the **generic** `Contract` class:

```ts
import { loadContractArtifact, type NoirCompiledContract } from '@aztec/aztec.js/abi';
import { Contract } from '@aztec/aztec.js/contracts';
import counterJson from './artifacts/counter_contract-Counter.json';

const CounterArtifact = loadContractArtifact(counterJson as unknown as NoirCompiledContract);
const counter = Contract.at(address, CounterArtifact, wallet); // generic: 3 args, synchronous
```

### Vite / bundler notes

- Artifact JSON is large (base64 ACIR + debug symbols). Importing it as an ES
  module bloats the bundle and slows HMR. Keep artifacts under
  `src/contracts/artifacts/` and, if size matters, fetch the JSON at runtime
  (`fetch(url).then(r => r.json())` then `loadContractArtifact`).
- The generated file imports its JSON with `import … with { type: 'json' }`. Vite
  handles JSON imports, but if you hit a parser error on the import attribute,
  fall back to the no-codegen path above.
- `loadContractArtifact` is at `@aztec/aztec.js/abi` — not the package root.
- **ABI introspection gotcha:** `loadContractArtifact` puts public functions (except
  `public_dispatch`) in `artifact.nonDispatchPublicFunctions`, **not**
  `artifact.functions` — so iterating `functions` to find a public fn (e.g. a public
  initializer like `constructor_with_minter`, or `mint_to_public`) misses it.
  `getInitializer` / `getAllFunctionAbis` search both arrays, but
  `getFunctionArtifactByName` / `getFunctionArtifact` search only `functions`. The
  typed `Contract.deployWithOpts({ method })` resolves public initializers correctly
  (it goes through `getInitializer`), so prefer it over hand-rolling a lookup.

---

## 2. Reading state

Reads use **`.simulate({ from })`**. The biggest v5 gotcha (and a change from 4.x):
`simulate({ from })` resolves to a **`{ result, offchainEffects, offchainMessages }`
wrapper** — the decoded return value is at **`.result`**, never returned bare. So you
**must** read `.result`: `const { result } = await …simulate({ from })`. Passing
`includeMetadata: true` only *adds* `stats` and `gasUsed` to that object (the wrapper is
always there, with or without it). There is no `.view()`, `.read()`, or `.call()`. The
same `.simulate()` reads private, public, and utility functions.

```ts
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { CounterContract } from '../contracts/artifacts/Counter';

// `wallet` and `from` (the connected account's AztecAddress) come from the store.
export async function readCounter(
  wallet: Wallet,
  address: AztecAddress,
  from: AztecAddress,
): Promise<bigint> {
  const counter = CounterContract.at(address, wallet); // synchronous — no await
  const { result } = await counter.methods.get_counter().simulate({ from }); // v5: { result, offchainEffects, offchainMessages } wrapper
  return result as bigint; // a u128 return decodes to a JS bigint
}
```

- `from` is **required** by `simulate(options)`. For a public read the value is
  disregarded, but you still pass it — use the connected account's `AztecAddress`.
- Return decoding: integers → `bigint`; `Field` → `Fr` (use `.toString()` /
  `.toBigInt()`); addresses → `AztecAddress` (use `.toString()` for hex). `bigint`
  breaks `JSON.stringify` unless you pass a replacer.
- Reads need **no fee** and do no proving — don't copy `send()` fee options here.

### As a react-query hook (mirrors `useBlockNumber`)

```ts
// src/hooks/useCounter.ts (read part)
import { useQuery } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { CounterContract } from '../contracts/artifacts/Counter';
import { useWalletStore } from '../state/walletStore';

export function useCounterValue(contractAddress: string) {
  const wallet = useWalletStore((s) => s.wallet);
  const from = useWalletStore((s) => s.address);     // connected account, AztecAddress | null
  const networkId = useWalletStore((s) => s.networkId);

  return useQuery({
    queryKey: ['counter', networkId, contractAddress], // refetch on network/contract change
    queryFn: async (): Promise<bigint> => {
      if (!wallet || !from) throw new Error('Wallet not connected');
      const counter = CounterContract.at(AztecAddress.fromString(contractAddress), wallet);
      const { result } = await counter.methods.get_counter().simulate({ from });
      return result as bigint;
    },
    enabled: !!wallet && !!from,
  });
}
```

Render the `bigint` with `.toString()`; never pass it to something expecting a
`number` without converting (`Fr.toNumber()` throws above `Number.MAX_SAFE_INTEGER`).

---

## 3. Writing state (sending a tx)

Writes use **`.send({ from, fee })`**. In v5 `.send()` **waits for mining by
default and resolves to a `{ receipt, offchainEffects, offchainMessages }` wrapper** —
the `TxReceipt` is at **`.receipt`**, not returned bare. There is **no `.send().wait()`
two-step** on the high-level interaction (no SentTx). `from` is required; **`fee` is
optional** — omit it to let the connected wallet pay (the default — see §4), or pass
`fee: { paymentMethod }` for a specific strategy.

```ts
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { FeePaymentMethod } from '@aztec/aztec.js/fee';
import { CounterContract } from '../contracts/artifacts/Counter';

export async function increment(
  wallet: Wallet,
  address: AztecAddress,
  from: AztecAddress,
  paymentMethod?: FeePaymentMethod, // OPTIONAL — omit to let the wallet/account pay (§4)
) {
  const counter = CounterContract.at(address, wallet);
  const fee = paymentMethod ? { paymentMethod } : undefined;
  const { receipt } = await counter.methods
    .increment()
    .send({ from, fee }); // v5: waits and resolves to { receipt, offchainEffects, offchainMessages } — read .receipt; no .wait()

  // .send() THROWS on revert by default. If you set wait.dontThrowOnRevert, guard:
  if (!receipt.hasExecutionSucceeded()) {
    throw new Error(receipt.error ?? 'transaction reverted');
  }
  return receipt; // TxReceipt: txHash, status, blockNumber, transactionFee, …
}
```

- To **not** wait, pass `wait: NO_WAIT` (import from `@aztec/aztec.js/contracts`):
  `const { txHash } = await …send({ from, fee, wait: NO_WAIT })` resolves immediately to a
  `{ txHash, offchainEffects, offchainMessages }` wrapper (read `.txHash`). Then poll with
  `waitForTx(node, txHash)` from `@aztec/aztec.js/node`.
- **Preview** a write without sending: `const { result } = await counter.methods.increment().simulate({ from })`
  returns the `{ result, … }` wrapper (read `.result`), same as a read.
- **Embedded wallet:** client-side proving happens inside `.send()` automatically
  (the in-browser PXE proves; `proverEnabled: true` is already set in
  `embedded.ts`). It's CPU-heavy — surface a pending state in the UI.
- **`.send()` blocks until `CHECKPOINTED` by default**, which on testnet lags well
  behind inclusion — a UI awaiting it stays "pending" long after the effect shows.
  Public state is applied (balances readable, `hasExecutionSucceeded()` valid) at the
  earlier `PROPOSED`. For responsive UIs pass
  `.send({ from, fee, wait: { waitForStatus: TxStatus.PROPOSED } })` (`TxStatus` from
  `@aztec/aztec.js/tx`); status order is `pending → proposed → checkpointed → proven →
  finalized`. Trade-off: a `PROPOSED` tx can in principle be re-orged before checkpoint.
- **Check ABI integer widths before scaling an amount.** A function arg may be `u64`
  while a balance is `u128` — multiplying a whole-token amount by `10**decimals` can
  overflow the narrower `u64` arg even though balances are wider. Read the artifact's
  `{ kind: 'integer', sign, width }`; don't assume amount and balance share a type.
- `TxReceipt.status` is a *finalization* stage (`pending`/`proven`/`finalized`/…);
  execution success is separate — use `receipt.hasExecutionSucceeded()` /
  `hasExecutionReverted()`, not a status comparison.

### As a react-query mutation

```ts
// src/hooks/useCounter.ts (write part)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { TxReceipt } from '@aztec/aztec.js/tx';
import { CounterContract } from '../contracts/artifacts/Counter';
import { useWalletStore } from '../state/walletStore';
import { resolveFeePaymentMethod, explainFeeError } from '../contracts/fees'; // see §4

export function useIncrement(contractAddress: string) {
  const wallet = useWalletStore((s) => s.wallet);
  const from = useWalletStore((s) => s.address);
  const connector = useWalletStore((s) => s.connector);
  const networkId = useWalletStore((s) => s.networkId);
  const qc = useQueryClient();

  return useMutation<TxReceipt, Error>({
    mutationFn: async () => {
      if (!wallet || !from) throw new Error('Wallet not connected');
      // undefined for external wallets (they pay); a sponsored FPC if configured.
      const paymentMethod = resolveFeePaymentMethod(connector, networkId);
      const fee = paymentMethod ? { paymentMethod } : undefined;
      try {
        const counter = CounterContract.at(AztecAddress.fromString(contractAddress), wallet);
        const { receipt } = await counter.methods.increment().send({ from, fee });
        if (!receipt.hasExecutionSucceeded()) throw new Error(receipt.error ?? 'reverted');
        return receipt;
      } catch (err) {
        throw explainFeeError(err, networkId); // actionable message when fees can't be paid
      }
    },
    // Refetch the read after a successful write.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['counter', networkId, contractAddress] }),
  });
}
```

---

## 4. Fee payment (a strategy, not a guarantee)

Every write costs a fee, paid in **fee juice** (Aztec's native fee asset). Who pays,
and how, depends on the network and the wallet — so **don't hardcode one method as
if it always works.** `fee` on `.send({ from, fee })` is *optional*, and the right
default is usually to **omit it and let the connected wallet decide.**

### What "omit the fee" does

When you call `.send({ from })` with no `fee.paymentMethod`, the SDK defaults to
**the account paying from its own fee juice** (`PREEXISTING_FEE_JUICE`). So:

- **External wallets (Azguard/Obsidion)** manage fees themselves and prompt the
  user — you should **never inject a payment method** for them, or you fight the
  wallet's own fee flow. Just omit `fee`.
- **The embedded wallet's account** pays from its own fee juice — which works only
  once that account is *funded*. A freshly-created embedded account has none, so the
  tx fails with *"Insufficient fee payer balance"* until you fund it (faucet / L1
  bridge) or supply a sponsored FPC (below).

### The four payment methods in v5

`@aztec/aztec.js/fee` exports exactly these (there is **no** plain
`FeeJuicePaymentMethod` — paying from your own balance is the "omit it" case above):

| Method | What it does | When it works |
|---|---|---|
| *(omit `fee.paymentMethod`)* | Account pays from its own fee juice | Account is funded, or the wallet pays. **The default.** |
| `SponsoredFeePaymentMethod(fpc)` | An FPC contract pays | Only if that FPC is **deployed + funded + registered** on the network. A testing/dev convenience. |
| `FeeJuicePaymentMethodWithClaim(sender, claim)` | Claim bridged fee juice **and** pay, in one tx | After you bridge fee juice from L1 (needs an L1 client) — bootstrapping an unfunded account. |
| `PrivateFeePaymentMethod` / `PublicFeePaymentMethod` | Pay fees in a token via an FPC | **Deprecated** — not supported on mainnet. Avoid for new code. |

### Sponsored FPC — useful, but not universal

`new SponsoredFeePaymentMethod(addr)` just points the tx at a fee-paying contract;
the constructor **doesn't deploy, fund, or verify anything.** For it to actually pay:

1. an FPC must be **deployed** on the target network at `addr`,
2. that FPC must currently **hold enough fee juice** (its balance is shared and can
   be drained),
3. for the **embedded** wallet, the FPC must be **registered in the PXE** first
   (`wallet.registerContract(instance, SponsoredFPCContractArtifact)`).

It's pre-deployed and prefunded on the **local sandbox**, and a canonical one is
deployed + funded on public **testnet** (verified for v5). On **devnet/mainnet**,
don't assume one exists.

**Don't hardcode the address — derive it.** The canonical FPC is a universal deploy
at a fixed salt (`SPONSORED_FPC_SALT`, which is `0`), so its address is deterministic
*for a given Aztec version* — and it **changes when the contract class changes**, so
an old hardcoded hex (older docs listed `0x254082…`) will silently point at nothing.
Derive it locally:

```ts
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants'; // === 0n
import { Fr } from '@aztec/aztec.js/fields';

const fpc = await getContractInstanceFromInstantiationParams(
  SponsoredFPCContractArtifact,
  { salt: new Fr(SPONSORED_FPC_SALT) },
);
```

Step 3 (registration) needs the **SponsoredFPC artifact from
`@aztec/noir-contracts.js`**, so that package must be a dependency. (The faucet
example adds it; importing the `/SponsoredFPC` subpath tree-shakes to one small
artifact, so it doesn't bloat the bundle.) `registerContract(fpc)` **without** the
artifact throws for a contract the PXE has never seen — so configuring just an
address per network is **not** sufficient on the embedded wallet; you must register
the instance *with* its artifact.

### Recommended pattern for this boilerplate

Make the fee method a **per-network, per-wallet strategy** that defaults to "let the
wallet pay," and surface fee failures clearly. Add an optional `sponsoredFpc` to the
network config, and resolve the method from the active connector:

```ts
// src/config/app.ts
export interface NetworkConfig {
  id: string;
  label: string;
  nodeUrl: string;
  sponsoredFpc?: string; // OPTIONAL: a deployed+funded sponsored FPC for this network
}
```

```ts
// src/contracts/fees.ts
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { FeePaymentMethod } from '@aztec/aztec.js/fee';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { getNetwork } from '../config/app';
import type { ConnectorKind } from '../lib/connectors/types';

/** Resolve a FeePaymentMethod for the active wallet + network, or `undefined` to
 *  let the connected wallet pay (the robust default). */
export function resolveFeePaymentMethod(
  connectorKind: ConnectorKind | null,
  networkId: string,
): FeePaymentMethod | undefined {
  if (connectorKind === 'external') return undefined; // external wallets pay; never override
  const fpc = getNetwork(networkId).sponsoredFpc;
  if (!fpc) return undefined;                          // let the account's own fee juice pay
  return new SponsoredFeePaymentMethod(AztecAddress.fromString(fpc));
}
```

**Resolving the method is not enough on the embedded wallet** — its PXE must also
*know* the FPC (instance + artifact) to prove the fee call. Register it once before
sending (idempotent):

```ts
// src/contracts/fees.ts (continued)
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { Fr } from '@aztec/aztec.js/fields';
import type { Wallet } from '@aztec/aztec.js/wallet';

export async function ensureSponsoredFpcRegistered(wallet: Wallet): Promise<void> {
  const fpc = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContractArtifact, { salt: new Fr(SPONSORED_FPC_SALT) },
  );
  const { instance } = await wallet.getContractMetadata(fpc.address);
  if (!instance) await wallet.registerContract(fpc, SponsoredFPCContractArtifact);
}
```

So the **embedded** write path is: `ensureSponsoredFpcRegistered(wallet)` →
`resolveFeePaymentMethod(...)` → deploy the account if needed (§4a) →
`.send({ from, fee })`. **External** wallets skip all of it — they pay their own fees
and their account is already deployed, so `resolveFeePaymentMethod` returns
`undefined` for them and you neither register an FPC nor deploy an account.

Then wrap the send so an unpayable-fee error becomes actionable instead of a cryptic
proving/simulation failure (v5 has no typed fee error, so match broadly):

```ts
export function explainFeeError(err: unknown, networkId: string): Error {
  const m = String((err as Error)?.message ?? err).toLowerCase();
  if (/fee|gas|balance|insufficient|sponsor/.test(m)) {
    return new Error(
      `Couldn't pay transaction fees on "${networkId}". The account has no fee juice and no funded ` +
        `sponsored FPC is configured. Fund the account (faucet / L1 bridge), configure a sponsored FPC, ` +
        `or connect an external wallet that pays fees itself.`,
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}
```

> **Bootstrapping an unfunded account** (advanced): bridge fee juice from L1 with
> `L1FeeJuicePortalManager.bridgeTokensPublic(...)` (needs an L1 viem client; `mint`
> only on test networks), then pay with `new FeeJuicePaymentMethodWithClaim(account, claim)`.
> A pure browser dApp usually can't do the L1 side for the user, so prefer funding via
> the testnet faucet or connecting an already-funded/external wallet.

---

## 4a. Deploying the embedded account (before its first write)

A freshly-created embedded account (`wallet.createSchnorrAccount(...)`) is
**registered locally but NOT deployed on-chain**, and holds no fee juice. Its first
transaction therefore needs the account contract deployed first — otherwise the send
fails. External wallets (Azguard) handle this themselves; the **embedded** wallet
does not, so the example tag must.

Two things bite here:

- **You need the `AccountManager` to deploy the account.** `createSchnorrAccount`
  returns it, but the read-only base connector generated **random keys and discarded**
  the manager — which makes the account impossible to reconstruct (and so impossible
  to deploy) later. Derive the account from a **deterministic secret** (persisted,
  e.g. in localStorage) so you can rebuild the `AccountManager` on demand.
  `createSchnorrAccount` is idempotent: same secret + salt → same address, returning
  the manager whether the account is new or already registered.
- **Deploy is idempotent via the `initializationStatus` field**, paid by the
  sponsored FPC. An account deploys itself by passing **`from: NO_FROM`** (the
  self-paid-deploy sentinel, imported from `@aztec/aztec.js/account` — it is **still
  present** in v5; `AztecAddress.ZERO` is *not* the API). `getContractMetadata` returns
  **`initializationStatus: ContractInitializationStatus`** (an enum
  `INITIALIZED | UNINITIALIZED | UNKNOWN`, imported from `@aztec/aztec.js/wallet`) —
  there is **no `isContractInitialized` boolean** — alongside `isContractPublished`,
  `isContractUpdated`, and `instance?`.

```ts
import { NO_FROM } from '@aztec/aztec.js/account';
import { TxStatus } from '@aztec/aztec.js/tx';
import { ContractInitializationStatus } from '@aztec/aztec.js/wallet';
import type { AccountManager, Wallet } from '@aztec/aztec.js/wallet';
import type { FeePaymentMethod } from '@aztec/aztec.js/fee';

export async function ensureAccountDeployed(
  wallet: Wallet,
  account: AccountManager,
  paymentMethod?: FeePaymentMethod,
): Promise<void> {
  const { initializationStatus } = await wallet.getContractMetadata(account.address);
  if (initializationStatus === ContractInitializationStatus.INITIALIZED) return; // already deployed
  const fee = paymentMethod ? { paymentMethod } : undefined;
  const deployMethod = await account.getDeployMethod();
  await deployMethod.send({
    from: NO_FROM,                  // self-paid deploy: the account pays for its own deployment
    fee,                            // sponsored FPC (register it first — §4)
    skipClassPublication: true,     // Schnorr class is canonical/already published
    skipInstancePublication: true,  // keep it a private-only account
    wait: { waitForStatus: TxStatus.PROPOSED },
  });
}
```

`from: NO_FROM` tells the SDK the account pays for its own deployment (the self-paid
deploy path: with `from === NO_FROM` the payload is wrapped through the multicall
entrypoint and the fee is paid via the sponsored FPC). The first mint is therefore slow
(account deploy + the actual tx = two proven txs); surface a pending state. Later
writes skip the deploy (`initializationStatus` is `INITIALIZED`). For accounts,
`skipClassPublication`/`skipInstancePublication` already default to `true` — shown
here only to be explicit.

---

## 5. Registering a contract (and senders)

A PXE can only simulate/read a contract whose **instance + artifact it knows**. If
your local wallet didn't deploy the contract, register it first or reads/writes
throw "unknown contract". The v5 API on the wallet-agnostic `Wallet` is
**positional** — `registerContract(instance, artifact?, secretKey?)` — *not* the
object form `{ instance, artifact }` (that's the lower-level PXE API and won't
type-check against `Wallet`).

```ts
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { CounterContract, CounterContractArtifact } from '../contracts/artifacts/Counter';
import type { Wallet } from '@aztec/aztec.js/wallet';

export async function registerAndReadCounter(wallet: Wallet, owner: AztecAddress) {
  // Rebuild the instance from the SAME instantiation params used at deploy time —
  // salt / constructorArgs / deployer / publicKeys all feed the address derivation,
  // so a mismatch points you at a different (nonexistent) address.
  const instance = await getContractInstanceFromInstantiationParams(CounterContractArtifact, {
    salt: new Fr(0n),          // the deploy salt that was used
    constructorArgs: [owner],  // Counter's constructor takes `owner`
  });

  await wallet.registerContract(instance, CounterContractArtifact); // positional args

  const counter = CounterContract.at(instance.address, wallet);
  const { result } = await counter.methods.get_counter().simulate({ from: owner });
  return result as bigint;
}
```

- **For an already-deployed contract, skip the rebuild entirely:** fetch the instance
  from the node — `const instance = await node.getContract(addr)` (returns a
  `ContractInstanceWithAddress | undefined`) — and pass it straight to
  `registerContract(instance, artifact)`. No salt/constructorArgs needed; this is the
  right path for a dApp talking to a contract someone else deployed (and matches how
  the real apps do it). Likewise if you already hold an instance from your own deploy.
- The rebuild helper is **`getContractInstanceFromInstantiationParams`** — renamed from
  the old `getContractInstanceFromDeployParams`, which won't resolve in v5. Use it
  only when the contract isn't deployed yet (or you must derive the address before
  deploying); it requires the EXACT salt + constructorArgs + deployer used at deploy.
- `getContractInstanceFromInstantiationParams` is **async** (`await` it). That's the
  opposite of `Contract.at`, which is synchronous.

### Registering a sender (private note discovery)

If someone sends *you* private notes (e.g. a private token transfer) and your
balance still reads 0, the PXE isn't scanning notes tagged from that sender.
Register them:

```ts
await wallet.registerSender(AztecAddress.fromString(senderHex), 'counterparty'); // alias optional
```

You don't `registerSender` your own connector accounts — those are already in scope.
And you don't need it for notes you mint to **yourself** (e.g. `drip_to_private` →
`mint_to_private(msg_sender, …)`): your own PXE builds that tx and discovers the note
via your own keys. `registerSender` is only for discovering notes a **third party**
sent you. (Caveat: an in-memory/`ephemeral` PXE loses discovered private notes on
reload and must re-sync; public balances always read live from the node.)

---

## 6. Deploying

`Contract.deploy(...)` / `CounterContract.deploy(...)` return a `DeployMethod`.
**There is no `.deployed()` in v5** — call `.send({ from, fee })`, which waits and
resolves to a **`{ contract, instance, receipt, offchainEffects, offchainMessages }`
wrapper** (read `.contract` for the instance, `.receipt` for the `TxReceipt`). There is
no `wait: { returnReceipt }` option and no `DeployTxReceipt` type — the receipt is
already on the result.

```ts
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { FeePaymentMethod } from '@aztec/aztec.js/fee';
import { CounterContract } from '../contracts/artifacts/Counter';

export async function deployCounter(
  wallet: Wallet,
  from: AztecAddress,
  owner: AztecAddress,
  paymentMethod?: FeePaymentMethod, // OPTIONAL — omit to let the wallet/account pay (§4)
) {
  const salt = Fr.random();
  const fee = paymentMethod ? { paymentMethod } : undefined;
  // Typed deploy takes ctor args + an optional instantiation object ({ salt, deployer, … }).
  // The salt goes THERE, not in .send(). .send() resolves to a { contract, instance, receipt, … }
  // wrapper — read .contract.
  const { contract } = await CounterContract
    .deploy(wallet, owner, { salt })
    .send({ from, fee });

  // Persist for later .at()/register calls — store BOTH address and salt.
  localStorage.setItem('counter.address', contract.address.toString());
  localStorage.setItem('counter.salt', salt.toString());
  return contract.address;
}
```

- Constructor args are **positional** on the typed `.deploy`, followed by an optional
  **`instantiation` object** carrying the address-affecting params: `salt`, `deployer`,
  `universalDeploy`, `publicKeys`. Publication/registration/wait options
  (`skipClassPublication`, `skipInstancePublication`, `skipInitialization`,
  `skipRegistration`, `wait`, plus `from`/`fee`) go in the **`.send()`** (or `.request()`)
  options. `deployer` and `universalDeploy: true` are mutually exclusive. There is **no**
  `contractAddressSalt` option — that's the 4.x name; in v5 the salt is `salt` in the
  instantiation arg.
- Generic form: `Contract.deploy(wallet, artifact, [owner], undefined, { salt }).send({ from, fee })`
  (the 5th arg is the instantiation object).
- Reattach later with `CounterContract.at(savedAddress, wallet)` (synchronous).

---

## 7. Reading & writing contracts through an external wallet (capabilities)

The same `Contract`/`.methods.x()` code is wallet-agnostic — but the **external**
(wallet-sdk) connector is gated by the **capability manifest** it requests at connect
time. This project's `external.ts` requests only:

```ts
capabilities: [{ type: 'accounts', canGet: true, canCreateAuthWit: true }]
```

That authorizes reading *accounts* and signing authwits — but **not reading a
contract's state, and not sending**. Both need more (it's not just writes):

- A **read** (`.simulate()`) dispatches to the wallet's `simulateTx` / `executeUtility`
  → needs **`simulation`**, and the contract must be registered → **`contracts`**. So
  even showing a token balance through an external wallet fails on an `accounts`-only
  manifest.
- A **write** (`.send()`) additionally needs **`transaction`**.

The capability types live in `@aztec/aztec.js/wallet` (not wallet-sdk), and
`contracts` / `simulation` / `transaction` each accept a `'*'` wildcard — so a
connector can request broadly without baking in contract addresses. To support
external reads + writes:

```ts
import type { AppCapabilities } from '@aztec/aztec.js/wallet';
import { CAPABILITY_VERSION } from '@aztec/aztec.js/wallet';

const manifest: AppCapabilities = {
  version: CAPABILITY_VERSION, // '1.0' — use the constant
  metadata: { name: 'web-boiler', version: '0.1.0', description: 'Aztec frontend boilerplate' },
  capabilities: [
    { type: 'accounts', canGet: true, canCreateAuthWit: true },
    // register + query the contracts you read/write. `'*'` keeps the connector
    // generic (no addresses baked in); narrow to [addr, …] if you prefer. Both
    // Contract.at + reads and registering an instance need this:
    { type: 'contracts', contracts: '*', canRegister: true, canGetMetadata: true },
    // reads: public/private sims go through simulateTx; UTILITY reads (e.g.
    // balance_of_private, an `abi_utility` fn) go through executeUtility — cover both:
    { type: 'simulation', transactions: { scope: '*' }, utilities: { scope: '*' } },
    // the one that actually authorizes sending:
    { type: 'transaction', scope: '*' },
  ],
};
```

The six capability types in v5 are: `accounts`, `contracts`, `contractClasses`,
`simulation`, `transaction`, `data`. The string is literally **`transaction`** —
there is no `sendTransaction`/`execute`. Use `scope: '*'` for any contract/function,
or `[{ contract, function }]` to narrow.

Two important caveats:

- **`requestCapabilities` throws on the embedded wallet** (`BaseWallet` declares it
  "Not implemented" and `EmbeddedWallet` doesn't override it). Only call it on the
  external connector — `external.ts` already gates it correctly; keep it there.
- The wallet may **narrow or deny** capabilities — inspect the returned
  `granted` array rather than assuming the request was honored.
- For the external path the **wallet** simulates, proves, and submits (and prompts
  the user) — the dApp does no proving, so `proverEnabled` is irrelevant there.
- External wallets also **pay fees themselves** and show their own fee UI, so
  **omit `fee.paymentMethod`** for them (the `resolveFeePaymentMethod` helper in §4
  returns `undefined` for the external connector) — don't inject one.

`createAuthWit` (gated by `canCreateAuthWit`, already requested) is for
approval-style flows — authorizing another contract to spend your tokens before
sending the spending tx. Independent of the `transaction` capability.

---

## 8. Where the files go

```
src/
  contracts/
    artifacts/Counter.ts     # `aztec codegen` output (generated)
    counter.ts               # interaction helpers (at / read / write / register / deploy)
    fees.ts                  # resolveFeePaymentMethod(connector, networkId) + explainFeeError  (§4)
  hooks/
    useCounter.ts            # useCounterValue (useQuery) + useIncrement (useMutation)
  components/
    CounterPanel.tsx         # UI — styles const, && rendering, pending/error states
```

Adapt the templates in [../assets/templates/](../assets/templates/) rather than writing these from
scratch — they already follow the conventions and the v5 API shapes above.
