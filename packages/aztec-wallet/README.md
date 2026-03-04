# aztec-wallet

Modular wallet connection library for Aztec. Works like RainbowKit - wrap your app with the provider, add the ConnectButton, and everything works.

## Quick Start

```tsx
import {
  AztecWalletProvider,
  createAztecWalletConfig,
  ConnectButton,
} from './aztec-wallet';

const config = createAztecWalletConfig({
  networks: [{ name: 'devnet', nodeUrl: 'https://devnet.aztec.network' }],
  walletGroups: {
    embedded: true,
    evmWallets: ['metamask', 'rabby'],
    aztecWallets: ['azguard'],
  },
  showNetworkPicker: 'full',
});

function App() {
  return (
    <AztecWalletProvider config={config}>
      <ConnectButton />
    </AztecWalletProvider>
  );
}
```

## Configuration

```tsx
createAztecWalletConfig({
  // Required: Available networks
  networks: [
    { name: 'devnet', nodeUrl: 'https://devnet.aztec.network' },
    { name: 'sandbox', nodeUrl: 'http://localhost:8080' },
  ],

  // Required: Wallet types to enable
  walletGroups: {
    embedded: true, // App-managed wallet (keys in localStorage)
    evmWallets: ['metamask', 'rabby'], // EVM wallets as signers
    aztecWallets: ['azguard'], // Browser extension wallets
  },

  // Optional
  defaultNetwork: 'devnet', // First network if not specified
  showNetworkPicker: 'full' | 'compact', // Show network picker in ConnectButton
  modal: { title: '...', subtitle: '...' },
  onConnect: (account) => {},
  onDisconnect: () => {},
  onError: (error) => {},
});
```

### Wallet Types

| Type               | Signing                   | PXE               | Use Case                    |
| ------------------ | ------------------------- | ----------------- | --------------------------- |
| **Embedded**       | Internal (localStorage)   | App-managed       | Development, quick testing  |
| **EVM Wallet**     | External (MetaMask, etc.) | App-managed       | Users with existing wallets |
| **Browser Wallet** | Extension (Azguard)       | Extension-managed | Production apps             |

## Hooks

### useAztecWallet

Main hook for wallet state and actions:

```tsx
const {
  // State
  isConnected,
  isConnecting,
  address, // string | null
  walletType, // 'embedded' | 'external_signer' | 'browser_wallet'
  network, // Current network config

  // Actions
  connect, // (connectorId: string) => Promise<void>
  disconnect, // () => Promise<void>
  switchNetwork, // (networkName: AztecNetwork) => Promise<void>

  // PXE access (Embedded/EVM wallets only)
  getPXE, // () => PXE | null
  getWallet, // () => Wallet | null

  // EVM Signer (for EVM wallet type)
  needsSigner, // true when EVM wallet needs to be connected
  signer: {
    address, // EVM address
    connect, // (rdns?: string) => Promise<Hex>
    disconnect,
  },
} = useAztecWallet();
```

### Modal Hooks

Control modals programmatically for custom UIs:

```tsx
import {
  useConnectModal,
  useAccountModal,
  useNetworkModal,
} from './aztec-wallet';

const { open, close, isOpen } = useConnectModal();
const { open: openAccount } = useAccountModal();
const { open: openNetwork } = useNetworkModal();
```

### useIsEvmWalletInstalled

Check if an EVM wallet extension is installed:

```tsx
const isMetaMaskInstalled = useIsEvmWalletInstalled('io.metamask');
```

## Type Guards

For working with different connector types:

```tsx
import { hasAppManagedPXE, isEmbeddedConnector } from './aztec-wallet';

const { connector } = useAztecWallet();

if (connector && hasAppManagedPXE(connector)) {
  const pxe = connector.getPXE();
  const wallet = connector.getWallet();
}
```

## Examples

### Custom Connect Button

```tsx
function CustomConnectButton() {
  const { isConnected, address, disconnect } = useAztecWallet();
  const { open } = useConnectModal();

  if (isConnected) {
    return (
      <div>
        <span>
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return <button onClick={open}>Connect Wallet</button>;
}
```

### Wallet-Gated Content

```tsx
function ProtectedContent() {
  const { isConnected, isConnecting } = useAztecWallet();

  if (isConnecting) return <p>Connecting...</p>;
  if (!isConnected) return <p>Please connect your wallet.</p>;

  return <MyApp />;
}
```

### EVM Wallet Flow

When using EVM wallets (MetaMask, Rabby), the user needs to connect their EVM wallet for signing:

```tsx
function EVMWalletFlow() {
  const { isConnected, needsSigner, signer, connect } = useAztecWallet();

  if (!isConnected) {
    return <button onClick={() => connect('metamask')}>Connect</button>;
  }

  if (needsSigner) {
    return <button onClick={() => signer.connect()}>Sign with MetaMask</button>;
  }

  return <p>Connected! EVM: {signer.address}</p>;
}
```

### Direct PXE Access

```tsx
function ContractInteraction() {
  const { getPXE, getWallet } = useAztecWallet();

  const handleAction = async () => {
    const pxe = getPXE();
    const wallet = getWallet();

    if (pxe && wallet) {
      const accounts = await pxe.getRegisteredAccounts();
      // Use wallet for contract calls
    }
  };

  return <button onClick={handleAction}>Execute</button>;
}
```

## Deep Imports (Advanced)

Internal modules are available via deep imports but are **not part of the stable API**:

```tsx
// ⚠️ Use at your own risk - may change without notice
import { getWalletStore } from './aztec-wallet/store/wallet';
import { SharedPXEService } from './aztec-wallet/services/aztec/pxe';
```
