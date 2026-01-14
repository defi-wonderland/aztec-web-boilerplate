# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Aztec Web Boilerplate - a React + TypeScript application for interacting with the Aztec blockchain. It uses:

- **React 18** with TypeScript
- **Tailwind CSS v4** for styling
- **Radix UI Primitives** for accessible components
- **Lucide React** for icons
- **Vite** for bundling

## UI Development Guidelines

### The Styles Pattern (MANDATORY)

All Tailwind classes MUST be defined in a `styles` object at the top of the component file. **NEVER use inline className strings directly in JSX**.

```tsx
// ✅ CORRECT
const styles = {
  container: 'flex flex-col gap-4',
  title: 'text-lg font-semibold text-default',
} as const;

export const MyComponent = () => (
  <div className={styles.container}>
    <h1 className={styles.title}>Title</h1>
  </div>
);

// ❌ WRONG - Never do this
export const BadComponent = () => (
  <div className="flex flex-col gap-4">
    <h1 className="text-lg font-semibold">Title</h1>
  </div>
);
```

### Style Object Rules

1. Define `styles` object BEFORE the component function
2. Always use `as const` for type inference
3. Use camelCase keys describing the element's purpose
4. Group related styles with comments
5. Use nested objects for variants: `icon: { sm: 'h-4 w-4', md: 'h-5 w-5' }`

### Using cn() for Conditionals

Use `cn()` from `@/utils` only for conditional classes:

```tsx
import { cn } from '../utils';

<button className={cn(styles.button, isActive && styles.buttonActive)}>
```

### Theme-Aware Classes

Use custom utility classes from `globals.css`:

- Backgrounds: `bg-surface`, `bg-surface-secondary`, `bg-surface-tertiary`
- Text: `text-default`, `text-muted`, `text-accent`
- Borders: `border-default`
- Gradients: `gradient-primary`, `gradient-secondary`
- Shadows: `shadow-theme`, `shadow-theme-hover`, `shadow-theme-lg`

## UI Component Library

Always use components from `src/components/ui/` instead of native HTML elements.

### Available Components

- **`Button`** - All clickable actions (variants: primary, secondary, ghost, danger, icon, toggle)
- **`Input`** - Text inputs with label, error, and helper text support
- **`Textarea`** - Multi-line text inputs
- **`Select`** - Dropdowns (SelectTrigger, SelectContent, SelectItem)
- **`Card`** - Content containers (CardHeader, CardTitle, CardDescription, CardContent)
- **`Badge`** - Status indicators (variants: default, primary, success, warning, error, info)
- **`Tabs`** - Tab navigation (TabsList, TabsTrigger, TabsContent)
- **`Dialog`** - Modals (DialogTrigger, DialogContent, DialogHeader, DialogFooter)
- **`Toast`** - Notifications via `useToast()` hook
- **`Tooltip`** - Hover information (TooltipTrigger, TooltipContent)
- **`Toggle`** - Toggle buttons with pressed state

### Usage Example

```tsx
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
} from '../components/ui';

const styles = {
  badge: 'mr-2',
} as const;

const MyComponent = () => (
  <Card>
    <CardHeader>
      <CardTitle>Title</CardTitle>
    </CardHeader>
    <CardContent>
      <Badge variant="success" className={styles.badge}>
        Active
      </Badge>
      <Button variant="primary">Submit</Button>
    </CardContent>
  </Card>
);
```

### Adding New Components

1. **Check Radix UI Primitives first**: https://www.radix-ui.com/primitives/docs/overview/introduction
2. If it exists in Radix, create a wrapper in `src/components/ui/`
3. Style with Tailwind using CVA (class-variance-authority) for variants
4. Export from `src/components/ui/index.ts`
5. Add examples to `UIComponentsShowcase.tsx`
6. **Update the components list** in this file's "Available Components" section and the cursor rules

## Icons

Use **Lucide React** for all icons: https://lucide.dev/icons/

Use the `iconSize()` utility with Lucide's `size` prop for consistent sizing:

```tsx
import { Home, Settings, AlertTriangle } from 'lucide-react';
import { iconSize } from '../utils';

// Usage - size prop with iconSize(), className for colors/styles
<Home size={iconSize()} />                           // sm (16px) - default
<Settings size={iconSize('md')} />                   // md (20px)
<AlertTriangle size={iconSize('lg')} className={styles.iconStyles} />
```

### Standard Sizes

