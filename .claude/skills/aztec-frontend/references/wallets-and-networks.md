# Adding networks and wallet connectors

The connector abstraction is the heart of this boilerplate: a `WalletConnector`
turns a user's choice into a single wallet-agnostic `Wallet`, so the store, hooks,
and UI never branch on which wallet is connected. Adding a network or a wallet is a
small, localized change *because* of this — don't route around it.

## Adding a network

A network is one entry in `NETWORKS` in `src/config/app.ts`:

```ts
export const NETWORKS: NetworkConfig[] = [
  { id: 'testnet', label: 'Testnet', nodeUrl: NODE_URL },
  { id: 'localhost', label: 'Localhost', nodeUrl: 'http://localhost:8080' },
  { id: 'my-net', label: 'My Net', nodeUrl: 'https://rpc.my-net.example' }, // ← add here
];
```

Nothing else needs editing:

- `NetworkSwitcher` maps over `NETWORKS` to render the options.
- `getNetwork(id)` resolves the active config (falling back to the first entry).
- `walletStore.setNetwork(id)` recreates the node client, persists `networkId` to
  localStorage, and **disconnects the wallet on purpose** — `chainInfo` (chainId +
  rollup version) differs per network, so a wallet session can't carry across.

`id` must be unique and stable (it's the persistence key). If contract writes on
this network need a fee payer, add `sponsoredFpc?: string` to `NetworkConfig` and
set it here — see [contracts.md §4](contracts.md#4-fee-payment-required-on-testnet).

## Adding a wallet connector

Both existing connectors implement the same interface (`src/lib/connectors/types.ts`):

```ts
export interface WalletConnector {
  kind: ConnectorKind;
  label: string;
  connect(opts: ConnectOptions): Promise<ConnectResult>; // { wallet, accounts }
  disconnect(): Promise<void>;
}
```

`connect` receives `{ node, onEmojiGrid? }` and returns `{ wallet, accounts }` where
`accounts: Aliased<AztecAddress>[]`. **Return all granted accounts** — the store
auto-selects when there's one and moves to a `selecting` state when there are
several. Four edits add a connector:

### 1. Add the kind (`src/lib/connectors/types.ts`)

```ts
export type ConnectorKind = 'embedded' | 'external' | 'my-wallet';
```

### 2. Implement the connector (`src/lib/connectors/my-wallet.ts`)

For a wallet-sdk-based extension wallet, model it on `external.ts`:

```ts
// src/lib/connectors/my-wallet.ts
// MyWallet connector — wallet-sdk extension wallet. Mirrors external.ts:
// discovery -> secure-channel handshake -> emoji verification -> confirm.
import { WalletManager, type WalletProvider } from '@aztec/wallet-sdk/manager';
import { hashToEmoji } from '@aztec/wallet-sdk/crypto';
import type { AppCapabilities, GrantedAccountsCapability } from '@aztec/aztec.js/wallet';
import { CAPABILITY_VERSION } from '@aztec/aztec.js/wallet';
import { getChainInfo } from '../../services/node';
import { APP_ID, DISCOVERY_TIMEOUT_MS } from '../../config/app';
import type { ConnectOptions, ConnectResult, WalletConnector } from './types';

export class MyWalletConnector implements WalletConnector {
  readonly kind = 'my-wallet' as const;
  readonly label = 'My Wallet';
  private provider: WalletProvider | null = null;

  async connect({ node, onEmojiGrid }: ConnectOptions): Promise<ConnectResult> {
    const chainInfo = await getChainInfo(node);
    const discovery = WalletManager.configure({ extensions: { enabled: true } })
      .getAvailableWallets({ chainInfo, appId: APP_ID, timeout: DISCOVERY_TIMEOUT_MS });

    let provider: WalletProvider | null = null;
    for await (const p of discovery.wallets) { provider = p; break; }
    discovery.cancel();
    if (!provider) throw new Error('No external wallet found');
    this.provider = provider;

    const pending = await provider.establishSecureChannel(APP_ID);
    onEmojiGrid?.(hashToEmoji(pending.verificationHash)); // display-only; proceed to confirm()
    const wallet = await pending.confirm();

    const manifest: AppCapabilities = {
      version: CAPABILITY_VERSION,
      metadata: { name: 'web-boiler', version: '0.1.0', description: 'Aztec frontend boilerplate' },
      // For reads only, `accounts` suffices. To support WRITES through this wallet,
      // also request `transaction` + `simulation` + `contracts` — see contracts.md §7.
      capabilities: [{ type: 'accounts', canGet: true, canCreateAuthWit: true }],
    };
    const response = await wallet.requestCapabilities(manifest);
    const cap = response.granted.find(
      (c): c is GrantedAccountsCapability => c.type === 'accounts',
    );
    const accounts = cap?.accounts ?? [];
    if (accounts.length === 0) throw new Error('No accounts granted');
    return { wallet, accounts }; // return ALL — the store lets the user pick
  }

  async disconnect(): Promise<void> {
    if (this.provider) { await this.provider.disconnect(); this.provider = null; }
  }
}
```

For an **in-browser** wallet instead, model it on `embedded.ts`: create the wallet
from the node, ensure an account exists, return `{ wallet, accounts }`. Note
`requestCapabilities` **throws** on a `BaseWallet`-derived embedded wallet — only
call it on extension wallets.

### 3. Register it (`src/lib/connectors/index.ts`)

```ts
import { MyWalletConnector } from './my-wallet';

export const connectors: WalletConnector[] = [
  new EmbeddedConnector(),
  new ExternalConnector(),
  new MyWalletConnector(), // ← add
];
```

### 4. Add presentation (`src/components/WalletModal.tsx`)

The registry only carries `kind` + `label`; the modal adds icon + subtitle:

```ts
const META: Record<ConnectorKind, { Icon: LucideIcon; sub: string; recommended?: boolean }> = {
  embedded: { Icon: Wallet, sub: 'In-browser account · best for testing & dev', recommended: true },
  external: { Icon: Puzzle, sub: 'Connect your Azguard extension' },
  'my-wallet': { Icon: Puzzle, sub: 'Connect My Wallet' }, // ← add
};
```

That's the whole change — `WalletModal` maps over `connectors` and the store handles
`connect(kind)`, account selection, persistence, and reconnect generically.

### The emoji handshake (external wallets)

`onEmojiGrid` is **display-only**: the connector shows the grid (from
`hashToEmoji(pending.verificationHash)`) and proceeds straight to `confirm()`, which
hands control to the wallet's own approval popup. The store surfaces the grid as
`emojiGrid` and `VerifyDialog` shows it while connecting. Don't block on a confirm
button in the connector — match `external.ts`.

### Reconnect behavior

The store auto-reconnects **embedded** sessions on reload (the account persists in
IndexedDB). External/extension wallets are not auto-reconnected — their secure
channel is destroyed on reload and re-handshaking without the user asking would be
surprising. If your new connector persists its session like embedded does, you can
extend `reconnect()` in the store; otherwise leave it.
