# Bridge and Seek

A privacy-first cross-chain bridge application powered by Substance Labs' bridge that enables seamless token transfers between Base Sepolia and Aztec Sepolia, with built-in private swapping capabilities.

## 🌉 Overview

Bridge and Seek demonstrates the power of privacy-preserving cross-chain interactions by allowing users to:
- Bridge tokens from Base Sepolia into Aztec's private ecosystem
- Bridge tokens out from Aztec to Base Sepolia
- Perform private token operations within Aztec
- Execute cross-chain swaps while maintaining transaction privacy

The application showcases Aztec's privacy features through both public and private token operations, providing a complete demonstration of confidential cross-chain DeFi.

## ✨ Key Features

### Core Bridge Functionality
- **Shield (Bridge In)**: Transfer WETH from Base Sepolia to Aztec Sepolia
- **Unshield (Bridge Out)**: Transfer WETH from Aztec back to Base Sepolia  
- **7683 Standard**: Intent-based cross-chain order system for secure transfers

### User Experience
- **Embedded Wallet**: No popups or external wallet apps required. Everything is generated in-browser
- **MetaMask Integration**: Seamless connection for EVM operations
- **Account Abstraction**: Sponsored fee payments through SponsoredFPC

## 🚀 Quick Start

### Prerequisites
- Node.js >=22.0.0
- MetaMask or compatible EVM wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/defi-wonderland/aztec-bridge-and-seek.git
cd bridge-and-seek

# Install dependencies
yarn install

# Install Aztec 1.1.2
aztec-up 1.1.2

# Start Sandbox
aztec start --sandbox

# Build and deploy contracts
yarn build-contracts
yarn deploy-contracts

# Start development server
yarn dev
```

The application will be available at http://localhost:3000

## 📦 Project Structure

```
bridge-and-seek/
├── contracts/              # Noir smart contracts
│   └── dripper/           # Token faucet contract
├── src/
│   ├── artifacts/         # Generated contract TypeScript bindings
│   ├── components/        # React UI components
│   ├── providers/         # React context providers
│   │   ├── AztecWalletProvider.tsx
│   │   ├── EvmWalletProvider.tsx
│   │   ├── TokenProvider.tsx
│   │   └── NotificationProvider.tsx
│   └── services/          # Service layer
│       └── aztec/        # Aztec-specific services
│           ├── core/     # Wallet and contract services
│           ├── features/ # Token, voting, dripper services
│           └── storage/  # Browser storage management
├── scripts/              # Deployment and utility scripts
└── tests/               # E2E Playwright tests
```

## 🛠️ Development

### Essential Commands

```bash
# Contract Development
yarn build-contracts      # Compile Noir contracts and generate TypeScript artifacts
yarn compile-contracts    # Compile Noir contracts only
yarn codegen-contracts    # Generate TypeScript bindings
yarn deploy-contracts     # Deploy all contracts to Aztec network

# Application Development  
yarn dev                  # Start development server
yarn build-app           # Production build with Webpack
yarn build               # Full build (contracts + app)
yarn serve               # Serve production build

# Testing & Quality
yarn test                # Run E2E test suite
yarn prep-test           # Deploy contracts and build for testing
yarn lint                # Check code formatting

# Performance Options
PROVER_ENABLED=false yarn deploy-contracts  # Skip proof generation for faster development
```

## 🔗 Technical Architecture

### Cross-Chain Bridge
- **Bridge Implementation**: Built on [Substance Labs Aztec-EVM Bridge](https://github.com/substance-labs/aztec-evm-bridge)
- **Source Chain**: Base Sepolia 
- **Destination Chain**: Aztec Testnet
- **Bridge Token**: WETH
  - Base Sepolia: `0x1BDD24840e119DC2602dCC587Dd182812427A5Cc`
  - Aztec Sepolia: `0x143c799188d6881bff72012bebb100d19b51ce0c90b378bfa3ba57498b5ddeeb`
- **Gateway Contract**: `0x0Bf4eD5a115e6Ad789A88c21e9B75821Cc7B2e6f`
- **Architecture**: Intent-based settlement with zero-knowledge proofs for privacy-preserving cross-chain transfers

### Aztec Integration
- **PXE**: Client-side Private eXecution Environment for proof generation
- **Account Contracts**: ECDSA keys for EVM wallet compatibility
- **Note System**: Encrypted UTXO-like notes for private state
- **Fee Abstraction**: Sponsored transactions through SponsoredFPC

### Security Features
- Zero-knowledge proofs for transaction privacy
- Client-side proof generation (no trusted setup)
- Optional auditability through selective disclosure
- Secure cross-chain message passing via 7683 standard

## 🧪 Testing

The project includes comprehensive E2E tests using Playwright:

```bash
# Run full test suite
yarn test

# Run tests without proof generation (faster)
PROVER_ENABLED=false yarn test
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on our development process and how to submit pull requests.

## 📚 Resources

- [Aztec Documentation](https://docs.aztec.network)
- [7683 Cross-Chain Standard](https://www.erc7683.org/)
- [Bridge Architecture](https://github.com/substance-labs/aztec-evm-bridge)
- [Noir Language Guide](https://noir-lang.org/docs)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built by [Wonderland](https://wonderland.xyz) in collaboration with Aztec Labs
- Bridge infrastructure powered by [Substance Labs Aztec-EVM Bridge](https://github.com/substance-labs/aztec-evm-bridge)
- Privacy technology enabled by [Aztec Network](https://aztec.network)

## ⚠️ Disclaimer

This is a testnet application for demonstration purposes. Do not use with real funds on mainnet.

---

For questions, issues, or feature requests, please open an issue on [GitHub](https://github.com/defi-wonderland/aztec-bridge-and-seek/issues).