- `iconSize('xs')` - 12px - Very small inline elements
- `iconSize()` - 16px (sm) - **Default**, inline text, buttons
- `iconSize('md')` - 20px - Slightly larger, tab icons
- `iconSize('lg')` - 24px - Headers
- `iconSize('xl')` - 32px - Card headers, hero sections
- `iconSize('2xl')` - 48px - Large illustrations, error states

### Styling Icons

Use `size` prop for dimensions, `className` for colors:

```tsx
const styles = {
  headerIcon: 'text-accent',
  warningIcon: 'text-amber-500',
} as const;

<Coins size={iconSize('xl')} className={styles.headerIcon} />;
```

### Icons in Buttons

```tsx
<Button icon={<Rocket size={iconSize()} />}>Deploy</Button>

// Icon-only button
<Button variant="icon" size="icon">
  <Copy size={iconSize()} />
</Button>
```

**Do NOT use**: Emojis, inline SVGs, other icon libraries, or hardcoded pixel values.

## Hooks

- `useToast()` - Notifications (success/error/warning/info/loading)
- `useModal()` - Modal state (`MODAL_IDS`)
- `useTheme()` - Theme toggle

### Toast Examples

```tsx
const { success, error, warning, info, loading } = useToast();

// Simple toast
success('Operation completed');

// With description
error('Failed', 'Check console for details');

// Loading toast that resolves
const toast = loading('Processing...', 'Please wait');
// Later...
toast.success('Done!', 'Operation completed');
// or
toast.error('Failed', 'Something went wrong');
```

## Component Structure

1. **Imports**: React → Third-party → Internal
2. **Styles object**: Define all Tailwind classes
3. **Types/Interfaces**: Component props
4. **Component function**: Keep render logic simple
5. **Export**: Named exports preferred

## Best Practices

- Use logical AND (`&&`) over ternary for conditional rendering
- Keep components focused and single-purpose
- Use hooks for side effects and state management
- Implement proper memoization (`useMemo`, `useCallback`)
- Keep state as local as possible
- Always cleanup effects with return functions
- Import only what you need (tree-shaking)

## Common Commands

```bash
# Development
yarn dev                      # Start dev server on localhost:3000
yarn serve                    # Preview production build

# Contract Development
yarn build-contracts          # Compile Noir contracts and generate TypeScript bindings
yarn deploy-contracts         # Deploy contracts to sandbox (requires local Aztec node)

# Building
yarn build                    # Full build: contracts + app
yarn build:ci                 # CI build with memory limits
yarn build-app                # Build app only (requires contracts already built)

# Testing
yarn test                     # Run all unit and integration tests
yarn test:unit                # Run unit tests only
yarn test:integration         # Run integration tests only
yarn test:e2e                 # Run E2E tests with Playwright (builds + deploys first)
yarn test:watch               # Watch mode for tests
yarn test:coverage            # Generate coverage report

# Code Quality
yarn lint                     # Check code formatting and linting
yarn lint:fix                 # Auto-fix formatting and linting issues

# Cleanup
yarn clean                    # Remove all build artifacts
```

## Architecture Overview

### Wallet System (Multi-Connector Architecture)

This boilerplate uses a **connector pattern** to support three distinct wallet types:

#### 1. Embedded Wallet (`EmbeddedConnector`)

- **PXE Location**: App-managed (SharedPXEService)
- **Signing**: Internal (keys stored in browser localStorage)
- **Use Case**: Quick testing, simple dApps, development
- **Files**: `src/connectors/EmbeddedConnector.ts`, `src/providers/hooks/useEmbeddedWallet.ts`

**Key Features**:

- Auto-initialization with shared PXE
- Account creation with credential generation
- Test account connection support (from `@aztec/accounts/testing`)
- Account persistence across sessions
- Sponsored fee payments

#### 2. External Signer Wallet (`ExternalSignerConnector`)

- **PXE Location**: App-managed (SharedPXEService)
- **Signing**: External EVM wallet (MetaMask, Rabby, etc.)
- **Use Case**: Users with existing EVM wallets
- **Files**: `src/connectors/ExternalSignerConnector.ts`, `src/providers/hooks/useExternalSignerWallet.ts`

**Key Features**:

- EIP-6963 compatible (multi-wallet support via rdns)
- Wallet signs transactions, app runs Aztec PXE logic
- EVM address recovery from signatures
- State sync between app and EVM wallet
- Sponsored fee payments

#### 3. Browser Wallet (`BrowserWalletConnector`)

- **PXE Location**: External (browser extension manages everything)
- **Signing**: External (extension handles it)
- **Use Case**: Production apps with full-featured wallets like Azguard
- **Files**: `src/connectors/BrowserWalletConnector.ts`, `src/providers/hooks/useBrowserWallet.ts`

