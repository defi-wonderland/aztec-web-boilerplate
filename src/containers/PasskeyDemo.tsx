import { Fingerprint, Unplug, Loader2, CheckCircle } from 'lucide-react';
import { PasskeyWalletProvider, usePasskeyWallet } from '@aztec/passkey-wallet';
import type { PasskeyWalletConfig } from '@aztec/passkey-wallet';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '../components/ui';
import { cn, iconSize } from '../utils';

const config: PasskeyWalletConfig = {
  network: 'devnet',
  walletHost: 'http://localhost:3001',
  contracts: [],
};

const styles = {
  card: 'w-full',
  header: 'flex flex-col gap-1',
  headerRow: 'flex items-center gap-3',
  headerIcon: 'text-accent',
  statusSection: 'flex flex-col gap-4',
  statusRow: 'flex items-center justify-between',
  statusLabel: 'text-sm font-medium text-muted',
  addressCard: 'bg-surface-secondary rounded-lg px-4 py-3',
  addressLabel: 'text-xs text-muted mb-1',
  addressValue: 'font-mono text-sm text-default break-all',
  actions: 'flex flex-col gap-3 pt-2',
  connectIcon: 'mr-2',
} as const;

function WalletStatus() {
  const { isConnected, isConnecting, address, connect, disconnect } = usePasskeyWallet();

  return (
    <Card className={styles.card} data-testid="passkey-wallet-card">
      <CardHeader>
        <div className={styles.headerRow}>
          <Fingerprint size={iconSize('lg')} className={styles.headerIcon} />
          <div className={styles.header}>
            <CardTitle>Passkey Wallet</CardTitle>
            <CardDescription>
              Authenticate with Face ID, Touch ID, or fingerprint
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className={styles.statusSection}>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>Status</span>
            {isConnecting && (
              <Badge variant="warning" data-testid="passkey-status-connecting">
                <Loader2 size={iconSize('xs')} className="animate-spin mr-1" />
                Connecting
              </Badge>
            )}
            {isConnected && (
              <Badge variant="success" data-testid="passkey-status-connected">
                <CheckCircle size={iconSize('xs')} className="mr-1" />
                Connected
              </Badge>
            )}
            {!isConnected && !isConnecting && (
              <Badge variant="default" data-testid="passkey-status-disconnected">
                Disconnected
              </Badge>
            )}
          </div>

          {address && (
            <div className={styles.addressCard} data-testid="passkey-address-card">
              <div className={styles.addressLabel}>Wallet Address</div>
              <div className={styles.addressValue} data-testid="passkey-address-value">
                {address}
              </div>
            </div>
          )}

          <div className={styles.actions}>
            {!isConnected ? (
              <Button
                variant="primary"
                onClick={connect}
                disabled={isConnecting}
                isLoading={isConnecting}
                icon={!isConnecting ? <Fingerprint size={iconSize()} /> : undefined}
                data-testid="passkey-connect-button"
              >
                {isConnecting ? 'Connecting...' : 'Connect with Passkey'}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={disconnect}
                icon={<Unplug size={iconSize()} />}
                data-testid="passkey-disconnect-button"
              >
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PasskeyDemo() {
  return (
    <PasskeyWalletProvider config={config}>
      <WalletStatus />
    </PasskeyWalletProvider>
  );
}
