# AztecWallet

Modular wallet connection library for Aztec applications. Works like RainbowKit - just wrap your app with the provider, add the ConnectButton, and everything works automatically.

## Features

- **Multiple wallet types**: Embedded wallets, Aztec browser wallets (Azguard), EVM wallets (MetaMask, Rabby)
- **Zero-config modals**: Modals are rendered automatically by the provider
- **Smart ConnectButton**: Handles all states automatically (disconnected, connecting, connected)
- **Programmatic control**: Use hooks to control modals from anywhere
- **Network switching**: Built-in network picker and modal
- **Cross-tab sync**: Wallet state syncs across browser tabs
- **Accessible**: Built on Radix UI primitives
- **TypeScript first**: Full type safety

## Quick Start

### 1. Create Configuration

```tsx
import { createAztecWalletConfig } from './aztec-wallet';

const config = createAztecWalletConfig({
  networks: [
    {
      name: 'devnet',
      displayName: 'Devnet',
      nodeUrl: 'https://devnet.aztec.network',
    },
  ],
  walletGroups: {
    embedded: true,
    evmWallets: ['metamask', 'rabby'],
    aztecWallets: ['azguard'],
  },
  showNetworkPicker: 'full',
});
```

### 2. Wrap App with Provider

```tsx
import { AztecWalletProvider } from './aztec-wallet';

function App() {
  return (
    <AztecWalletProvider config={config}>
      <YourApp />
    </AztecWalletProvider>
  );
}
```

### 3. Add ConnectButton

```tsx
import { ConnectButton } from './aztec-wallet';

function Header() {
  return (
    <nav>
      <ConnectButton />
    </nav>
  );
}
```

That's it! The ConnectButton handles everything:

- Shows "Connect Wallet" when disconnected
- Opens the connect modal on click
- Shows the connected address when connected
- Opens the account modal on click when connected
- Includes the network picker automatically (if enabled in config)

---

## Configuration Reference

### createAztecWalletConfig(options)

```tsx
const config = createAztecWalletConfig({
  // REQUIRED: Available networks
  networks: NetworkPreset[],

  // Default network (defaults to first network)
  defaultNetwork?: string,

  // REQUIRED: Wallet groups configuration
  walletGroups: WalletGroupsConfig,

  // Show network picker next to connect button
  // 'full' = icon + name, 'compact' = icon only, undefined = hidden
  showNetworkPicker?: 'full' | 'compact',

  // Connect modal customization
  modal?: {
    title?: string,      // default: 'Connect Wallet'
    subtitle?: string,   // default: helpful description
  },

  // Account modal customization
  accountModal?: {
    showNetwork?: boolean,  // default: false
  },

  // Callbacks
  onConnect?: (account: AccountWithSecretKey) => void,
  onDisconnect?: () => void,
  onError?: (error: Error) => void,
});
```

### NetworkPreset

```tsx
interface NetworkPreset {
  // Unique identifier (e.g., 'devnet', 'sandbox')
  name: string;

  // Display name for UI (optional, auto-generated from name)
  displayName?: string;

  // Icon - emoji string or React component (optional, has defaults for common networks)
  icon?: string | React.ComponentType<{ className?: string; size?: number }>;

  // Aztec node URL
  nodeUrl: string;
}
```

**Built-in network icons:**
| Network Name | Default Icon |
|--------------|--------------|
| `devnet` | Globe |
| `sandbox` | FlaskConical |
| `testnet` | Box |
| `mainnet` | Rocket |

### WalletGroupsConfig

#### Simple Configuration (Recommended)

```tsx
walletGroups: {
  // Enable embedded wallet with defaults
  embedded: true,

  // Enable EVM wallets using preset IDs
  evmWallets: ['metamask', 'rabby'],

  // Enable Aztec wallets using preset IDs
  aztecWallets: ['azguard'],
}
```

#### Advanced Configuration

```tsx
walletGroups: {
  // Custom embedded wallet config
  embedded: {
    label: 'Create New Account',  // Custom button label
    enabled: true,
  },

  // Custom EVM wallets
  evmWallets: {
    label: 'Connect with Ethereum Wallet',
    wallets: [
      {
        id: 'metamask',
        name: 'MetaMask',
        icon: '🦊',              // Emoji, URL, or React component
        rdns: 'io.metamask',     // EIP-6963 identifier
      },
      {
        id: 'custom-wallet',
        name: 'My Custom Wallet',
        icon: CustomIcon,
        rdns: 'com.custom.wallet',
      },
    ],
  },

  // Custom Aztec wallets
  aztecWallets: {
    label: 'Connect Aztec Extension',
    wallets: [
      {
        id: 'azguard',
        name: 'Azguard',
        icon: AzguardIcon,
        adapter: () => createAzguardAdapter(),
      },
    ],
  },
}
```