**Key Features**:

- Adapter pattern for wallet-specific implementations
- Supports operations: `send_transaction`, `simulate_views`, `register_contract`
- CAIP account handling
- Minimal app responsibility (wallet does everything)

**Adapter Implementation** (`src/adapters/`):

- `AzguardAdapter` - Reference implementation for Azguard wallet
- Implement `IBrowserWalletAdapter` interface for new wallets
- See README section "Adding a New Browser Wallet" for instructions

### Wallet State Management

**UniversalWalletProvider** (`src/providers/UniversalWalletProvider.tsx`):

- Single provider managing all wallet types
- Composes network, signer, and wallet context
- Exposes unified context via `useUniversalWallet()` hook

**Key Context Values**:

```typescript
{
  // Wallet
  isConnected: boolean,
  isInitialized: boolean,
  walletType: 'embedded' | 'external_signer' | 'browser_wallet',
  account: AccountWithSecretKey | null,
  connector: WalletConnector | null,
  connectWith(connectorId: string): Promise<void>,
  disconnect(): Promise<void>,

  // Network
  currentConfig: NetworkConfig,
  switchToNetwork(name: string): Promise<void>,

  // EVM Signer (for External Signer wallet)
  evmAddress: Hex | null,
  connectEVMWallet(): Promise<void>,
  disconnectEVMWallet(): void,
}
```

### Contract Management

**ContractRegistry** (`src/contract-registry/ContractRegistry.ts`):

- Three-tier caching: Memory → IndexedDB → Fresh registration
- Lazy loading support (set `lazyRegister: true` in config)
- Concurrent request deduplication
- Subscriber pattern for cache invalidation

**Registration Flow**:

1. Check memory cache (instant if cached)
2. Check pending registrations (deduplication)
3. Query IndexedDB storage (fast if previously registered)
4. Fresh PXE registration (slowest, only when needed)

**Contract Configuration** (`src/config/contracts.ts`):

```typescript
export const contractsConfig = createContractConfig({
  dripper: {
    artifact: DripperContract.artifact,
    contract: DripperContract,
    address: (config) => config.dripperContractAddress,
    deployParams: (config) => ({ salt, deployer, ... }),
    lazyRegister: false,  // Register at app startup
  },
  token: {
    // Same structure
    lazyRegister: true,  // Register on-demand only
  },
});
```

**Usage**:

```typescript
// In components
const { getContract } = useContracts();
const dripper = await getContract('dripper'); // Typed, cached

// Access methods
await dripper.methods.drip(recipient).send().wait();
const balance = await token.methods.balance_of_public(address).simulate();
```

### Network Configuration

**Available Networks** (`src/config/networks/`):

- **Sandbox** (`http://localhost:8080`): Local development with Aztec node
- **Devnet** (`https://devnet.aztec-labs.com/`): Public testnet (default)

**Network Config Structure**:

```typescript
{
  name: 'sandbox' | 'devnet',
  displayName: string,
  nodeUrl: string,
  proverEnabled: boolean,
  isTestnet: boolean,
  deployerAddress: string,  // Account used for deployments
  dripperContractAddress: string,
  tokenContractAddress: string,
  // ... deployment salts
}
```

**Switching Networks**:

- Use `switchToNetwork(name)` from `useUniversalWallet()`
- Automatically reinitializes PXE and clears contract cache
- Requires reconnecting wallet

### Service Layer

**SharedPXEService** (`src/services/aztec/SharedPXEService.ts`):

- Singleton PXE instance shared across Embedded and External Signer connectors
- Auto-initialization from network config
- Wallet instance creation
- Sponsored fee payment method management
- IndexedDB persistence

**EVMWalletService** (`src/services/evm/EVMWalletService.ts`):

- Manages EVM wallet connections for External Signer wallet
- EIP-6963 support (discovers and connects to multiple wallet providers)
- Event listeners: `accountsChanged`, `chainChanged`, `disconnect`
- Uses `viem` WalletClient

**AztecStorageService** (`src/services/aztec/AztecStorageService.ts`):

- IndexedDB-based contract storage
- Caches registered contracts across sessions
- Reduces PXE synchronization time

### Build System & Vite Configuration

**Node.js Polyfills** (`vite.config.ts`):

- Custom shimming for `fs`, `net`, `tty` (browser-incompatible modules)
- Polyfills for `buffer`, `crypto`, `stream`, `process`, `util`, `assert`
- Special aliases for `pino/browser.js` (logging), `crypto-browserify`

