# Aztec Web Boilerplate

A starter template for building privacy-preserving web applications on Aztec Network. This boilerplate provides a complete setup with React, Vite, and Aztec.js, featuring embedded wallet support, Azguard wallet integration, and sponsored fee payments.

## Features

- 🔐 **Privacy-preserving token operations** using Aztec's private state
- 💼 **Multi-wallet support** for embedded wallets or browser extension wallets (Azguard)
- ⛽ **Sponsored fee payments** through SponsoredFPC
- 🔄 **Network switching** between Devnet and local Sandbox
- 📦 **Lazy contract loading** for optimized performance

---

## Quick Start (Devnet)

The boilerplate is configured to work with **Devnet** by default. No local node setup required!

### Prerequisites

- Node.js >= 22.0.0
- Yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/defi-wonderland/aztec-web-boilerplate.git
cd aztec-web-boilerplate

# Install dependencies
yarn install

# Start the development server
yarn dev
```

The application will be available at **http://localhost:3000**

---

## Configuration

### Wallet Configuration

Edit `src/config/walletKit.ts` to customize wallet connectors and networks:

```typescript
export const walletKitConfig: WalletKitConfig = {
  // Available connectors: embedded(), azguard()
  connectors: [embedded(), azguard()],
  
  // Networks to support
  networks: [
    {
      aztecNetwork: 'devnet',
      nodeUrl: NETWORK_URLS.devnet, // https://devnet.aztec-labs.com/
    },
    {
      aztecNetwork: 'sandbox',
      nodeUrl: NETWORK_URLS.sandbox, // http://localhost:8080
    },
  ],
};
```

### Contract Configuration

Edit `src/config/contracts.ts` to add or configure your contracts:

```typescript
export const contractsConfig = createContractConfig({
  dripper: {
    artifact: DripperContract.artifact,
    contract: DripperContract,
    address: (config) => config.dripperContractAddress,
    deployParams: (config) => ({ /* ... */ }),
    lazyRegister: false, // Register immediately at initialization
  },

  token: {
    artifact: TokenContract.artifact,
    contract: TokenContract,
    address: (config) => config.tokenContractAddress,
    deployParams: (config) => ({ /* ... */ }),
    lazyRegister: false,
  },
});
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

---

## Using Azguard Wallet

If you want to use [Azguard Wallet](https://azguard.xyz/), you'll need to configure sponsored fee payments:

### Setting Up Sponsored Fees in Azguard

1. Open Azguard wallet extension
2. Navigate to **Settings** → **Fee Configuration**
3. In the **"Pay fee with"** dropdown, select **FPC**
4. Click **"Create New FPC"**
5. Configure your FPC:
   - **Name**: Any name you prefer (e.g., "Sponsored FPC")
   - **FPC Address**: 
     ```
     0x280e5686a148059543f4d0968f9a18cd4992520fcd887444b8689bf2726a1f97
     ```
6. Save the configuration

This FPC address points to the public Sponsored FPC contract that enables gasless transactions.

---

## Local Development (Sandbox)

If you want to develop locally instead of using Devnet, you'll need to run the Aztec Sandbox.

### Install Aztec

```bash
# Install Aztec toolchain
bash -i <(curl -s https://install.aztec.network)
```

### Start Sandbox

```bash
# Start the Aztec sandbox (in a separate terminal)
aztec start --sandbox
```

### Build & Deploy Contracts

```bash
# Build the Noir contracts
yarn build-contracts

# Deploy to local sandbox
yarn deploy-contracts
```

### Environment Variables

Copy `.env.example` to `.env` and configure for sandbox:

```bash
# Aztec Node URL (point to local sandbox)
VITE_AZTEC_NODE_URL=http://localhost:8080

# Disable prover for faster development
VITE_PROVER_ENABLED=false

# Embedded wallet credentials (optional - auto-generated if not provided)
VITE_EMBEDDED_ACCOUNT_SECRET_PHRASE="my secret"
VITE_EMBEDDED_ACCOUNT_SECRET_KEY="0x..."
VITE_COMMON_SALT="1337"
```

### Start Development Server

```bash
yarn dev
```

---

## Project Structure

```
aztec-web-boilerplate/
├── contracts/                  # Noir smart contracts
│   └── dripper/               # Token faucet contract
├── scripts/
│   └── deploy.ts              # Contract deployment script
├── src/
│   ├── artifacts/             # Generated contract TypeScript bindings
│   │   ├── devnet/            # Devnet-specific artifacts
│   │   └── sandbox/           # Sandbox-specific artifacts
│   ├── components/            # React UI components
│   ├── config/
│   │   ├── contracts.ts       # Contract configuration
│   │   ├── walletKit.ts       # Wallet & network configuration
│   │   ├── deployments/       # Deployment config JSON files
│   │   └── networks/          # Network constants
│   ├── connectors/            # Wallet connectors (Embedded, Azguard)
│   ├── containers/            # Layout and page containers
│   ├── contract-registry/     # Contract registration utilities
│   ├── hooks/                 # React hooks and context hooks
│   ├── providers/             # React context providers
│   ├── services/              # Service layer
│   │   └── aztec/             # Aztec-specific services
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
└── tests/                     # Test suites
```

---

## Available Commands

### Contract Development


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
5. Add contract configuration in `src/config/contracts.ts`
6. Import the generated TypeScript bindings from `src/artifacts/`

---

## Architecture Overview

### Aztec Integration

- **PXE**: Client-side Private eXecution Environment for proof generation
- **Account Contracts**: ECDSA signature-based accounts
- **Note System**: Encrypted UTXO-like notes for private state
- **Fee Abstraction**: Sponsored transactions through SponsoredFPC

### Wallet Options

| Wallet | Description | Use Case |
|--------|-------------|----------|
| **Embedded** | Keys generated and stored in browser | Quick testing, simple dApps |
| **Azguard** | External browser extension wallet | Production apps, user-controlled keys |

---

## Network Information

| Network | Node URL | Chain ID |
|---------|----------|----------|
| Devnet | `https://devnet.aztec-labs.com/` | `aztec:1674512022` |
| Sandbox | `http://localhost:8080` | `aztec:0` |

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
