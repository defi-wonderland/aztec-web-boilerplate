# Aztec Web Boilerplate

A starter template for building privacy-preserving web applications on Aztec Network. This boilerplate provides a complete setup with React, Vite, and Aztec.js, featuring embedded wallet support, native Aztec browser wallet integration via `@aztec/wallet-sdk`, and sponsored fee payments.

## Features

- 🔐 **Privacy-preserving token operations** using Aztec's private state
- 💼 **Multi-wallet support** for embedded wallets and browser extension wallets via `@aztec/wallet-sdk`
- ⛽ **Sponsored fee payments** through SponsoredFPC
- 🔄 **Network switching** between public Testnet and local Sandbox
- 📦 **Lazy contract loading** for optimized performance

---

## Quick Start

### Prerequisites

- Node.js >= 22.0.0
- Yarn package manager
- [Docker](https://docs.docker.com/get-docker/) installed and running (used by the local sandbox)

### Installation

```bash
# Clone the repository
git clone https://github.com/defi-wonderland/aztec-web-boilerplate.git
cd aztec-web-boilerplate

# Install dependencies
yarn install
```

### Install the Aztec CLI

The boilerplate targets Aztec **`4.2.0-aztecnr-rc.2`**. Install the matching CLI and runtime via the official installer:

```bash
VERSION=4.2.0-aztecnr-rc.2 bash -i <(curl -sL https://install.aztec.network/4.2.0-aztecnr-rc.2)
```

Verify:

```bash
aztec --version
# 4.2.0-aztecnr-rc.2
```

If you already have `aztec-up` installed, you can install/switch to a specific version:

```bash
aztec-up install 4.2.0-aztecnr-rc.2
aztec-up use 4.2.0-aztecnr-rc.2
```

### Run against the public Testnet

The fastest way to try the app — no local sandbox required. Contracts are pre-deployed on Testnet at `https://rpc.testnet.aztec-labs.com`.

```bash
yarn dev
```

The app starts at **http://localhost:3000**. Connect with the embedded wallet or any installed Aztec browser extension and you're ready to go.

### Run against a local Sandbox

For local development you can run a self-contained Aztec sandbox. It bundles its own L1 (anvil) — **no separate anvil instance is required**.

```bash
# Terminal 1 — start the local sandbox
aztec start --local-network --port 8080

# Wait until you see "Started PXE" / "Aztec Node started"
# Verify it's up:
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"node_getNodeInfo","params":[],"id":1}' \
  http://localhost:8080 | grep nodeVersion
# → "nodeVersion":"4.2.0-aztecnr-rc.2"
```

```bash
# Terminal 2 — deploy contracts and run the app
yarn deploy-contracts   # deploys Dripper + Token to the local sandbox
yarn dev
```

To stop the sandbox: **Ctrl+C** in its terminal. State is ephemeral — restarting wipes deployed contracts, so you'll need to redeploy.

---

## Configuration

### Wallet Configuration

Edit `src/config/aztecWalletConfig.ts` to customize wallet options and networks:

```typescript
import { createAztecWalletConfig } from '../aztec-wallet';
import { DEFAULT_NETWORK, NETWORK_URLS } from './networks';

export const aztecWalletConfig = createAztecWalletConfig({
  networks: [
    { name: 'devnet', displayName: 'Devnet', nodeUrl: NETWORK_URLS.devnet },
    { name: 'sandbox', displayName: 'Local Network', nodeUrl: NETWORK_URLS.sandbox },
  ],
  defaultNetwork: DEFAULT_NETWORK,

  walletGroups: {
    embedded: true,              // App-managed wallet (localStorage)
    aztecWallets: ['azguard'],   // Browser extension wallets via wallet-sdk
  },

  showNetworkPicker: 'full',
});
```

> **Note:** The network internally named `'devnet'` currently points to the public **Testnet** at `https://rpc.testnet.aztec-labs.com`. The display label is `Devnet` for backwards compatibility — this naming will be unified in a future release.

### Contract Configuration

Boilerplate contracts (Dripper + Token) live in `src/config/boilerplateContracts.ts`. Add your own contracts in `src/config/contracts.ts`:

```typescript
import { createContractConfig } from '../contract-registry';
import { boilerplateContracts } from './boilerplateContracts';

export const contractsConfig = createContractConfig({
  ...boilerplateContracts,

  myContract: {
    contract: MyContract,
    address: (config) => config.myContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString('1337'),
      deployer: AztecAddress.ZERO,
      constructorArgs: [],
      constructorArtifact: 'constructor',
    }),
    artifactSources: () => [{ local: MyContract.artifact }],
    lazyRegister: false, // false = register at startup, true = register on first use
  },
});
```

#### Lazy Loading

Set `lazyRegister: true` for contracts that aren't needed immediately. They're registered on-demand when first accessed, reducing initial sync time.

---

## Wallet Architecture

This boilerplate uses **`@aztec/wallet-sdk`** for browser wallet discovery and connection. Three connector types live in `src/aztec-wallet/connectors/`:

| Connector                  | Description                                       | Use case                       |
| -------------------------- | ------------------------------------------------- | ------------------------------ |
| **EmbeddedConnector**      | App-managed key in localStorage                   | Quick testing, simple dApps    |
| **BrowserWalletConnector** | Wraps `WalletManager` from wallet-sdk             | Production, user-managed keys  |
| **ExternalSignerConnector**| EVM wallet (MetaMask) deriving an Aztec key       | Currently disabled — see note  |

> **Note:** `ExternalSignerConnector` is **disabled by default** in `aztecWalletConfig.ts`. The `evmWallets` field is commented out pending future iframe-passkey wallet work. The connector code still exists but isn't wired into the active config.

`BrowserWalletConnector` is **generic** — it works with any wallet extension that implements the wallet-sdk discovery protocol. Adding a new wallet only requires registering its `providerId`:

```typescript
// src/aztec-wallet/config/walletPresets.ts
export const AZTEC_WALLET_PRESETS = {
  azguard: {
    id: 'azguard',
    name: 'Azguard',
    icon: AzguardIcon,
    providerId: 'azguard-wallet',
  },
  // Add more wallets:
  // myNewWallet: {
  //   id: 'mynewwallet',
  //   name: 'My New Wallet',
  //   icon: MyWalletIcon,
  //   providerId: 'my-wallet-provider-id',
  // },
};
```

Then enable it in `aztecWalletConfig.ts`:

```typescript
walletGroups: {
  embedded: true,
  aztecWallets: ['azguard', 'myNewWallet'],
},
```

No adapter classes, no SDK dependencies, no boilerplate code — wallet-sdk handles transport and the standard `Wallet` interface.

---

## Build & Deploy

### Build pipeline

```bash
yarn build              # build the Vite app (uses pre-built artifacts from npm)
yarn deploy-contracts   # deploy Dripper + Token to local sandbox
yarn build:local        # full rebuild: local Noir → copy standards → codegen → app
```

Boilerplate contracts (Dripper, Token) are consumed as **pre-built artifacts** from `@defi-wonderland/aztec-standards`. The `yarn build` command is enough for normal development — it imports the artifacts directly from `node_modules`.

`yarn build:local` runs the full pipeline:
1. `aztec compile` on the Nargo workspace (currently empty — `contracts/` has no local Noir contracts)
2. Copies `node_modules/@defi-wonderland/aztec-standards/target/*.json` into `src/target/`
3. Runs `aztec codegen` to generate TypeScript wrappers in `src/artifacts/`
4. Builds the Vite app

You only need `yarn build:local` if you're adding local Noir contracts or want to regenerate TypeScript bindings from a custom build of aztec-standards (see `scripts/build-aztec-standards.ts`).

### Environment Variables

Copy `.env.example` to `.env` to customize:

```bash
# Aztec node URL (default: http://localhost:8080 for sandbox)
VITE_AZTEC_NODE_URL=http://localhost:8080

# Disable prover for faster local development
VITE_PROVER_ENABLED=false

# Embedded wallet credentials (optional — auto-generated if not provided)
VITE_EMBEDDED_ACCOUNT_SECRET_PHRASE="my secret"
VITE_EMBEDDED_ACCOUNT_SECRET_KEY="0x..."
VITE_COMMON_SALT="1337"
```

---

## Project Structure

```
aztec-web-boilerplate/
├── contracts/                       # Local Noir contract sources (currently empty)
├── scripts/
│   ├── deploy.ts                    # Contract deployment script (uses @aztec/wallets EmbeddedWallet)
│   ├── build-contracts.ts           # Local Noir compilation helper
│   └── build-aztec-standards.ts     # Build aztec-standards from a specific commit/branch
├── src/
│   ├── aztec-wallet/                # Modular wallet library (wagmi-like for Aztec)
│   │   ├── assets/                  # Wallet icons (MetaMask, Rabby, Azguard)
│   │   ├── client/                  # createExecutionClient (bridges connector → use-aztec)
│   │   ├── components/              # ConnectButton and modals
│   │   ├── config/                  # createAztecWalletConfig, walletPresets
│   │   ├── connectors/              # EmbeddedConnector, BrowserWalletConnector, ExternalSignerConnector
│   │   ├── execution/               # executeRead, executeWrite, executeBatchRead
│   │   ├── hooks/                   # useAztecWallet, useConnectModal, etc.
│   │   ├── providers/               # AztecWalletProvider
│   │   ├── services/                # PXE (aztec/), wallet/, evm/
│   │   ├── signers/                 # Account signing implementations
│   │   ├── store/                   # Zustand stores (wallet, network, modal, evm)
│   │   └── types/                   # WalletConnector interfaces
│   ├── use-aztec/                   # Wallet-agnostic React hooks (useReadContract, useWriteContract, useReadContracts)
│   ├── components/ui/               # Primitive UI components (Button, Input, etc.)
│   ├── config/
│   │   ├── contracts.ts             # Contract registry configuration
│   │   ├── boilerplateContracts.ts  # Dripper + Token definitions
│   │   ├── aztecWalletConfig.ts     # Wallet & network configuration
│   │   ├── deployments/             # Deployed contract addresses (generated by yarn deploy-contracts)
│   │   └── networks/                # Network constants (devnet/sandbox)
│   ├── containers/                  # Page-level components
│   ├── contract-registry/           # Smart contract registration & caching
│   ├── hooks/                       # Custom React hooks (queries/, mutations/, context/)
│   ├── providers/                   # App context providers
│   ├── styles/                      # Tailwind CSS configuration
│   └── utils/                       # Utility functions
└── tests/
    ├── e2e/                         # Playwright end-to-end tests
    └── setup.ts                     # Vitest global setup
```

---

## UI Development

This project uses **Tailwind CSS v4** for styling and **Radix UI Primitives** for accessible components.

### The Styles Pattern

All Tailwind classes **must** be defined in a `styles` object at the top of the component file. **Never use inline className strings directly in JSX**.

```tsx
// ✅ Correct
const styles = {
  container: 'flex flex-col gap-4',
  title: 'text-lg font-semibold text-default',
} as const;

export const MyComponent = () => (
  <div className={styles.container}>
    <h1 className={styles.title}>Title</h1>
  </div>
);

// ❌ Wrong - inline classes are forbidden
export const BadComponent = () => (
  <div className="flex flex-col gap-4">
    <h1 className="text-lg font-semibold">Title</h1>
  </div>
);
```

### Component Showcase

A live showcase of all UI components is available in the app under the **"UI Components"** tab. Source: `src/containers/UIComponentsShowcase.tsx`.

### Adding New UI Components

1. **Check [Radix UI Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction) first** — if it exists there, use it as the base
2. Create a wrapper in `src/components/ui/`
3. Style with Tailwind using the styles pattern
4. Export from `src/components/ui/index.ts`
5. Add examples to `UIComponentsShowcase.tsx`

---

## Available Commands

### Development

```bash
yarn dev                      # Start dev server on localhost:3000
yarn serve                    # Preview production build
```

### Build

```bash
yarn build                    # Build the app (uses pre-built artifacts)
yarn build:local              # Full local rebuild including contracts
yarn deploy-contracts         # Deploy contracts to local sandbox
```

### Testing & Quality

```bash
yarn test                     # Run all tests
yarn test:e2e                 # Run E2E tests with Playwright
yarn lint                     # Check formatting & lint
yarn lint:fix                 # Auto-fix formatting & lint
```

---

## Architecture Overview

### Aztec Integration

- **PXE**: Client-side Private eXecution Environment for proof generation. Embedded wallets create their own; browser wallets use the extension's PXE
- **Account Contracts**: ECDSA-R signature-based accounts (configurable)
- **Note System**: Encrypted UTXO-like notes for private state
- **Fee Abstraction**: Sponsored transactions through SponsoredFPC
- **wallet-sdk**: Standard discovery + transport for browser wallet extensions

### Hooks API

The boilerplate exposes a wallet-agnostic React hooks API via `use-aztec`. The API mirrors **wagmi**'s hook style (TanStack Query under the hood).

#### Reading contract state

```typescript
import { TokenContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Token.js';
import { useReadContract } from '../use-aztec';

const { data, isLoading, error } = useReadContract({
  contract: TokenContract,                              // contract class
  address: tokenAddress,                                // string | undefined
  functionName: 'balance_of_public',                    // typed against contract
  args: [ownerAddress],                                 // typed against function
  scopeKey: ['tokenBalance', tokenAddress, ownerAddress], // optional cache prefix
});
```

#### Writing to contracts

```typescript
import { DripperContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Dripper.js';
import { useWriteContract } from '../use-aztec';

const write = useWriteContract({
  mutation: { onSuccess: (data) => console.log('tx:', data.txHash) },
});

write.mutate({
  contract: DripperContract,
  address: dripperAddress,
  functionName: 'drip_to_private',
  args: [recipient, amount],
});
```

`useWriteContract` returns a TanStack `useMutation` result — call `.mutate()` or `.mutateAsync()`.

#### Batched reads

```typescript
import { useReadContracts } from '../use-aztec';

const result = useReadContracts({
  contracts: [
    { contract: TokenContract, address, functionName: 'balance_of_private', args: [owner] },
    { contract: TokenContract, address, functionName: 'balance_of_public', args: [owner] },
  ],
});
```

These hooks work the same regardless of which connector is active — the execution client dispatches to the correct wallet automatically. Real-world examples live in `src/hooks/queries/` and `src/hooks/mutations/`.

---

## Network Information

| Network | Node URL                              | Status                   |
| ------- | ------------------------------------- | ------------------------ |
| Testnet | `https://rpc.testnet.aztec-labs.com`  | Public, contracts deployed |
| Sandbox | `http://localhost:8080`               | Local, run with `aztec start --local-network` |

---

## Resources

- [Aztec Documentation](https://docs.aztec.network)
- [Noir Language Guide](https://noir-lang.org/docs)
- [`@aztec/wallet-sdk`](https://www.npmjs.com/package/@aztec/wallet-sdk)
- [`@defi-wonderland/aztec-standards`](https://github.com/defi-wonderland/aztec-standards)
- [Azguard Wallet](https://azguard.xyz/)

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

---

Built with [Aztec Network](https://aztec.network)
