# Aztec Web Boilerplate

A comprehensive Aztec development boilerplate featuring dynamic contract interaction, wallet integration, and privacy-preserving operations on the Aztec network.

## 🛠️ Overview

Aztec Web Boilerplate provides developers with a complete toolkit for building privacy-first applications on Aztec, featuring:
- Dynamic contract loading and interaction through drag-and-drop JSON artifacts
- Dual wallet support (Embedded Aztec wallet and Azguard wallet integration)
- Real-time contract function execution with automatic UI generation
- Privacy-preserving token operations and account management
- Modern React architecture with TypeScript and comprehensive testing

The application demonstrates Aztec's capabilities through an intuitive interface that automatically generates contract interaction forms from ABI definitions.

## ✨ Key Features

### Dynamic Contract Interaction
- **Contract Loader**: Drag-and-drop JSON artifacts to instantly generate interactive interfaces
- **ABI Parser**: Automatic parsing of contract ABIs with support for Aztec Noir and standard formats
- **Function Execution**: Real-time contract function calls with proper input validation and result display

### Wallet Integration
- **Embedded Wallet**: Browser-based Aztec wallet with no external dependencies
- **Azguard Integration**: Seamless connection to Azguard wallet extension
- **Account Management**: Create, connect, and manage multiple Aztec accounts

## 🚀 Quick Start

### Prerequisites
- Node.js >=22.0.0
- Azguard wallet extension (optional, for external wallet integration)

### Installation

```bash
# Clone the repository
git clone https://github.com/defi-wonderland/aztec-web-boilerplate.git
cd aztec-web-boilerplate

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
aztec-web-boilerplate/
├── contracts/              # Noir smart contracts
│   └── dripper/           # Token faucet contract
├── src/
│   ├── artifacts/         # Generated contract TypeScript bindings
│   ├── components/        # React UI components
│   │   ├── ContractLoader.tsx    # Drag-and-drop contract loading
│   │   ├── ContractInterface.tsx # Dynamic contract UI generation
│   │   └── ContractFunction.tsx  # Individual function interaction
│   ├── providers/         # React context providers
│   │   ├── AztecWalletProvider.tsx
│   │   ├── AzguardWalletProvider.tsx
│   │   ├── ThemeProvider.tsx
│   │   └── ConfigProvider.tsx
│   └── services/          # Service layer
│       └── aztec/        # Aztec-specific services
│           ├── core/     # Wallet and contract services
│           ├── features/ # Token, voting, dripper services
│           └── wallet/   # Azguard integration services
├── scripts/              # Deployment and utility scripts
└── tests/               # Vitest unit and integration tests
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
yarn test                # Run Vitest test suite
yarn test:watch          # Run tests in watch mode
yarn test:ui             # Run tests with UI interface
yarn lint                # Check code formatting

# Performance Options
PROVER_ENABLED=false yarn deploy-contracts  # Skip proof generation for faster development
```

## 🔗 Technical Architecture

### Dynamic Contract Interaction
- **Contract Loading**: Drag-and-drop interface for JSON artifacts with automatic ABI parsing
- **UI Generation**: Dynamic form generation from contract ABI definitions
- **Function Execution**: Real-time contract interaction with input validation and result display
- **Multi-format Support**: Compatible with both Aztec Noir and standard Ethereum ABI formats

### Aztec Integration
- **PXE**: Client-side Private eXecution Environment for proof generation
- **Account Contracts**: ECDSA keys for seamless wallet integration
- **Note System**: Encrypted UTXO-like notes for private state management
- **Fee Abstraction**: Sponsored transactions through SponsoredFPC

### Wallet Architecture
- **Embedded Wallet**: Browser-based Aztec wallet with local key management
- **Azguard Integration**: External wallet support via RPC communication
- **Universal Interface**: Seamless switching between wallet types
- **Persistence**: Automatic reconnection and session management

## 🧪 Testing

The project includes comprehensive unit and integration tests using Vitest:

```bash
# Run full test suite
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with UI interface
yarn test:ui

# Run tests without proof generation (faster)
PROVER_ENABLED=false yarn test
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on our development process and how to submit pull requests.

## 📚 Resources

- [Aztec Documentation](https://docs.aztec.network)
- [Azguard Wallet](https://github.com/AzguardWallet)
- [Noir Language Guide](https://noir-lang.org/docs)
- [Vitest Testing Framework](https://vitest.dev)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built by [Wonderland](https://wonderland.xyz) in collaboration with Aztec Labs
- Wallet integration powered by [Azguard Wallet](https://github.com/AzguardWallet)
- Privacy technology enabled by [Aztec Network](https://aztec.network)

## ⚠️ Disclaimer

This is a development boilerplate for demonstration purposes. Always test thoroughly before deploying to production environments.

---

For questions, issues, or feature requests, please open an issue on [GitHub](https://github.com/defi-wonderland/aztec-web-boilerplate/issues).