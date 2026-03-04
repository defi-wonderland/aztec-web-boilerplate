# Aztec Web Boilerplate

A starter template for building privacy-preserving web applications on Aztec Network. This boilerplate provides a complete setup with React, Vite, and Aztec.js, featuring embedded wallet support, Azguard wallet integration, and sponsored fee payments.

## Features

- 🔐 **Privacy-preserving token operations** using Aztec's private state
- 💼 **Multi-wallet support** for embedded wallets or browser extension wallets (Azguard)
- ⛽ **Sponsored fee payments** through SponsoredFPC
- 🔄 **Network switching** between Devnet and local Sandbox
- 📦 **Lazy contract loading** for optimized performance

---

## Quick Start

> **Note:** There is no public v4 devnet yet. Development currently targets the **local Sandbox**.

### Prerequisites

- Node.js >= 22.0.0
- Yarn package manager
- [Docker](https://docs.docker.com/get-docker/) installed and running
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (for Anvil, the local L1 chain)

### Installation

```bash
# Clone the repository
git clone https://github.com/defi-wonderland/aztec-web-boilerplate.git
cd aztec-web-boilerplate

# Install dependencies
yarn install
```

### Start Sandbox & Deploy

The Aztec v4 sandbox runs as a Docker container and requires a separate Anvil instance as its L1 chain.

**Option A: Docker (recommended)**

```bash
# Terminal 1: Start Anvil (local L1 chain)
anvil --host 0.0.0.0 -p 8545 --block-time 12

# Terminal 2: Start the Aztec v4 sandbox (Docker)
docker pull aztecprotocol/aztec:4.0.0-devnet.1-patch.0
docker run -d --name aztec-sandbox \
  -p 8080:8080 -p 8880:8880 \
  -e ETHEREUM_HOSTS=http://host.docker.internal:8545 \
  aztecprotocol/aztec:4.0.0-devnet.1-patch.0 start --local-network

# Wait for the sandbox to be ready (check logs)
docker logs -f aztec-sandbox
# Look for: "Aztec Node started on port 8080" or block production logs

# Terminal 3: Build and deploy everything
yarn build            # Builds standards + contracts + app
yarn deploy-contracts # Deploy to local sandbox

# Start the development server
yarn dev
```

**Option B: Native CLI (via aztec-up)**

```bash
# Install the Aztec version manager
bash -i <(curl -s https://install.aztec.network)

# Install the specific version
aztec-up install 4.0.0-devnet.1-patch.0

# Terminal 1: Start Anvil (local L1 chain)
anvil --host 0.0.0.0 -p 8545 --block-time 12

# Terminal 2: Start the Aztec local network
aztec start --local-network --l1-rpc-urls http://localhost:8545

# Terminal 3: Build, deploy, and run
yarn build && yarn deploy-contracts && yarn dev
```

> **Note:** The native CLI install requires Foundry to not be running during installation.
> If `aztec-up install` fails with "anvil is currently running", stop anvil first,
> install, then restart anvil.

### Stopping the Sandbox

```bash
# Docker approach
docker stop aztec-sandbox && docker rm aztec-sandbox

# Also stop Anvil (Ctrl+C in its terminal, or)
pkill -f anvil
```

The application will be available at **http://localhost:3000**

---

## Configuration

### Wallet Configuration

Edit `src/config/aztecWalletConfig.ts` to customize wallet options and networks:

```typescript
import { createAztecWalletConfig } from '@aztec-wallet';

export const aztecWalletConfig = createAztecWalletConfig({
  // Networks to support
  networks: [
    { name: 'devnet', nodeUrl: 'https://devnet.aztec.network' },
    { name: 'sandbox', nodeUrl: 'http://localhost:8080' },
  ],

  // Wallet types to enable
  walletGroups: {
    embedded: true,                    // App-managed wallet
    evmWallets: ['metamask', 'rabby'], // EVM wallets as signers
    aztecWallets: ['azguard'],         // Browser extension wallets
  },

  showNetworkPicker: 'full',
});
```

### Contract Configuration

`src/config/contracts.ts` is the aggregation layer. It automatically collects
contract definitions from all discovered feature modules
(`src/features/**/feature.tsx`).

To add contracts, define them inside the feature and expose them from that
feature's `feature.tsx`:

```typescript
// src/features/examples/my-feature/config/contracts.ts
export const myFeatureContracts = createContractConfig({
  myContract: {
    contract: MyContract,
    address: (config) => config.myContractAddress,
    deployParams: () => ({
      /* ... */
    }),
    lazyRegister: true,
  },
});

// src/features/examples/my-feature/feature.tsx
const feature: FeatureModule = {
  id: 'my-feature',
  label: 'My Feature',
  order: 200,
  component: MyFeatureScreen,
  contracts: myFeatureContracts,
};
```

#### Lazy Loading Contracts

For contracts that aren't needed immediately, enable lazy loading to improve initial load performance:

```typescript
myOptionalContract: {
  artifact: MyContract.artifact,
  contract: MyContract,
  address: (config) => config.myContractAddress,
  lazyRegister: true, // Only register when explicitly requested
},
```

Lazy contracts are registered on-demand when first accessed, reducing the initial sync time.

### Feature Modules (Add/Remove)

Features are auto-discovered via `import.meta.glob('./**/feature.tsx')` in
`src/features/registry.ts`.

To add a feature:

1. Create a folder under `src/features/...`
2. Export a default `feature.tsx` with unique `id`, `label`, `order`,
   `component`, and optional `contracts`
3. Add feature-local config/hooks/components

To remove a feature:

1. Delete the feature folder (or remove its `feature.tsx`)
2. Remove any contracts/artifacts used only by that feature
3. Run `yarn test:unit && yarn lint` to validate there are no stale imports

---

## Using Azguard Wallet

If you want to use [Azguard Wallet](https://azguardwallet.io/), you'll need to configure sponsored fee payments:

### Setting Up Sponsored Fees in Azguard

1. Open Azguard wallet extension
2. Navigate to **Settings** → **Fee Configuration**
3. In the **"Pay fee with"** dropdown, select **FPC**
4. Click **"Create New FPC"**
5. Configure your FPC:
   - **Name**: Any name you prefer (e.g., "Sponsored FPC")
   - **FPC Address**:
     ```
     0x1586f476995be97f07ebd415340a14be48dc28c6c661cc6bdddb80ae790caa4e
     ```
6. Save the configuration

This FPC address points to the public Sponsored FPC contract that enables gasless transactions.

---

## Build & Deploy Details

The full build pipeline has three stages:

```bash
yarn build-standards    # 1. Clone & compile @defi-wonderland/aztec-standards (Dripper, Token)
yarn build-contracts    # 2. Compile local Noir contracts (ECDSA account)
yarn build-app          # 3. Build the Vite app

# Or run all three at once:
yarn build
```

After building, deploy contracts to your running sandbox:

```bash
yarn deploy-contracts   # Deploy account + Dripper + Token to sandbox
```

### Environment Variables

Copy `.env.example` to `.env` to customize:

```bash
# Aztec Node URL (default: http://localhost:8080 for sandbox)
VITE_AZTEC_NODE_URL=http://localhost:8080

# Disable prover for faster development
VITE_PROVER_ENABLED=false

# Artifact registry URL used for class ID lookups
VITE_ARTIFACT_REGISTRY_URL=https://sandbox.aztec.network/api/v1/contracts

# Optional external artifact bundle fallback (.tgz)
VITE_EXTERNAL_TGZ_URL=https://github.com/.../your-artifacts.tgz

# Enable/disable SponsoredFPC flow in UI
VITE_FPC_ENABLED=true

# Embedded wallet credentials (optional - auto-generated if not provided)
VITE_EMBEDDED_ACCOUNT_SECRET_PHRASE="my secret"
VITE_EMBEDDED_ACCOUNT_SECRET_KEY="0x..."
VITE_COMMON_SALT="1337"
```

---

## Project Structure

```
aztec-web-boilerplate/
├── contracts/                  # Noir smart contracts
│   └── dripper/               # Token faucet contract
├── packages/
│   ├── aztec-wallet/          # Wallet package
│   ├── contract-registry/     # Contract registry package
│   └── use-aztec/             # Query/mutation hooks package
├── scripts/
│   └── deploy.ts              # Contract deployment script
├── src/
│   ├── artifacts/             # Generated contract TypeScript bindings
│   │   ├── devnet/            # Devnet-specific artifacts
│   │   └── sandbox/           # Sandbox-specific artifacts
│   ├── components/            # React UI components
│   │   └── ui/                # Primitive UI components (Button, Input, etc.)
│   ├── config/
│   │   ├── contracts.ts       # Aggregates contracts from features
│   │   ├── aztecWalletConfig.ts # Wallet & network configuration
│   │   ├── deployments/       # Shared deployment JSON files
│   │   └── networks/          # Network constants
│   ├── features/              # Feature modules (auto-discovered)
│   │   ├── contract-interaction/
│   │   ├── examples/
│   │   │   ├── mint/
│   │   │   │   └── config/mint.ts # Feature-local mint constants/deployments
│   │   │   └── ui-showcase/
│   │   ├── settings/
│   │   └── registry.ts
│   ├── containers/            # Layout containers
│   ├── hooks/                 # Shared app hooks
│   ├── providers/             # App providers
│   ├── styles/                # Tailwind and theme setup
│   ├── types/                 # Shared type definitions
│   └── utils/                 # Shared utilities
└── tests/                     # Test suites
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

### Component Demo

A live showcase of all UI components is available in the app under the **"UI Components"** tab, or you can view the source at:

📄 **`src/features/examples/ui-showcase/UIComponentsShowcase.tsx`**

This showcase serves as living documentation for the design system.

### Adding New UI Components

When you need a new UI component:

1. **Check [Radix UI Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction) first** - If the component exists there, use it as the base
2. Create a wrapper in `src/components/ui/`
3. Style with Tailwind using the semantic styles pattern
4. Export from `src/components/ui/index.ts`
5. **Add examples to `src/features/examples/ui-showcase/UIComponentsShowcase.tsx`** for documentation
6. Update the component table above

---

## Available Commands

### Contract Development

```bash
yarn build-standards          # Build aztec-standards artifacts (Dripper, Token)
yarn build-contracts          # Compile local Noir contracts + generate TS bindings
yarn deploy-contracts         # Deploy contracts to sandbox
yarn build                    # Full build: standards + contracts + app
```

### Testing & Quality

```bash
yarn test                     # Run test suite
yarn test:unit                # Run unit tests only
yarn test:integration         # Run integration tests only
yarn test:e2e                 # Run E2E tests with Playwright
yarn lint                     # Check code formatting
```

---

## Adding New Contracts

1. Create your contract in `contracts/your_contract/`
2. Add it to `contracts/Nargo.toml` workspace members
3. Run `yarn build-contracts` to compile and generate TypeScript bindings
4. Update `scripts/deploy.ts` to deploy your contract
5. Create feature-local contract config in `src/features/.../config/contracts.ts`
6. Expose that config via the feature's `feature.tsx` `contracts` field
7. Import generated TypeScript bindings from `src/artifacts/`

---

## Architecture Overview

### Aztec Integration

- **PXE**: Client-side Private eXecution Environment for proof generation
- **Account Contracts**: ECDSA signature-based accounts
- **Note System**: Encrypted UTXO-like notes for private state
- **Fee Abstraction**: Sponsored transactions through SponsoredFPC

### Wallet Options

| Wallet       | Description                          | Use Case                              |
| ------------ | ------------------------------------ | ------------------------------------- |
| **Embedded** | Keys generated and stored in browser | Quick testing, simple dApps           |
| **Azguard**  | External browser extension wallet    | Production apps, user-controlled keys |

---

## Adding a New Browser Wallet

To add support for a new browser wallet (e.g., Obsidian), follow these steps:

### 1. Create the Adapter Folder

Create a new folder under `packages/aztec-wallet/adapters/` with your wallet name:

```
packages/aztec-wallet/adapters/obsidian/
├── ObsidianAdapter.ts       # Implements IBrowserWalletAdapter interface
├── ObsidianWalletService.ts # Handles extension communication
└── index.ts                 # Exports adapter and factory
```

### 2. Implement the Wallet Service

Create `ObsidianWalletService.ts` to handle communication with the browser extension:

```typescript
export class ObsidianWalletService {
  async initialize(): Promise<void> { /* detect extension */ }
  async connect(...): Promise<string[]> { /* connect to wallet */ }
  async disconnect(): Promise<void> { /* disconnect */ }
  async executeOperations(ops: Operation[]): Promise<OperationResult[]> { /* execute ops */ }
  getState(): WalletState { /* return current state */ }
  onAccountsChanged(cb: (accounts: string[]) => void): void { /* event handler */ }
  onDisconnected(cb: () => void): void { /* event handler */ }
  destroy(): void { /* cleanup resources */ }
}
```

### 3. Implement the Adapter

Create `ObsidianAdapter.ts` implementing the `IBrowserWalletAdapter` interface:

```typescript
import type { IBrowserWalletAdapter } from '../../types/browserWallet';

export class ObsidianAdapter implements IBrowserWalletAdapter {
  readonly id = 'obsidian';
  readonly label = 'Obsidian Wallet';

  private service: ObsidianWalletService;

  // Implement all IBrowserWalletAdapter methods
  // Translate generic operations to wallet-specific format
}

export const createObsidianAdapter = (): IBrowserWalletAdapter =>
  new ObsidianAdapter();
```

### 4. Register the Wallet

In `packages/aztec-wallet/config/aztecWallets.ts`, add your wallet configuration:

```typescript
export const AZTEC_WALLETS: AztecWalletInfo[] = [
  // ... existing wallets
  {
    id: 'obsidian',
    name: 'Obsidian',
    icon: ObsidianIcon,
    adapterFactory: createObsidianAdapter,
  },
];
```

### 5. Enable the Wallet

In `src/config/aztecWalletConfig.ts`, add your wallet to the config:

```typescript
walletGroups: {
  aztecWallets: ['azguard', 'obsidian'],
},
```

### 6. Export from Index Files

Make sure to properly export your adapter from:

- `packages/aztec-wallet/adapters/obsidian/index.ts`
- `packages/aztec-wallet/adapters/index.ts`

> **Note:** No changes are needed to hooks, providers, or the `BrowserWalletConnector` class. The adapter pattern handles all wallet-specific logic.

---

## Network Information

| Network | Node URL                | Status                       |
| ------- | ----------------------- | ---------------------------- |
| Sandbox | `http://localhost:8080` | Local development (primary)  |
| Devnet  | TBD                     | No public v4 devnet yet      |

---

## Resources

- [Aztec Documentation](https://docs.aztec.network)
- [Noir Language Guide](https://noir-lang.org/docs)
- [Aztec.js API Reference](https://docs.aztec.network/reference/aztec-js)
- [Azguard Wallet](https://azguard.xyz/)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

---

Built with [Aztec Network](https://aztec.network)