#### Disabling Wallet Groups

```tsx
walletGroups: {
  embedded: true,
  evmWallets: false,      // Disabled
  aztecWallets: false,    // Disabled
}
```

### Available Wallet Presets

**EVM Wallets:**
| ID | Name | RDNS |
|----|------|------|
| `metamask` | MetaMask | `io.metamask` |
| `rabby` | Rabby | `io.rabby` |

**Aztec Wallets:**
| ID | Name |
|----|------|
| `azguard` | Azguard |

---

## Components

### ConnectButton

Smart button that automatically handles all wallet states.

```tsx
import { ConnectButton } from './aztec-wallet';

// Basic usage - handles everything automatically
<ConnectButton />

// Custom label
<ConnectButton label="Sign In" />

// Custom icon
<ConnectButton icon={<MyIcon />} />

// No icon
<ConnectButton icon={false} />

// Custom styles
<ConnectButton className="my-custom-class" />
```

**Props:**

| Prop        | Type                         | Default            | Description                      |
| ----------- | ---------------------------- | ------------------ | -------------------------------- |
| `label`     | `string`                     | `'Connect Wallet'` | Button text when disconnected    |
| `icon`      | `ReactNode \| false \| null` | Wallet icon        | Custom icon, `false` for no icon |
| `className` | `string`                     | -                  | Additional CSS classes           |

**Automatic behaviors:**

- Disconnected: Shows gradient CTA button, opens ConnectModal on click
- Connecting: Shows loading shimmer
- Connected: Shows NetworkPicker (if enabled) + address with emoji avatar, opens AccountModal on click

### NetworkPicker

Button to open the network selection modal.

**Automatic usage (recommended):** Set `showNetworkPicker` in config and let `ConnectButton` handle it:

```tsx
const config = createAztecWalletConfig({
  // ...
  showNetworkPicker: 'full', // or 'compact'
});

// NetworkPicker is automatically included in ConnectButton when connected
<ConnectButton />;
```

**Standalone usage:** For custom UIs, use the component directly:

```tsx
import { NetworkPicker } from './aztec-wallet';

// Full variant (icon + name + chevron)
<NetworkPicker variant="full" />

// Compact variant (icon only)
<NetworkPicker variant="compact" />
```

**Props:**

| Prop        | Type                  | Default  | Description            |
| ----------- | --------------------- | -------- | ---------------------- |
| `variant`   | `'full' \| 'compact'` | `'full'` | Display variant        |
| `className` | `string`              | -        | Additional CSS classes |

---

## Hooks

### useConnectModal

Control the connect modal programmatically. Use this when you want a custom button that opens the connect modal.

```tsx
import { useConnectModal } from './aztec-wallet';

function CustomConnectButton() {
  const { isOpen, open, close } = useConnectModal();

  return <button onClick={open}>Connect Wallet</button>;
}
```

**Returns:**

| Property       | Type                      | Description                  |
| -------------- | ------------------------- | ---------------------------- |
| `isOpen`       | `boolean`                 | Whether modal is open        |
| `open`         | `() => void`              | Open the modal               |
| `close`        | `() => void`              | Close the modal              |
| `onOpenChange` | `(open: boolean) => void` | Handler for Dialog component |

### useAccountModal

Control the account modal programmatically.

```tsx
import { useAccountModal } from './aztec-wallet';

function AccountButton() {
  const { open } = useAccountModal();

  return <button onClick={open}>View Account</button>;
}
```

### useNetworkModal

Control the network modal programmatically.

```tsx
import { useNetworkModal } from './aztec-wallet';

function NetworkButton() {
  const { open } = useNetworkModal();

  return <button onClick={open}>Switch Network</button>;
}
```

### useAztecWallet (Advanced)

Low-level hook that exposes the complete wallet state and actions. Use this when you need full control to build a completely custom UI without using any of the built-in components or modals.

