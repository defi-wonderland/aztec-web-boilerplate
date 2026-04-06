import { PasskeyWalletProvider, usePasskeyWallet } from '@aztec/passkey-wallet';
import type { PasskeyWalletConfig } from '@aztec/passkey-wallet';

const config: PasskeyWalletConfig = {
  network: 'devnet',
  walletHost: 'http://localhost:3001',
  contracts: [],
};

function WalletStatus() {
  const { isConnected, isConnecting, address, connect, disconnect } = usePasskeyWallet();

  return (
    <div style={{ padding: 24 }}>
      <h1>Passkey Wallet POC</h1>
      <p>Status: {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}</p>
      {address && <p>Address: {address}</p>}
      {!isConnected ? (
        <button onClick={connect} disabled={isConnecting}>Connect with Passkey</button>
      ) : (
        <button onClick={disconnect}>Disconnect</button>
      )}
    </div>
  );
}

export function PasskeyDemo() {
  return (
    <PasskeyWalletProvider config={config}>
      <WalletStatus />
    </PasskeyWalletProvider>
  );
}