**Cross-Origin Headers**:
Required for `SharedArrayBuffer` support (used by Aztec proofs):

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
Cross-Origin-Resource-Policy: cross-origin
```

**Dependency Deduplication**:

- `@aztec/foundation`, `@aztec/circuits.js`, `@noble/curves` are deduplicated
- Prevents multiple copies of crypto libraries

### Contract Development Workflow

**1. Create Contract** (`contracts/your_contract/`):

- Write Noir contract in `src/main.nr`
- Add to `contracts/Nargo.toml` workspace members

**2. Build Contracts** (`yarn build-contracts`):

- Compiles all Noir contracts
- Generates TypeScript bindings in `src/artifacts/`
- Copies artifacts to `src/target/`

**3. Deploy Contracts** (`yarn deploy-contracts`):

- Uses `scripts/deploy.ts`
- Creates deployer account with ECDSA signing
- Deploys contracts with deterministic addresses (salt-based)
- Saves deployment info to `src/config/deployments/{network}.json`

**4. Configure Registry** (`src/config/contracts.ts`):

- Import generated TypeScript contract wrapper
- Add contract to `contractsConfig`
- Specify address resolver, deployment params, lazy loading

**5. Use in App**:

```typescript
const { getContract } = useContracts();
const myContract = await getContract('your_contract');
await myContract.methods.myMethod(args).send().wait();
```

### Testing Strategy

**Unit Tests** (`tests/unit/`):

- Vitest with Node.js environment
- Test utilities, services, hooks
- Mock external dependencies

**Integration Tests** (`tests/integration/`):

- Vitest with longer timeout (30s)
- Test wallet connectors, contract interactions
- May require local Aztec node

**E2E Tests** (`tests/e2e/`):

- Playwright with Chromium, Firefox, Webkit
- Test full user flows
- Runs `prep-test` (deploys contracts + builds app) before tests
- Timeout: 400s (Aztec operations are slow)

### TypeScript Best Practices

- **Avoid `any`**: Use `unknown` when type is uncertain
- **Maintain `bigint` types**: Keep bigint from Aztec APIs (don't convert to number)
- **Dependency injection**: Follow SOLID principles
- **Avoid circular dependencies**: Use internal module pattern
- **JSDoc**: Document all public APIs

### File Structure

```
src/
├── adapters/            # Browser wallet adapters (Azguard, etc.)
├── artifacts/           # Generated contract TypeScript bindings
│   ├── devnet/          # Devnet-specific artifacts
│   └── sandbox/         # Sandbox-specific artifacts
├── components/
│   ├── ui/              # Primitive UI components (Button, Input, etc.)
│   └── ...              # Feature components
├── config/
│   ├── contracts.ts     # Contract registry configuration
│   ├── walletKit.ts     # Wallet & network configuration
│   ├── evmWallets.ts    # EVM wallet provider mapping
│   ├── networks/        # Network-specific configs
│   └── deployments/     # Deployed contract addresses (generated)
├── connectors/          # Wallet connectors (Embedded, ExternalSigner, BrowserWallet)
├── containers/          # Page-level components
├── contract-registry/   # Contract registration utilities
├── hooks/               # Custom React hooks
├── providers/           # Context providers
│   └── hooks/           # Provider-specific hooks (wallet implementations)
├── services/            # Service layer
│   ├── aztec/           # Aztec-specific services (PXE, storage)
│   └── evm/             # EVM wallet service
├── styles/
│   ├── globals.css      # Global styles & Tailwind config
│   └── theme.ts         # CVA variants for components
├── types/               # TypeScript type definitions
└── utils/               # Utility functions (cn, etc.)

contracts/               # Noir smart contracts
scripts/                 # Build and deployment scripts
tests/                   # Test suites (unit, integration, e2e)
```

### Important Patterns

**Connector Pattern**:

- Abstract wallet differences behind `WalletConnector` interface
- Each connector handles initialization, connection, signing differently
- UI code is wallet-agnostic

**Adapter Pattern**:

- Browser wallets use adapters to translate generic operations
- Implement `IBrowserWalletAdapter` for new wallet integrations
- See `src/adapters/azguard/` as reference

**Provider Composition**:

- `AppProvider` composes all providers
- `UniversalWalletProvider` handles wallet state
- Context hooks expose state to components

**Lazy Loading**:

- Contracts can be marked `lazyRegister: true`
- Reduces initial sync time
- Registers on-demand when first accessed

**Smart Caching**:

- Contract registry: memory → storage → fresh
- Prevents duplicate registrations
- Invalidates on network change