```tsx
import { useAztecWallet } from './aztec-wallet';

function FullyCustomWalletUI() {
  const {
    // State
    isConnected,
    isConnecting,
    address,
    walletType,
    networkName,
    error,

    // Actions
    connect,
    disconnect,
    switchNetwork,

    // Advanced
    account, // Full AccountWithSecretKey object
    connector, // Current connector instance
    connectors, // All available connectors
  } = useAztecWallet();

  if (isConnecting) {
    return <p>Connecting...</p>;
  }

  if (!isConnected) {
    return (
      <div>
        <button onClick={() => connect('embedded')}>Use Embedded</button>
        <button onClick={() => connect('metamask')}>Use MetaMask</button>
      </div>
    );
  }

  return (
    <div>
      <p>Connected: {address}</p>
      <p>Type: {walletType}</p>
      <p>Network: {networkName}</p>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

---

## Connectors

### Connector Types

| Type                      | Description            | Signing                   | PXE Location      |
| ------------------------- | ---------------------- | ------------------------- | ----------------- |
| **Embedded**              | App-managed wallet     | Internal (localStorage)   | App-managed       |
| **External Signer (EVM)** | EVM wallet as signer   | External (MetaMask, etc.) | App-managed       |
| **Browser Wallet**        | Aztec extension wallet | External (extension)      | Extension-managed |

## Examples

### Basic Setup

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
  },
});

function App() {
  return (
    <AztecWalletProvider config={config}>
      <Header />
      <MainContent />
    </AztecWalletProvider>
  );
}

function Header() {
  return (
    <nav>
      <h1>My App</h1>
      <ConnectButton />
    </nav>
  );
}
```

### Full Configuration

```tsx
const config = createAztecWalletConfig({
  networks: [
    {
      name: 'devnet',
      displayName: 'Aztec Devnet',
      nodeUrl: 'https://devnet.aztec.network',
      icon: '🌐',
    },
    {
      name: 'sandbox',
      displayName: 'Local Sandbox',
      nodeUrl: 'http://localhost:8080',
    },
  ],
  defaultNetwork: 'devnet',
  walletGroups: {
    embedded: {
      label: 'Create New Wallet',
    },
    evmWallets: ['metamask', 'rabby'],
    aztecWallets: ['azguard'],
  },
  showNetworkPicker: 'full',
  modal: {
    title: 'Connect to MyApp',
    subtitle: 'Choose your preferred wallet type.',
  },
  accountModal: {
    showNetwork: true,
  },
  onConnect: (account) => {
    console.log('Connected:', account.getAddress().toString());
  },
  onDisconnect: () => {
    console.log('Disconnected');
  },
  onError: (error) => {
    console.error('Wallet error:', error);
  },
});
```

### Custom Connect Button

```tsx
import { useConnectModal, useAztecWallet } from './aztec-wallet';

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

### Conditional Rendering Based on Wallet State

```tsx
import { useAztecWallet } from './aztec-wallet';

function WalletGatedContent() {
  const { isConnected, isConnecting, address, walletType } = useAztecWallet();

  if (isConnecting) {
    return <p>Connecting...</p>;
  }

  if (!isConnected) {
    return <p>Please connect your wallet to continue.</p>;
  }

  return (
    <div>
      <p>Welcome! You're connected with {walletType} wallet.</p>
      <p>Address: {address}</p>
    </div>
  );
}
```

### Programmatic Network Switching

```tsx
import { useAztecWallet } from './aztec-wallet';

function NetworkSwitcher() {
  const { networkName, switchNetwork, config } = useAztecWallet();

  return (
    <div>
      <p>Current network: {networkName}</p>
      <select
        value={networkName || ''}
        onChange={(e) => switchNetwork(e.target.value)}
      >
        {config.networks.map((network) => (
          <option key={network.name} value={network.name}>
            {network.displayName || network.name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

---

## Architecture

```
aztec-wallet/
├── adapters/              # Browser wallet adapters (Azguard)
├── components/
│   ├── AccountModal/      # Connected account modal
│   ├── AztecWalletModals/ # Internal modals container
│   ├── ConnectButton/     # Smart connection button
│   ├── ConnectModal/      # Multi-step connection modal
│   │   ├── views/         # Modal view components
│   │   └── context.tsx    # Modal state context
│   ├── NetworkModal/      # Network selection modal
│   ├── NetworkPicker/     # Network picker button
│   └── shared/            # Reusable components
├── config/
│   ├── createConfig.ts    # Configuration factory
│   ├── networkPresets.ts  # Network presets and icons
│   └── walletPresets.ts   # Wallet presets (MetaMask, Rabby, etc.)
├── connectors/
│   ├── EmbeddedConnector.ts
│   ├── ExternalSignerConnector.ts
│   ├── BrowserWalletConnector.ts
│   └── registry.ts        # Connector registry
├── hooks/
│   ├── useAztecWallet.ts  # Main wallet hook
│   ├── useConnectModal.ts
│   ├── useAccountModal.ts
│   ├── useNetworkModal.ts
│   └── useWalletAvailability.ts
├── providers/
│   └── AztecWalletProvider.tsx
├── store/
│   ├── modal.ts           # Modal state (Zustand)
│   ├── wallet.ts          # Wallet state (Zustand)
│   ├── network.ts         # Network state (Zustand)
│   └── evm.ts             # EVM wallet discovery (Zustand)
├── types/
│   └── config.ts          # Configuration types
└── index.ts               # Public exports
```
